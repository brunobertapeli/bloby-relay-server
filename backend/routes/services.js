import { Router } from 'express';
import multer from 'multer';
import { ObjectId } from 'mongodb';
import { authenticateBlobyHeader } from '../middleware/auth.js';
import { recordTransaction } from '../lib/transactions.js';
import { getDb } from '../db.js';
import {
  tryAccountBalance,
  mppxIfNotPaid,
  baseX402IfNotPaid,
  attachReceiptHeader,
} from '../lib/payment-chain.js';
import youtubeToText from '../services/youtube-to-text.js';
import imageGen from '../services/image-gen.js';
import audioToText from '../services/audio-to-text.js';

const router = Router();

// ─── Service handlers ───────────────────────────────────────────────────────
// Each service ID maps to a handler. Signature: (body, ctx) → { contentType, body, status? }
//   ctx.paidVia: 'free' | 'balance' | 'mpp' | 'mpp-base'
//   ctx.file:           multer file object (only set for multipart routes)
//   ctx.estimatedMinutes / ctx.priceUsd / ctx.assumedBitrateBps: per-minute pricing fields

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
  'audio-to-text': audioToText,
  'test-mpp': (_body, ctx) => ({
    contentType: 'text/markdown',
    body: `PINEAPPLE-MPP-OK · paid via ${ctx.paidVia} · ${new Date().toISOString()}`,
  }),
  'easyahackathon': (_body, ctx) => ({
    contentType: 'text/markdown',
    body: `# CONSENSUS HACKATHON FTW\n\nPaid via ${ctx.paidVia} · ${new Date().toISOString()}`,
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

// Resolves `req.product.price` for `pricingModel === 'per-minute'` products.
// Estimates duration from file size + `assumedBitrateBps` (default 32 kbps).
// Must run AFTER multer and `loadService`, BEFORE the payment chain.
function applyPerMinutePricing(req, res, next) {
  if (!req.product || req.product.pricingModel !== 'per-minute') return next();
  if (!req.file) {
    return res.status(400).json({ error: 'Missing audio file (multipart field "file")' });
  }
  const assumedBitrate = req.product.assumedBitrateBps || 32000;
  const unitPriceUsd = req.product.unitPriceUsd || 0;
  const estimatedSec = (req.file.size * 8) / assumedBitrate;
  const estimatedMinutes = Math.max(1, Math.ceil(estimatedSec / 60));
  req.estimatedMinutes = estimatedMinutes;
  req.product.price = parseFloat((estimatedMinutes * unitPriceUsd).toFixed(6));
  next();
}

async function runHandler(req, res) {
  const handler = serviceHandlers[req.product.id];
  try {
    const result = await handler(req.body, {
      paidVia: req.paidVia,
      file: req.file,
      estimatedMinutes: req.estimatedMinutes,
      priceUsd: req.product.price,
      assumedBitrateBps: req.product.assumedBitrateBps,
    });

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

// ─── Multipart upload (audio-to-text) ──────────────────────────────────────
// In-memory storage (small files, ≤25MB). No temp files, no cleanup.

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // matches Groq's hard cap
});

function audioUploadHandler(req, res, next) {
  audioUpload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Audio file too large (max 25MB)' });
      }
      return res.status(400).json({ error: err.message || 'Upload error' });
    }
    next();
  });
}

// Inject `serviceId` into the params for downstream middleware (loadService
// reads `req.params.serviceId`). The explicit route bypasses the param route.
function pinServiceId(serviceId) {
  return (req, _res, next) => {
    req.params.serviceId = serviceId;
    next();
  };
}

// ─── POST /api/services/audio-to-text/use[-base] ───────────────────────────
// Specific routes registered BEFORE the parameterized /:serviceId/use routes
// so Express matches them first.

router.post(
  '/services/audio-to-text/use',
  audioUploadHandler,
  pinServiceId('audio-to-text'),
  authenticateBlobyHeader,
  loadService,
  applyPerMinutePricing,
  tryAccountBalance,
  mppxIfNotPaid,
  runHandler,
);

router.post(
  '/services/audio-to-text/use-base',
  audioUploadHandler,
  pinServiceId('audio-to-text'),
  authenticateBlobyHeader,
  loadService,
  applyPerMinutePricing,
  tryAccountBalance,
  baseX402IfNotPaid,
  runHandler,
);

// ─── POST /api/services/:serviceId/use ──────────────────────────────────────
// Order: authenticate bot → load service → try balance → fall back to MPP → run handler.
// Services are platform-served, so commission splits are skipped (treasury keeps 100%).
//
// `/use`      → x402 fallback on Tempo (USDC on Tempo Network) via mppx.
// `/use-base` → x402 fallback on Coinbase BASE (USDC on Base mainnet) via x402-express.
// Bots pick the endpoint that matches the network their wallet is funded on.
router.post(
  '/services/:serviceId/use',
  authenticateBlobyHeader,
  loadService,
  tryAccountBalance,
  mppxIfNotPaid,
  runHandler,
);

router.post(
  '/services/:serviceId/use-base',
  authenticateBlobyHeader,
  loadService,
  tryAccountBalance,
  baseX402IfNotPaid,
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
