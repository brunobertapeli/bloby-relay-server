// Shared provisioning for the MANAGED ("hosted") tier.
//
// One call does everything needed to stand up a managed bot:
//   1. validate + reserve the handle (pre-register the relay user, mint its token)
//   2. mint a per-instance provisionToken (authenticates the box's callback)
//   3. create the instance record on the account
//   4. launch the EC2 box, passing identity + token via user-data
//
// On "ready", the box calls /api/instances/callback; the relay then reads the
// public IP (describeInstance) and creates the  mybot.morphyagent.com → IP  CF record.
//
// Used by the Stripe webhook (production) and the dev-launch endpoint (testing).

import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { getDb, getUsers } from '../db.js';
import { generateToken } from './token.js';
import { validateUsername, validateTier, buildRelayUrl } from './validate.js';
import { launchInstance } from './aws.js';
import { markFailed } from './lifecycle.js';

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

/**
 * @param {object}   opts
 * @param {string}   opts.accountId  — account that owns the instance
 * @param {string}   opts.username   — desired bot handle (→ mybot.morphyagent.com)
 * @param {string}   opts.plan       — 'starter' | 'pro'
 * @param {string}   opts.region     — 'na' | 'eu' | 'br'
 * @param {string}  [opts.tier]      — 'premium' (default) | 'at' (free)
 * @param {string}  [opts.callbackBase] — e.g. https://api.morphyagent.com
 * @param {string}  [opts.stripeSubscriptionId]
 * @param {object}  [opts.ai]        — { provider, model, apiKey } to inject (optional)
 * @returns {Promise<{ instanceId, username, tier, relayUrl }>}
 */
export async function provisionManagedInstance({
  accountId, username, plan, region, tier = 'premium',
  callbackBase, stripeSubscriptionId = null, ai = null,
}) {
  const uv = validateUsername(username);
  if (!uv.valid) throw new Error(uv.error);
  const tv = validateTier(tier);
  if (!tv.valid) throw new Error(tv.error);
  if (!['starter', 'pro'].includes(plan)) throw new Error('Invalid plan');
  if (!['na', 'eu', 'br'].includes(region)) throw new Error('Invalid region');

  const db = getDb();

  // ── 1. Pre-register the handle (fails cleanly if taken) ──
  const { raw: relayToken, hash: tokenHash } = generateToken();
  const now = new Date();
  try {
    await getUsers().insertOne({
      username: uv.username,
      tier: tv.tier,
      tokenHash,
      // Link to the buyer's account at provision time so the managed bot shows up
      // as an already-claimed Bloby in "My Blobies" immediately — no activation-code
      // "claim" dance needed (the ready callback re-asserts this idempotently).
      accountId: new ObjectId(accountId),
      walletAddress: null,
      tunnelUrl: null,
      isOnline: false,
      lastHeartbeat: null,
      kind: 'managed',
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    if (err.code === 11000) throw new Error('This handle is already taken');
    throw err;
  }

  // ── 2. Per-instance provision token (authenticates the box callback) ──
  const provisionToken = crypto.randomBytes(24).toString('base64url');
  const relayUrl = buildRelayUrl(uv.username, tv.tier);

  // ── 3. Instance record ──
  const id = new ObjectId().toString();
  const instance = {
    id,
    plan,
    region,
    tier: tv.tier,
    username: uv.username,
    ec2InstanceId: null,
    publicIp: null,
    eipAllocationId: null,
    dnsRecordId: null,
    tunnelUrl: null,
    relayUrl,
    provisionTokenHash: sha256(provisionToken),
    status: 'launching',
    error: null,
    stripeSubscriptionId,
    cancelAt: null,
    agentVersion: process.env.AGENT_VERSION || null,
    createdAt: now,
  };
  await db.collection('accounts').updateOne(
    { _id: new ObjectId(accountId) },
    { $push: { instances: instance } },
  );

  // ── 4. Launch EC2 (async — caller returns immediately, box calls back) ──
  const base = callbackBase || process.env.CALLBACK_BASE_URL || `https://api.${process.env.RELAY_DOMAIN}`;
  const callbackUrl = `${base}/api/instances/callback`;

  launchInstance({
    instanceId: id, plan, region, callbackUrl,
    username: uv.username, tier: tv.tier, relayToken, relayUrl, provisionToken, ai,
    agentVersion: instance.agentVersion,
  })
    .then(async ({ ec2InstanceId }) => {
      // Only advance launching → booting; the box's own 'initializing' callback may already
      // have landed if Mongo was slow, and must not be regressed.
      await db.collection('accounts').updateOne(
        { instances: { $elemMatch: { id, status: 'launching' } } },
        { $set: { 'instances.$.ec2InstanceId': ec2InstanceId, 'instances.$.status': 'booting' } },
      );
      await db.collection('accounts').updateOne(
        { 'instances.id': id },
        { $set: { 'instances.$.ec2InstanceId': ec2InstanceId } },
      );
      console.log(`[provision] ${id} (${uv.username}) → EC2 ${ec2InstanceId} launched`);
    })
    .catch(async (err) => {
      console.error(`[provision] ${id} launch failed:`, err.message);
      // markFailed frees the handle (retry same name), records the reason for the UI, and
      // cancels the subscription so the buyer is not billed for a box that never existed.
      await markFailed(id, `Launch failed: ${err.message}`, { instance: { ...instance, ec2InstanceId: null } })
        .catch((e) => console.error(`[provision] ${id} markFailed:`, e.message));
    });

  return { instanceId: id, username: uv.username, tier: tv.tier, relayUrl };
}
