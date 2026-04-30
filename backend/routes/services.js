import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { authenticateBlobyHeader } from '../middleware/auth.js';
import { recordTransaction } from '../lib/transactions.js';
import { getDb } from '../db.js';
import {
  tryAccountBalance,
  mppxIfNotPaid,
  attachReceiptHeader,
} from '../lib/payment-chain.js';
import youtubeToText from '../services/youtube-to-text.js';
import imageGen from '../services/image-gen.js';

const router = Router();

// ─── Service handlers ───────────────────────────────────────────────────────
// Each service ID maps to a handler. Signature: (body, ctx) → { contentType, body, status? }
//   ctx.paidVia: 'free' | 'balance' | 'mpp'

const TEST_MESSAGES = [
  '# PINEAPPLE-RADAR-7\n\nThis is a verified Bloby test service response. If your agent is reading this, the full services pipeline works: auth, transaction recording, and delivery.\n\n**Timestamp:** {{time}}',
];

const serviceHandlers = {
  test: () => {
    const msg = TEST_MESSAGES[Math.floor(Math.random() * TEST_MESSAGES.length)];
    return {
      contentType: 'text/markdown',
      body: msg.replace('{{time}}', new Date().toISOString()),
    };
  },
  'youtube-to-text': youtubeToText,
  'image-gen': imageGen,
  'test-mpp': (_body, ctx) => ({
    contentType: 'text/markdown',
    body: `PINEAPPLE-MPP-OK · paid via ${ctx.paidVia} · ${new Date().toISOString()}`,
  }),
};

// ─── Pipeline middleware (service-specific bits) ───────────────────────────

async function loadService(req, res, next) {
  const product = await getDb().collection('products').findOne({ id: req.params.serviceId, type: 'service' });
  if (!product) return res.status(404).json({ error: 'Service not found' });
  if (!serviceHandlers[req.params.serviceId]) return res.status(501).json({ error: 'Service not implemented' });
  req.product = product;
  next();
}

async function runHandler(req, res) {
  const handler = serviceHandlers[req.product.id];
  try {
    const result = await handler(req.body, { paidVia: req.paidVia });

    attachReceiptHeader(req, res);

    recordTransaction({
      productId: req.product.id,
      productType: 'service',
      productName: req.product.name,
      botUsername: req.user.username,
      accountId: req.user.accountId || null,
      unitPrice: req.product.price,
    }).catch((err) => console.error('[services] tx error:', err.message));

    const status = result.status || 200;
    res.status(status).type(result.contentType || 'application/json').send(result.body);
  } catch (err) {
    // Refund balance only if we paid via balance (MPP settled on-chain — no auto-refund)
    if (req.paidVia === 'balance' && req.product.price > 0 && req.user.accountId) {
      await getDb().collection('accounts').updateOne(
        { _id: new ObjectId(req.user.accountId) },
        { $inc: { balance: req.product.price } },
      ).catch((e) => console.error('[services] refund error:', e.message));
    }
    console.error(`[services/${req.product.id}]`, err.message);
    res.status(500).json({ error: 'Service execution failed' });
  }
}

// ─── POST /api/services/:serviceId/use ──────────────────────────────────────
// Order: authenticate bot → load service → try balance → fall back to MPP → run handler.
// Services are platform-served, so commission splits are skipped (treasury keeps 100%).
router.post(
  '/services/:serviceId/use',
  authenticateBlobyHeader,
  loadService,
  tryAccountBalance,
  mppxIfNotPaid,
  runHandler,
);

// ─── GET /api/services ──────────────────────────────────────────────────────
// List available services (public).
router.get('/services', async (_req, res) => {
  try {
    const services = await getDb().collection('products').find({ type: 'service' }).toArray();
    res.json(services);
  } catch (error) {
    console.error('[services]', error.message);
    res.status(500).json({ error: 'Failed to load services' });
  }
});

export default router;
