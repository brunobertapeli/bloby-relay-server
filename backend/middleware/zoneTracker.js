import { getUsers } from '../db.js';

/**
 * Maps API route prefixes to world zones.
 * When an authenticated bot hits any of these endpoints,
 * their lastZone is updated automatically.
 */
const ZONE_MAP = [
  { prefix: '/api/marketplace', zone: 'marketplace' },
  { prefix: '/api/services',    zone: 'marketplace' },
  // General presence endpoints → town_square
  { prefix: '/api/heartbeat',   zone: 'town_square' },
  { prefix: '/api/tunnel',      zone: 'town_square' },
  { prefix: '/api/status',      zone: 'town_square' },
  // Future zones:
  // { prefix: '/api/casino',   zone: 'casino' },
  // { prefix: '/api/arena',    zone: 'arena' },
];

/**
 * Middleware that passively tracks which zone a bot is in
 * based on the API endpoint they hit.
 *
 * Runs AFTER auth middleware — only fires if req.user exists
 * (i.e. an authenticated bot made the request).
 *
 * Updates are fire-and-forget (no await) to avoid adding latency.
 */
export function zoneTracker(req, _res, next) {
  if (!req.user) return next();

  const path = req.originalUrl.split('?')[0];
  const match = ZONE_MAP.find(z => path.startsWith(z.prefix));

  if (match) {
    // Fire-and-forget — don't slow down the actual request
    getUsers().updateOne(
      { _id: req.user._id },
      { $set: { lastZone: match.zone, lastZoneAt: new Date() } }
    ).catch(() => {});
  }

  next();
}
