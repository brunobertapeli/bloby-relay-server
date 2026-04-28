import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { hashToken } from '../lib/token.js';
import { recordTransaction } from '../lib/transactions.js';
import { getDb, getUsers } from '../db.js';
import { getMppx } from '../lib/mpp.js';
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

// ─── Bot auth ───────────────────────────────────────────────────────────────
// Reads bot identity from `X-Bloby-Token` first (so the bot's identity survives
// an MPP 402 → retry, since the mppx client strips the Authorization header on
// retry to inject the Payment credential). Falls back to `Authorization: Bearer`
// for backward compatibility with existing curl/manual callers.

async function botAuth(req, res, next) {
  let token = req.headers['x-bloby-token'];
  if (!token) {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) token = auth.slice(7);
  }
  if (!token || token.length !== 64 || !/^[a-f0-9]{64}$/.test(token)) {
    return res.status(401).json({ error: 'Missing or invalid bot token (X-Bloby-Token or Authorization: Bearer)' });
  }
  try {
    const user = await getUsers().findOne({ tokenHash: hashToken(token) });
    if (!user) return res.status(401).json({ error: 'Invalid token' });
    req.user = user;
    next();
  } catch (error) {
    console.error('[services/auth]', error.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

// ─── Pipeline middleware ────────────────────────────────────────────────────

async function loadService(req, res, next) {
  const service = await getDb().collection('products').findOne({ id: req.params.serviceId, type: 'service' });
  if (!service) return res.status(404).json({ error: 'Service not found' });
  if (!serviceHandlers[req.params.serviceId]) return res.status(501).json({ error: 'Service not implemented' });
  req.service = service;
  next();
}

// Try the user's account credit balance first. Sets req.paidVia='balance' on success.
async function tryAccountBalance(req, res, next) {
  const { service } = req;
  if (service.price === 0) {
    req.paidVia = 'free';
    return next();
  }
  if (!req.user.accountId) return next(); // unclaimed → fall through to MPP

  const accountId = new ObjectId(req.user.accountId);
  const result = await getDb().collection('accounts').updateOne(
    { _id: accountId, balance: { $gte: service.price } },
    { $inc: { balance: -service.price } },
  );
  if (result.modifiedCount === 1) req.paidVia = 'balance';
  next();
}

// Fall through to MPP: if the balance path didn't pay, run the mppx charge
// handler programmatically. On 402, write the challenge response. On 200,
// stash the receipt-wrapper on req for runHandler to attach.
async function mppxIfNotPaid(req, res, next) {
  if (req.paidVia) return next();

  let mppx;
  try { mppx = getMppx(); }
  catch (err) { console.error('[services/mpp]', err.message); return res.status(500).json({ error: 'Payment system unavailable' }); }

  const url = `${req.protocol}://${req.hostname}${req.originalUrl}`;
  const request = new Request(url, { method: req.method, headers: req.headers });

  const result = await mppx.charge({ amount: String(req.service.price) })(request);

  if (result.status === 402) {
    const c = result.challenge;
    res.status(c.status);
    for (const [key, value] of c.headers) res.setHeader(key, value);
    return res.send(await c.text());
  }

  req.paidVia = 'mpp';
  req.mppxWithReceipt = result.withReceipt;
  next();
}

async function runHandler(req, res) {
  const handler = serviceHandlers[req.service.id];
  try {
    const result = await handler(req.body, { paidVia: req.paidVia });

    // Attach Payment-Receipt header for MPP-paid responses
    if (req.mppxWithReceipt) {
      const wrapped = req.mppxWithReceipt(new Response(String(result.body ?? '')));
      const receipt = wrapped.headers.get('Payment-Receipt');
      if (receipt) res.setHeader('Payment-Receipt', receipt);
    }

    recordTransaction({
      productId: req.service.id,
      productType: 'service',
      productName: req.service.name,
      botUsername: req.user.username,
      accountId: req.user.accountId || null,
      unitPrice: req.service.price,
    }).catch((err) => console.error('[services] tx error:', err.message));

    const status = result.status || 200;
    res.status(status).type(result.contentType || 'application/json').send(result.body);
  } catch (err) {
    // Refund balance only if we paid via balance (MPP settled on-chain — no auto-refund)
    if (req.paidVia === 'balance' && req.service.price > 0 && req.user.accountId) {
      await getDb().collection('accounts').updateOne(
        { _id: new ObjectId(req.user.accountId) },
        { $inc: { balance: req.service.price } },
      ).catch((e) => console.error('[services] refund error:', e.message));
    }
    console.error(`[services/${req.service.id}]`, err.message);
    res.status(500).json({ error: 'Service execution failed' });
  }
}

// ─── POST /api/services/:serviceId/use ──────────────────────────────────────
// Order: identify bot → load service → try balance → fall back to MPP → run handler.
router.post(
  '/services/:serviceId/use',
  botAuth,
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
