import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
import { jwtAuth } from '../middleware/jwtAuth.js';

const router = Router();

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

router.post('/instances', jwtAuth, async (req, res) => {
  try {
    const { plan, region, tunnelUrl } = req.body;
    if (!plan || !region) {
      return res.status(400).json({ error: 'Missing plan or region' });
    }

    const instance = {
      id: new ObjectId().toString(),
      plan,
      region,
      tunnelUrl: tunnelUrl || null,
      status: 'running',
      createdAt: new Date(),
    };

    const db = getDb();
    await db.collection('accounts').updateOne(
      { _id: new ObjectId(req.account.id) },
      { $push: { instances: instance } },
    );

    res.status(201).json({ instance });
  } catch (error) {
    console.error('[instances] POST error:', error.message);
    res.status(500).json({ error: 'Failed to create instance' });
  }
});

router.post('/instances/:id/restart', jwtAuth, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.collection('accounts').updateOne(
      { _id: new ObjectId(req.account.id), 'instances.id': req.params.id },
      { $set: { 'instances.$.status': 'running' } },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('[instances] restart error:', error.message);
    res.status(500).json({ error: 'Failed to restart instance' });
  }
});

router.delete('/instances/:id', jwtAuth, async (req, res) => {
  try {
    const db = getDb();
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
