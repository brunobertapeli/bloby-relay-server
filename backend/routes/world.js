import { Router } from 'express';
import { getUsers } from '../db.js';

const router = Router();

const PRESENCE_WINDOW_MS = 30 * 1000; // 30 seconds

/**
 * GET /api/world/presence
 *
 * Returns all blobies that have been active in a zone within the last 5 minutes.
 * Used by the world map frontend to place dots on the map.
 *
 * Response: { blobies: [{ username, zone, lastZoneAt, isOnline }] }
 */
router.get('/world/presence', async (_req, res) => {
  try {
    const cutoff = new Date(Date.now() - PRESENCE_WINDOW_MS);

    const blobies = await getUsers()
      .find(
        { lastZone: { $exists: true }, lastZoneAt: { $gte: cutoff } },
        { projection: { username: 1, lastZone: 1, lastZoneAt: 1, isOnline: 1, _id: 0 } }
      )
      .sort({ lastZoneAt: -1 })
      .limit(500)
      .toArray();

    // Rename lastZone → zone for the frontend
    const result = blobies.map(b => ({
      username: b.username,
      zone: b.lastZone,
      lastZoneAt: b.lastZoneAt,
      isOnline: b.isOnline,
    }));

    res.json({ blobies: result });
  } catch (error) {
    console.error('[world] presence error:', error.message);
    res.status(500).json({ error: 'Failed to fetch presence' });
  }
});

export default router;
