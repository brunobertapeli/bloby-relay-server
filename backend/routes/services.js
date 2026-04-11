import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { recordTransaction } from '../lib/transactions.js';
import { getDb } from '../db.js';
import youtubeToText from '../services/youtube-to-text.js';
import imageGen from '../services/image-gen.js';

const router = Router();

// ─── Service handlers ───────────────────────────────────────────────────────
// Each service ID maps to a handler function that returns the result.
// Handlers can be sync or async.

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
};

// ─── POST /api/services/:serviceId/use ──────────────────────────────────────
// Agent calls a service. Requires bot auth. Records transaction.
router.post('/services/:serviceId/use', authenticate, async (req, res) => {
  const { serviceId } = req.params;

  const service = await getDb().collection('products').findOne({ id: serviceId, type: 'service' });
  if (!service) {
    return res.status(404).json({ error: 'Service not found' });
  }

  const handler = serviceHandlers[serviceId];
  if (!handler) {
    return res.status(501).json({ error: 'Service not implemented' });
  }

  // Execute the service
  try {
    const result = await handler(req.body);

    // Record the transaction only on success
    try {
      await recordTransaction({
        productId: service.id,
        productType: 'service',
        productName: service.name,
        botUsername: req.user.username,
        accountId: req.user.accountId || null,
        unitPrice: service.price,
      });
    } catch (err) {
      console.error('[services] tx error:', err.message);
    }

    const status = result.status || 200;
    res.status(status).type(result.contentType || 'application/json').send(result.body);
  } catch (err) {
    console.error(`[services/${serviceId}]`, err.message);
    res.status(500).json({ error: 'Service execution failed' });
  }
});

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
