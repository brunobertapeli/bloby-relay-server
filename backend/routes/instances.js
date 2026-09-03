import { Router } from 'express';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { getDb, getUsers } from '../db.js';
import { jwtAuth } from '../middleware/jwtAuth.js';
import { restartInstance } from '../lib/aws.js';
import { buildRelayUrl } from '../lib/validate.js';
import { cfConfigured } from '../lib/cloudflare.js';
import { provisionManagedInstance } from '../lib/provision.js';
import { instanceCallbackLimiter } from '../middleware/rateLimiter.js';
import {
  findInstance, setInstance, transition, setOnline, publishDns, markFailed,
  cancelSubscription, terminateManaged, publicInstance,
} from '../lib/lifecycle.js';

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

const router = Router();

// ─── List instances ─────────────────────────────────────────────────────────
router.get('/instances', jwtAuth, async (req, res) => {
  try {
    const db = getDb();
    const account = await db.collection('accounts').findOne(
      { _id: new ObjectId(req.account.id) },
      { projection: { instances: 1 } },
    );
    res.json({ instances: (account?.instances || []).map(publicInstance) });
  } catch (error) {
    console.error('[instances] GET error:', error.message);
    res.status(500).json({ error: 'Failed to fetch instances' });
  }
});

// ─── Get single instance status ─────────────────────────────────────────────
router.get('/instances/:id/status', jwtAuth, async (req, res) => {
  try {
    const db = getDb();
    const account = await db.collection('accounts').findOne(
      { _id: new ObjectId(req.account.id), 'instances.id': req.params.id },
      { projection: { 'instances.$': 1 } },
    );
    const instance = account?.instances?.[0];
    if (!instance) return res.status(404).json({ error: 'Instance not found' });
    res.json({ instance: publicInstance(instance) });
  } catch (error) {
    console.error('[instances] status error:', error.message);
    res.status(500).json({ error: 'Failed to get instance status' });
  }
});

// ─── Launch new instance (disabled — now handled via Stripe webhook) ────────
// Instance creation + EC2 launch is triggered by checkout.session.completed
// in backend/routes/stripe.js.

// ─── DEV launch (no payment) ────────────────────────────────────────────────
// Lets us exercise the full purchase→provision→DNS→use loop WITHOUT Stripe.
// Disabled unless DEV_PROVISION_SECRET is set; caller must present it.
//   curl -X POST $API/api/instances/dev-launch \
//     -H "x-dev-secret: $DEV_PROVISION_SECRET" -H 'content-type: application/json' \
//     -d '{"accountId":"<id>","username":"mybot","plan":"starter","region":"na"}'
router.post('/instances/dev-launch', async (req, res) => {
  const secret = process.env.DEV_PROVISION_SECRET;
  if (!secret || req.get('x-dev-secret') !== secret) {
    return res.status(404).json({ error: 'Not found' });
  }
  try {
    const { accountId, username, plan = 'starter', region = 'na', tier = 'premium', ai } = req.body || {};
    if (!accountId || !username) {
      return res.status(400).json({ error: 'accountId and username are required' });
    }
    const result = await provisionManagedInstance({ accountId, username, plan, region, tier, ai });
    console.log(`[instances] dev-launch ${username} (${plan}/${region}) → instance ${result.instanceId}`);
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[instances] dev-launch error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// ─── Provisioning callback (called by the instance's provision.sh) ──────────
// Authenticated by the per-instance provisionToken minted at launch (the callback
// can flip status AND, on "ready", create a public DNS record — so it must not be
// forgeable). Legacy instances without a provisionTokenHash skip the check.
//
// Body: { instanceId, status: 'initializing'|'ready'|'failed', provisionToken,
//         boot?: true        — re-posted by the box on EVERY boot (self-heals a lost callback,
//                              refreshes DNS after an IP change); ignored for stopped boxes
//         detail?: string    — human-readable reason for 'failed'
//         agentVersion?: string, tunnelUrl?: string (legacy tunnel AMIs) }
const CALLBACK_STATUSES = new Set(['initializing', 'ready', 'failed']);
// A boot re-post may only act on a box we consider live or still provisioning — never
// resurrect one we paused/suspended/terminated on purpose.
const BOOT_ACTIONABLE = new Set(['launching', 'booting', 'initializing', 'ready', 'restarting', 'dns_failed']);

router.post('/instances/callback', instanceCallbackLimiter, async (req, res) => {
  try {
    const { instanceId, status, tunnelUrl, provisionToken, boot, detail, agentVersion } = req.body || {};
    if (!instanceId || !status) {
      return res.status(400).json({ error: 'Missing instanceId or status' });
    }
    if (!CALLBACK_STATUSES.has(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    console.log(`[instances] Callback: ${instanceId} → ${status}${boot ? ' (boot)' : ''}${tunnelUrl ? ` (${tunnelUrl})` : ''}`);

    // Load the instance first so we can authenticate the callback.
    let found = await findInstance(instanceId);
    if (!found) return res.status(404).json({ error: 'Instance not found' });
    if (found.instance.provisionTokenHash && sha256(provisionToken || '') !== found.instance.provisionTokenHash) {
      return res.status(403).json({ error: 'Invalid provision token' });
    }

    // The RunInstances promise writes ec2InstanceId a moment after launch; a very fast box
    // could conceivably call back first. Re-read once so 'ready' has an id to publish.
    if (!found.instance.ec2InstanceId && status === 'ready') {
      await new Promise((r) => setTimeout(r, 3000));
      found = (await findInstance(instanceId)) || found;
    }
    const { account: owner, instance: inst } = found;

    if (boot && !BOOT_ACTIONABLE.has(inst.status)) {
      console.log(`[instances] ${instanceId} boot callback ignored (status ${inst.status})`);
      return res.json({ ok: true, ignored: true });
    }

    // ── failed: the box could not bring morphy up ─────────────────────────
    if (status === 'failed') {
      await markFailed(instanceId, `Box reported failure: ${detail || 'unknown'}`, { instance: inst });
      return res.json({ ok: true });
    }

    // ── initializing: only ever moves forward from launching/booting ───────
    if (status === 'initializing') {
      await transition(instanceId, ['launching', 'booting'], 'initializing');
      return res.json({ ok: true });
    }

    // ── ready ─────────────────────────────────────────────────────────────
    const extra = agentVersion ? { agentVersion } : {};

    // MANAGED (direct) mode: pin an EIP, write the proxied A-record, THEN flip to ready —
    // the website shows "your Morphy is ready" the moment status flips, so DNS must exist first.
    if (inst.username && inst.ec2InstanceId && cfConfigured()) {
      const tier = inst.tier || 'premium';
      try {
        await publishDns(inst);
        await setInstance(instanceId, { status: 'ready', readyAt: inst.readyAt || new Date(), ...extra }, ['error']);
        // Link the pre-registered relay handle to this account + mark it online. Managed
        // (tunnel-off) bots never heartbeat; the sweeper keeps isOnline honest from here on.
        await getUsers().updateOne(
          { username: inst.username, tier },
          { $set: { accountId: owner._id, isOnline: true, updatedAt: new Date() } },
        );
      } catch (err) {
        console.error(`[instances] ${instanceId} ready but DNS publish failed:`, err.message);
        await setInstance(instanceId, { status: 'dns_failed', error: `DNS publish failed: ${err.message}`.slice(0, 300), ...extra });
      }
      return res.json({ ok: true });
    }

    // LEGACY tunnel mode (older AMIs report a tunnelUrl): link the relay user by it.
    const update = { status: 'ready', ...extra };
    if (tunnelUrl) update.tunnelUrl = tunnelUrl;
    await setInstance(instanceId, update);
    const legacyUrl = tunnelUrl || inst.tunnelUrl;
    if (legacyUrl) {
      const user = await getUsers().findOne({ tunnelUrl: legacyUrl });
      if (user) {
        await getUsers().updateOne({ _id: user._id }, { $set: { accountId: owner._id } });
        await setInstance(instanceId, { relayUrl: buildRelayUrl(user.username, user.tier) });
        console.log(`[instances] Linked user ${user.username} (${user.tier}) → account ${owner._id}`);
      } else {
        console.log(`[instances] No relay user found for tunnelUrl: ${legacyUrl}`);
      }
    } else if (!cfConfigured()) {
      console.error(`[instances] ${instanceId} ready but Cloudflare is not configured — bot is unreachable`);
      await setInstance(instanceId, { status: 'dns_failed', error: 'Cloudflare DNS not configured on the relay' });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('[instances] callback error:', error.message);
    res.status(500).json({ error: 'Callback failed' });
  }
});

// ─── Restart instance ───────────────────────────────────────────────────────
router.post('/instances/:id/restart', jwtAuth, async (req, res) => {
  try {
    const db = getDb();
    const account = await db.collection('accounts').findOne(
      { _id: new ObjectId(req.account.id), 'instances.id': req.params.id },
      { projection: { 'instances.$': 1 } },
    );
    const instance = account?.instances?.[0];
    if (!instance) return res.status(404).json({ error: 'Instance not found' });
    if (!instance.ec2InstanceId) return res.status(409).json({ error: 'Instance has no server yet' });

    // Claim the transition atomically: a second click / second tab gets a 409 instead of a
    // second stop/start racing the first one and marking a healthy box failed.
    const claimed = await transition(instance.id, ['ready', 'dns_failed'], 'restarting', { error: null });
    if (!claimed) {
      return res.status(409).json({ error: `Instance is ${instance.status} — wait for it to be running` });
    }

    const instId = instance.id;
    restartInstance(instance.ec2InstanceId, instance.region)
      .then(async () => {
        // With an EIP the address survives stop/start; without one it changes. publishDns
        // covers both (no-op update when unchanged) — status flips to ready only after it.
        let dnsOk = true;
        if (instance.username && cfConfigured()) {
          try {
            await publishDns(instance);
          } catch (dnsErr) {
            dnsOk = false;
            console.error(`[instances] ${instId} DNS refresh after restart failed:`, dnsErr.message);
            await setInstance(instId, { status: 'dns_failed', error: `DNS refresh failed: ${dnsErr.message}`.slice(0, 300) });
          }
        }
        if (dnsOk) {
          // Give morphy ~15s to come up after EC2 is running
          await new Promise(r => setTimeout(r, 15000));
          await setInstance(instId, { status: 'ready' });
          await setOnline(instance.username, instance.tier, true);
          console.log(`[instances] ${instId} restart complete → ready`);
        }
      })
      .catch(async (err) => {
        // The box may still come up on its own; don't brick it — the sweeper mirrors real state.
        console.error(`[instances] ${instId} restart failed:`, err.message);
        await setInstance(instId, { status: 'ready', error: `Restart did not complete: ${err.message}`.slice(0, 300) });
      });

    res.json({ ok: true });
  } catch (error) {
    console.error('[instances] restart error:', error.message);
    res.status(500).json({ error: 'Failed to restart instance' });
  }
});

// ─── Terminate instance ─────────────────────────────────────────────────────
router.delete('/instances/:id', jwtAuth, async (req, res) => {
  try {
    const db = getDb();
    const account = await db.collection('accounts').findOne(
      { _id: new ObjectId(req.account.id), 'instances.id': req.params.id },
      { projection: { 'instances.$': 1 } },
    );
    const instance = account?.instances?.[0];
    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    // Stop billing FIRST, then tear the box down (EC2 + EIP + DNS + relay handle).
    if (instance.stripeSubscriptionId) {
      await cancelSubscription(instance.stripeSubscriptionId, 'deleted from dashboard');
    }
    await terminateManaged(instance);

    // Remove from DB
    await db.collection('accounts').updateOne(
      { _id: new ObjectId(req.account.id) },
      { $pull: { instances: { id: req.params.id } } },
    );

    res.json({ ok: true });
  } catch (error) {
    console.error('[instances] DELETE error:', error.message);
    res.status(500).json({ error: 'Failed to terminate instance' });
  }
});

export default router;
