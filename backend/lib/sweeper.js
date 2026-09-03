// Managed-instance sweeper — the reconciliation loop the relay never had.
//
//   every 60 s   stuck provisioning → failed (+ subscription cancelled, handle freed)
//   every 5 min  EC2 state ↔ users.isOnline; IP drift → A-record refreshed;
//                suspended past terminateAt → terminated; EC2 gone → terminated
//
// Single Railway replica; a simple in-process interval with an overlap guard is enough.
// Every step is per-instance try/catch so one bad box never stalls the sweep.

import { getDb } from '../db.js';
import { describeInstance } from './aws.js';
import { cfConfigured } from './cloudflare.js';
import {
  PROVISIONING_STATUSES, LIVE_STATUSES, STOPPED_STATUSES,
  markFailed, publishDns, setInstance, setOnline, terminateManaged, cancelSubscription,
} from './lifecycle.js';

const STUCK_AFTER_MS = parseInt(process.env.PROVISION_TIMEOUT_MS || String(25 * 60 * 1000), 10);
const STUCK_EVERY_MS = 60 * 1000;
const HEALTH_EVERY_MS = 5 * 60 * 1000;

let stuckRunning = false;
let healthRunning = false;

/** Iterate every managed instance across all accounts as { accountId, instance }. */
async function* allInstances(filter) {
  const cursor = getDb().collection('accounts').find(
    { instances: { $elemMatch: filter } },
    { projection: { _id: 1, instances: 1 } },
  );
  for await (const acct of cursor) {
    for (const inst of acct.instances || []) {
      // Re-apply the element filter client-side (the query matched the account, not the element).
      if (inst.status && (filter.status?.$in ? filter.status.$in.includes(inst.status) : true)) {
        yield { accountId: acct._id, instance: inst };
      }
    }
  }
}

export async function sweepStuck() {
  if (stuckRunning) return;
  stuckRunning = true;
  try {
    const cutoff = new Date(Date.now() - STUCK_AFTER_MS);
    for await (const { instance } of allInstances({ status: { $in: [...PROVISIONING_STATUSES] } })) {
      if (!(instance.createdAt instanceof Date) || instance.createdAt > cutoff) continue;
      try {
        await markFailed(instance.id, `Provisioning timed out after ${Math.round(STUCK_AFTER_MS / 60000)} min (last status: ${instance.status})`, { instance });
      } catch (err) {
        console.error(`[sweeper] stuck ${instance.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[sweeper] sweepStuck:', err.message);
  } finally {
    stuckRunning = false;
  }
}

export async function sweepHealth() {
  if (healthRunning) return;
  healthRunning = true;
  try {
    const statuses = [...LIVE_STATUSES, ...STOPPED_STATUSES];
    for await (const { instance } of allInstances({ status: { $in: statuses } })) {
      if (!instance.ec2InstanceId) continue;
      try {
        const info = await describeInstance(instance.ec2InstanceId, instance.region);

        // EC2 no longer knows the instance (terminated outside us, or >1h after termination).
        if (!info || info.state === 'terminated' || info.state === 'shutting-down') {
          if (info?.state === 'shutting-down') continue; // wait for it to finish
          console.warn(`[sweeper] ${instance.id} EC2 ${instance.ec2InstanceId} is gone → terminated`);
          await terminateManaged(instance);
          if (instance.stripeSubscriptionId) await cancelSubscription(instance.stripeSubscriptionId, 'EC2 instance disappeared');
          continue;
        }

        if (STOPPED_STATUSES.has(instance.status)) {
          // Suspended (subscription ended) boxes are kept for a grace period, then destroyed.
          if (instance.status === 'suspended' && instance.terminateAt instanceof Date && instance.terminateAt <= new Date()) {
            console.log(`[sweeper] ${instance.id} grace period over → terminating`);
            await terminateManaged(instance);
          }
          continue;
        }

        // Live statuses: mirror EC2 running state into the dashboard's online dot.
        const running = info.state === 'running';
        await setOnline(instance.username, instance.tier, running);

        // IP drift (no EIP + stop/start outside our restart handler, or a lost DNS write):
        // re-publish so the A-record follows the box. Only when we can actually see an IP
        // and the record is stale/missing.
        if (running && cfConfigured() && instance.status !== 'restarting'
            && info.publicIp && (info.publicIp !== instance.publicIp || !instance.dnsRecordId)) {
          console.warn(`[sweeper] ${instance.id} IP ${instance.publicIp || '∅'} → ${info.publicIp}: refreshing DNS`);
          await publishDns(instance);
          if (instance.status === 'dns_failed') await setInstance(instance.id, { status: 'ready' });
        }
      } catch (err) {
        console.error(`[sweeper] health ${instance.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[sweeper] sweepHealth:', err.message);
  } finally {
    healthRunning = false;
  }
}

export function startSweeper() {
  if (process.env.SWEEPER_DISABLED === '1') {
    console.log('[sweeper] disabled by SWEEPER_DISABLED=1');
    return;
  }
  setInterval(sweepStuck, STUCK_EVERY_MS).unref();
  setInterval(sweepHealth, HEALTH_EVERY_MS).unref();
  // First pass shortly after boot so a redeploy doesn't delay recovery by a full interval.
  setTimeout(() => { sweepStuck(); sweepHealth(); }, 15_000).unref();
  console.log(`[sweeper] started (stuck every ${STUCK_EVERY_MS / 1000}s, health every ${HEALTH_EVERY_MS / 1000}s, stuck after ${STUCK_AFTER_MS / 60000} min)`);
}
