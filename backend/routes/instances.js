import { Router } from 'express';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
import { jwtAuth } from '../middleware/jwtAuth.js';
import { terminateInstance, restartInstance, describeInstance } from '../lib/aws.js';
import { buildRelayUrl } from '../lib/validate.js';
import { upsertDnsRecord, deleteDnsRecord, managedHostname, cfConfigured } from '../lib/cloudflare.js';
import { provisionManagedInstance } from '../lib/provision.js';
import { instanceCallbackLimiter } from '../middleware/rateLimiter.js';

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
    res.json({ instances: account?.instances || [] });
  } catch (error) {
    console.error('[instances] GET error:', error.message);
    res.status(500).json({ error: 'Failed to fetch instances' });
  }
});

// ─── Get single instance status ─────────────────────────────────────────────
router.get('/instances/:id/status', jwtAuth, async (req, res) => {
  try {
    const db = getDb();
    console.log(`[instances] status query: accountId=${req.account.id}, instanceId=${req.params.id}`);
    const account = await db.collection('accounts').findOne(
      { _id: new ObjectId(req.account.id), 'instances.id': req.params.id },
      { projection: { 'instances.$': 1 } },
    );
    if (!account) {
      // Debug: check if account exists at all
      const acct = await db.collection('accounts').findOne(
        { _id: new ObjectId(req.account.id) },
        { projection: { 'instances.id': 1 } },
      );
      console.log(`[instances] 404 debug: account exists=${!!acct}, instanceIds=${JSON.stringify(acct?.instances?.map(i => i.id))}`);
    }
    const instance = account?.instances?.[0];
    if (!instance) return res.status(404).json({ error: 'Instance not found' });
    res.json({ instance });
  } catch (error) {
    console.error('[instances] status error:', error.message);
    res.status(500).json({ error: 'Failed to get instance status' });
  }
});

// ─── Launch new instance (disabled — now handled via Stripe webhook) ────────
// Instance creation + EC2 launch is triggered by checkout.session.completed
// in backend/routes/stripe.js. This endpoint is kept as a stub for reference.

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
router.post('/instances/callback', instanceCallbackLimiter, async (req, res) => {
  try {
    const { instanceId, status, tunnelUrl, provisionToken } = req.body;
    if (!instanceId || !status) {
      return res.status(400).json({ error: 'Missing instanceId or status' });
    }

    console.log(`[instances] Callback: ${instanceId} → ${status}${tunnelUrl ? ` (${tunnelUrl})` : ''}`);

    const db = getDb();

    // Load the instance first so we can authenticate the callback.
    const owner = await db.collection('accounts').findOne(
      { 'instances.id': instanceId },
      { projection: { _id: 1, 'instances.$': 1 } },
    );
    const inst = owner?.instances?.[0];
    if (!inst) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    if (inst.provisionTokenHash && sha256(provisionToken || '') !== inst.provisionTokenHash) {
      return res.status(403).json({ error: 'Invalid provision token' });
    }

    const update = { 'instances.$.status': status };
    if (tunnelUrl) update['instances.$.tunnelUrl'] = tunnelUrl;
    await db.collection('accounts').updateOne(
      { 'instances.id': instanceId },
      { $set: update },
    );

    // On "ready", make the bot publicly reachable + link the relay user.
    if (status === 'ready') {
      try {
        // ── MANAGED (direct) mode ──────────────────────────────────────────
        // The box has a public IP; point  mybot.bloby.bot → <IP>  as a proxied
        // (orange-cloud) CF A-record. No tunnel, no relay data-plane hop.
        if (inst.username && inst.ec2InstanceId && cfConfigured()) {
          const tier = inst.tier || 'premium';

          // The public IP can lag a few seconds behind "running" — poll briefly.
          let publicIp = inst.publicIp || null;
          for (let i = 0; !publicIp && i < 12; i++) {
            const info = await describeInstance(inst.ec2InstanceId, inst.region);
            if (info?.publicIp) { publicIp = info.publicIp; break; }
            await new Promise((r) => setTimeout(r, 2500));
          }

          if (publicIp) {
            const hostname = managedHostname(inst.username, tier);
            const dnsRecordId = await upsertDnsRecord(hostname, publicIp);
            const relayUrl = buildRelayUrl(inst.username, tier);
            await db.collection('accounts').updateOne(
              { 'instances.id': instanceId },
              { $set: {
                'instances.$.publicIp': publicIp,
                'instances.$.dnsRecordId': dnsRecordId,
                'instances.$.relayUrl': relayUrl,
              }},
            );
            // Link the pre-registered relay handle to this account.
            await db.collection('users').updateOne(
              { username: inst.username, tier },
              { $set: { accountId: owner._id } },
            );
            console.log(`[instances] managed ${inst.username} → ${hostname} → ${publicIp} (dns ${dnsRecordId})`);
          } else {
            console.error(`[instances] ${instanceId} ready but no public IP yet`);
          }

        // ── LEGACY tunnel mode ─────────────────────────────────────────────
        // Older AMIs report a tunnelUrl; link the relay user by it (unchanged).
        } else if (inst.tunnelUrl) {
          const user = await db.collection('users').findOne({ tunnelUrl: inst.tunnelUrl });
          if (user) {
            await db.collection('users').updateOne(
              { _id: user._id },
              { $set: { accountId: owner._id } },
            );
            const relayUrl = buildRelayUrl(user.username, user.tier);
            await db.collection('accounts').updateOne(
              { 'instances.id': instanceId },
              { $set: { 'instances.$.relayUrl': relayUrl } },
            );
            console.log(`[instances] Linked user ${user.username} (${user.tier}) → account ${owner._id}, relayUrl: ${relayUrl}`);
          } else {
            console.log(`[instances] No relay user found for tunnelUrl: ${inst.tunnelUrl}`);
          }
        }
      } catch (linkErr) {
        console.error('[instances] ready handling failed:', linkErr.message);
      }
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

    if (instance.ec2InstanceId) {
      await db.collection('accounts').updateOne(
        { 'instances.id': req.params.id },
        { $set: { 'instances.$.status': 'restarting' } },
      );

      // Fire and forget — restart EC2, then update status when done
      const instId = req.params.id;
      restartInstance(instance.ec2InstanceId, instance.region)
        .then(async () => {
          // A stop+start assigns a NEW public IP — refresh the managed CF A-record
          // so mybot.bloby.bot keeps resolving to the live box.
          if (instance.username && cfConfigured()) {
            try {
              const tier = instance.tier || 'premium';
              let publicIp = null;
              for (let i = 0; !publicIp && i < 12; i++) {
                const info = await describeInstance(instance.ec2InstanceId, instance.region);
                if (info?.publicIp) { publicIp = info.publicIp; break; }
                await new Promise((r) => setTimeout(r, 2500));
              }
              if (publicIp) {
                const dnsRecordId = await upsertDnsRecord(managedHostname(instance.username, tier), publicIp);
                await db.collection('accounts').updateOne(
                  { 'instances.id': instId },
                  { $set: { 'instances.$.publicIp': publicIp, 'instances.$.dnsRecordId': dnsRecordId } },
                );
                console.log(`[instances] ${instId} restart → new IP ${publicIp}, DNS refreshed`);
              }
            } catch (dnsErr) {
              console.error(`[instances] ${instId} DNS refresh after restart failed:`, dnsErr.message);
            }
          }
          // Give bloby ~15s to come up after EC2 is running
          await new Promise(r => setTimeout(r, 15000));
          await db.collection('accounts').updateOne(
            { 'instances.id': instId },
            { $set: { 'instances.$.status': 'ready' } },
          );
          console.log(`[instances] ${instId} restart complete → ready`);
        })
        .catch(async (err) => {
          console.error(`[instances] ${instId} restart failed:`, err.message);
          await db.collection('accounts').updateOne(
            { 'instances.id': instId },
            { $set: { 'instances.$.status': 'failed' } },
          );
        });
    }

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

    // Terminate EC2 instance if it exists
    if (instance?.ec2InstanceId) {
      terminateInstance(instance.ec2InstanceId, instance.region).catch(err => {
        console.error(`[instances] terminate EC2 failed:`, err.message);
      });
    }

    // Remove the managed CF DNS record (best-effort) so the handle frees cleanly.
    if (instance?.dnsRecordId) {
      deleteDnsRecord(instance.dnsRecordId).catch(err => {
        console.error(`[instances] delete DNS record failed:`, err.message);
      });
    }

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
