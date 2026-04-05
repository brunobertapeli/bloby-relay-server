import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

/**
 * GET /api/health
 *
 * Liveness / readiness check for Railway and monitoring.
 */
router.get('/health', async (req, res) => {
  try {
    const db = getDb();
    let mongo = 'disconnected';

    if (db) {
      await db.command({ ping: 1 });
      mongo = 'connected';
    }

    res.json({
      status: 'ok',
      service: 'bloby-relay',
      mongo,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'degraded',
      service: 'bloby-relay',
      mongo: 'error',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
