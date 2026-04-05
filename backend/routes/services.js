import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authenticate } from '../middleware/auth.js';
import { recordTransaction } from '../lib/transactions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

// Load catalog
const productsPath = path.join(__dirname, '..', 'data', 'products.json');
const catalog = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));

// ─── Service handlers ───────────────────────────────────────────────────────
// Each service ID maps to a handler function that returns the result.

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
};

// ─── POST /api/services/:serviceId/use ──────────────────────────────────────
// Agent calls a service. Requires bot auth. Records transaction.
router.post('/services/:serviceId/use', authenticate, async (req, res) => {
  const { serviceId } = req.params;

  const service = catalog.services?.find((s) => s.id === serviceId);
  if (!service) {
    return res.status(404).json({ error: 'Service not found' });
  }

  const handler = serviceHandlers[serviceId];
  if (!handler) {
    return res.status(501).json({ error: 'Service not implemented' });
  }

  // Record the transaction
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

  // Execute the service
  try {
    const result = handler(req.body);
    res.type(result.contentType || 'application/json').send(result.body);
  } catch (err) {
    console.error(`[services/${serviceId}]`, err.message);
    res.status(500).json({ error: 'Service execution failed' });
  }
});

// ─── GET /api/services ──────────────────────────────────────────────────────
// List available services (public).
router.get('/services', (_req, res) => {
  res.json(catalog.services || []);
});

export default router;
