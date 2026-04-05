import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
import { jwtAuth } from '../middleware/jwtAuth.js';
import { terminateInstance, restartInstance, describeInstance } from '../lib/aws.js';
import { buildRelayUrl } from '../lib/validate.js';
import { instanceCallbackLimiter } from '../middleware/rateLimiter.js';

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

// ─── Provisioning callback (called by the instance's provision.sh) ──────────
router.post('/instances/callback', instanceCallbackLimiter, async (req, res) => {
  try {
    const { instanceId, status, tunnelUrl } = req.body;
    if (!instanceId || !status) {
      return res.status(400).json({ error: 'Missing instanceId or status' });
    }

    console.log(`[instances] Callback: ${instanceId} → ${status}${tunnelUrl ? ` (${tunnelUrl})` : ''}`);

    const db = getDb();
    const update = { 'instances.$.status': status };
    if (tunnelUrl) update['instances.$.tunnelUrl'] = tunnelUrl;

    const result = await db.collection('accounts').updateOne(
      { 'instances.id': instanceId },
      { $set: update },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    // When instance is ready, link the relay user to the account
    // Read the instance from DB to get tunnelUrl (it may have been set by an earlier callback)
    if (status === 'ready') {
      try {
        const account = await db.collection('accounts').findOne(
          { 'instances.id': instanceId },
          { projection: { _id: 1, 'instances.$': 1 } },
        );
        const inst = account?.instances?.[0];
        const instTunnelUrl = inst?.tunnelUrl;
        if (account && instTunnelUrl) {
          // Find the relay user by tunnelUrl and link to account
          const user = await db.collection('users').findOne({ tunnelUrl: instTunnelUrl });
          if (user) {
            await db.collection('users').updateOne(
              { _id: user._id },
              { $set: { accountId: account._id } },
            );
            // Store the relay URL on the instance so dashboard can show it
            const relayUrl = buildRelayUrl(user.username, user.tier);
            await db.collection('accounts').updateOne(
              { 'instances.id': instanceId },
              { $set: { 'instances.$.relayUrl': relayUrl } },
            );
            console.log(`[instances] Linked user ${user.username} (${user.tier}) → account ${account._id}, relayUrl: ${relayUrl}`);
          } else {
            console.log(`[instances] No relay user found for tunnelUrl: ${instTunnelUrl}`);
          }
        }
      } catch (linkErr) {
        console.error('[instances] account-user link failed:', linkErr.message);
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
          // Give bloby/cloudflared ~15s to start after EC2 is running
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
