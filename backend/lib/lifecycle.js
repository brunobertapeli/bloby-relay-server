// Managed-instance lifecycle — the ONE place that knows how to publish, pause, resume,
// fail and terminate a managed box. Used by the provisioning callback, the restart /
// delete routes, the Stripe webhook and the sweeper so they all agree on:
//
//   • status transitions       (ready | paused | suspended | failed | terminated | dns_failed)
//   • the EIP + CF A-record    (publishDns: IP → proxied record → status 'ready' LAST)
//   • users.isOnline mirroring (managed bots never heartbeat)
//   • Stripe                   (cancelSubscription on failure / delete — best-effort)
//
// Everything here is best-effort and idempotent: a second call with the same state is a no-op
// and a partial failure leaves an inspectable status + `error` on the instance rather than a
// silent half-state.

import { ObjectId } from 'mongodb';
import { getDb, getUsers } from '../db.js';
import {
  describeInstance, terminateInstance, stopInstance, startInstance,
  attachElasticIp, releaseElasticIp,
} from './aws.js';
import { upsertDnsRecord, deleteDnsRecord, managedHostname, cfConfigured } from './cloudflare.js';
import { buildRelayUrl } from './validate.js';

// Statuses a box can sit in while it is "ours" and has (or should have) EC2 + DNS.
export const LIVE_STATUSES = new Set(['ready', 'restarting', 'dns_failed']);
// Statuses where the EC2 box is intentionally stopped but kept.
export const STOPPED_STATUSES = new Set(['paused', 'suspended']);
export const PROVISIONING_STATUSES = new Set(['launching', 'booting', 'initializing']);

// ─── DB helpers ─────────────────────────────────────────────────────────────

/** Find an instance by our id → { account: { _id }, instance } or null. */
export async function findInstance(instanceId) {
  const account = await getDb().collection('accounts').findOne(
    { 'instances.id': instanceId },
    { projection: { _id: 1, email: 1, 'instances.$': 1 } },
  );
  const instance = account?.instances?.[0];
  return instance ? { account, instance } : null;
}

/** $set fields on one instance (positional). `$unset` optional. */
export async function setInstance(instanceId, fields, unset = null) {
  const $set = {};
  for (const [k, v] of Object.entries(fields)) $set[`instances.$.${k}`] = v;
  const update = { $set };
  if (unset) {
    update.$unset = {};
    for (const k of unset) update.$unset[`instances.$.${k}`] = '';
  }
  return getDb().collection('accounts').updateOne({ 'instances.id': instanceId }, update);
}

/**
 * Atomically move an instance from one of `from` statuses to `to`.
 * Returns true if the transition was claimed (use this as an in-flight guard).
 */
export async function transition(instanceId, from, to, extra = {}) {
  const fromList = Array.isArray(from) ? from : [from];
  const $set = { 'instances.$.status': to };
  for (const [k, v] of Object.entries(extra)) $set[`instances.$.${k}`] = v;
  const r = await getDb().collection('accounts').updateOne(
    { instances: { $elemMatch: { id: instanceId, status: { $in: fromList } } } },
    { $set },
  );
  return r.modifiedCount === 1;
}

/** Mirror liveness for a managed relay user (they never heartbeat). */
export async function setOnline(username, tier, online) {
  if (!username) return;
  await getUsers().updateOne(
    { username, tier: tier || 'premium' },
    { $set: { isOnline: !!online, updatedAt: new Date() } },
  ).catch(() => {});
}

// ─── Stripe ─────────────────────────────────────────────────────────────────

/**
 * Cancel a subscription immediately (best-effort). Dynamic import avoids the
 * stripe.js ↔ provision.js ↔ lifecycle.js import cycle at module init.
 */
export async function cancelSubscription(subscriptionId, reason = 'managed instance lifecycle') {
  if (!subscriptionId) return false;
  try {
    const { getStripe } = await import('../routes/stripe.js');
    await getStripe().subscriptions.cancel(subscriptionId, {
      prorate: true,
      cancellation_details: { comment: reason },
    });
    console.log(`[lifecycle] cancelled subscription ${subscriptionId} (${reason})`);
    return true;
  } catch (err) {
    // Already cancelled is fine; anything else is logged but never thrown — the caller is
    // usually already handling a failure and must not lose that path.
    if (!/No such subscription|already been canceled|canceled subscription/i.test(err.message)) {
      console.error(`[lifecycle] cancel subscription ${subscriptionId} failed:`, err.message);
    }
    return false;
  }
}

// ─── Failure ────────────────────────────────────────────────────────────────

/**
 * Mark an instance failed with a human-readable reason, free its handle so the user can
 * retry the same name, and cancel its subscription so nobody pays for nothing.
 */
export async function markFailed(instanceId, error, { instance = null } = {}) {
  const found = instance ? null : await findInstance(instanceId);
  const inst = instance || found?.instance;
  await setInstance(instanceId, { status: 'failed', error: String(error).slice(0, 300), failedAt: new Date() });
  if (inst?.username) {
    await getUsers().deleteOne({ username: inst.username, tier: inst.tier || 'premium', kind: 'managed' }).catch(() => {});
  }
  if (inst?.eipAllocationId) await releaseElasticIp(inst.eipAllocationId, inst.region);
  if (inst?.dnsRecordId) await deleteDnsRecord(inst.dnsRecordId).catch(() => {});
  if (inst?.ec2InstanceId) {
    terminateInstance(inst.ec2InstanceId, inst.region).catch((e) =>
      console.error(`[lifecycle] terminate after failure ${inst.ec2InstanceId}:`, e.message));
  }
  if (inst?.stripeSubscriptionId) await cancelSubscription(inst.stripeSubscriptionId, `provisioning failed: ${error}`);
  console.error(`[lifecycle] ${instanceId} FAILED: ${error}`);
}

// ─── DNS / IP ───────────────────────────────────────────────────────────────

/**
 * Resolve the box's public IP — attaching an Elastic IP the first time — and point the
 * proxied CF A-record at it. Persists publicIp / dnsRecordId / eipAllocationId. Does NOT
 * touch status: callers set 'ready' only after this resolves (fixes ready-before-DNS).
 * Throws if no IP or the CF call fails.
 */
export async function publishDns(instance) {
  if (!cfConfigured()) throw new Error('Cloudflare DNS not configured (CF_API_TOKEN / CF_ZONE_ID)');
  if (!instance.ec2InstanceId) throw new Error('no EC2 instance id');
  const tier = instance.tier || 'premium';

  let publicIp = null;
  let eipAllocationId = instance.eipAllocationId || null;

  if (!eipAllocationId) {
    // First publish: wait for the box to be running, then pin it to an EIP. If the IAM user
    // can't allocate addresses this returns null and we fall back to the ephemeral IP.
    for (let i = 0; i < 12; i++) {
      const info = await describeInstance(instance.ec2InstanceId, instance.region);
      if (info?.state === 'running') break;
      await new Promise((r) => setTimeout(r, 2500));
    }
    const eip = await attachElasticIp(instance.ec2InstanceId, instance.region, { instanceId: instance.id });
    if (eip) { eipAllocationId = eip.allocationId; publicIp = eip.publicIp; }
  }

  if (!publicIp) {
    // EIP already attached (IP is stable) or no EIP: read whatever EC2 reports. The public IP
    // can lag a few seconds behind "running" — poll briefly.
    for (let i = 0; !publicIp && i < 12; i++) {
      const info = await describeInstance(instance.ec2InstanceId, instance.region);
      if (info?.publicIp) { publicIp = info.publicIp; break; }
      await new Promise((r) => setTimeout(r, 2500));
    }
  }
  if (!publicIp) throw new Error('instance has no public IP (check subnet auto-assign / EIP)');

  const hostname = managedHostname(instance.username, tier);
  const dnsRecordId = await upsertDnsRecord(hostname, publicIp);
  await setInstance(instance.id, {
    publicIp,
    dnsRecordId,
    eipAllocationId,
    relayUrl: buildRelayUrl(instance.username, tier),
    hostname,
  }, ['error']);
  console.log(`[lifecycle] ${instance.id} ${hostname} → ${publicIp}${eipAllocationId ? ' (EIP)' : ''} dns ${dnsRecordId}`);
  return { publicIp, dnsRecordId, hostname };
}

// ─── Pause / resume ─────────────────────────────────────────────────────────

/**
 * Stop the box but keep it (EBS only ≈ $1.60/mo for 20 GB). Removes the A-record so visitors
 * fall through the wildcard to the relay's offline page instead of a Cloudflare 52x.
 * `status` = 'paused' (billing / trial) or 'suspended' (subscription ended, grace period).
 */
export async function pauseInstance(instance, { status = 'paused', reason = '', terminateAt = null } = {}) {
  const claimed = await transition(instance.id, [...LIVE_STATUSES], status, {
    pausedAt: new Date(), pauseReason: reason, ...(terminateAt ? { terminateAt } : {}),
  });
  if (!claimed) {
    console.log(`[lifecycle] ${instance.id} pause skipped (status ${instance.status})`);
    return false;
  }
  await setOnline(instance.username, instance.tier, false);
  if (instance.dnsRecordId) {
    await deleteDnsRecord(instance.dnsRecordId).catch((e) => console.error('[lifecycle] dns delete:', e.message));
    await setInstance(instance.id, { dnsRecordId: null });
  }
  if (instance.ec2InstanceId) {
    await stopInstance(instance.ec2InstanceId, instance.region).catch((e) =>
      console.error(`[lifecycle] stop ${instance.ec2InstanceId}:`, e.message));
  }
  console.log(`[lifecycle] ${instance.id} → ${status}${reason ? ` (${reason})` : ''}`);
  return true;
}

/** Start a paused/suspended box, re-publish DNS, back to 'ready'. */
export async function resumeInstance(instance) {
  const claimed = await transition(instance.id, [...STOPPED_STATUSES], 'resuming');
  if (!claimed) {
    console.log(`[lifecycle] ${instance.id} resume skipped (status ${instance.status})`);
    return false;
  }
  try {
    await startInstance(instance.ec2InstanceId, instance.region);
    // Give morphy + caddy a moment to come up before DNS makes the box reachable.
    await new Promise((r) => setTimeout(r, 15000));
    await publishDns({ ...instance, status: 'resuming' });
    await setInstance(instance.id, { status: 'ready', pausedAt: null, pauseReason: null, terminateAt: null });
    await setOnline(instance.username, instance.tier, true);
    console.log(`[lifecycle] ${instance.id} resumed → ready`);
    return true;
  } catch (err) {
    await setInstance(instance.id, { status: 'dns_failed', error: `resume: ${err.message}`.slice(0, 300) });
    console.error(`[lifecycle] ${instance.id} resume failed:`, err.message);
    return false;
  }
}

// ─── Terminate ──────────────────────────────────────────────────────────────

/**
 * Tear a managed box down completely: EC2, EIP, A-record, relay handle. Status 'terminated'.
 * Does NOT touch Stripe (callers decide) and does NOT remove the instance record.
 */
export async function terminateManaged(instance, { freeHandle = true } = {}) {
  await setInstance(instance.id, { status: 'terminated', terminatedAt: new Date(), cancelAt: null });
  if (instance.ec2InstanceId) {
    await terminateInstance(instance.ec2InstanceId, instance.region).catch((e) =>
      console.error(`[lifecycle] terminate EC2 ${instance.ec2InstanceId}:`, e.message));
  }
  if (instance.eipAllocationId) {
    // The EIP disassociates once the instance is gone; give it a few seconds then release.
    setTimeout(() => releaseElasticIp(instance.eipAllocationId, instance.region), 20_000).unref?.();
  }
  if (instance.dnsRecordId) {
    await deleteDnsRecord(instance.dnsRecordId).catch((e) => console.error('[lifecycle] dns delete:', e.message));
  }
  if (freeHandle && instance.username) {
    await getUsers().deleteOne({ username: instance.username, tier: instance.tier || 'premium', kind: 'managed' })
      .catch((e) => console.error('[lifecycle] free handle:', e.message));
  }
  console.log(`[lifecycle] ${instance.id} terminated`);
}

/** Strip fields the browser has no business seeing before returning an instance. */
export function publicInstance(inst) {
  if (!inst) return inst;
  const { provisionTokenHash, eipAllocationId, ...rest } = inst;
  return rest;
}

export { ObjectId };
