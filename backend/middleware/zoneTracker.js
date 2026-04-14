import { getUsers } from '../db.js';
import { hashToken } from '../lib/token.js';

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
 * Works on ALL requests — even unauthenticated ones.
 * If req.user isn't set by prior auth middleware, it tries
 * to resolve the bot from the Authorization header itself.
 *
 * Updates are fire-and-forget (no await) to avoid adding latency.
 */
export function zoneTracker(req, _res, next) {
  const path = req.originalUrl.split('?')[0];
  const match = ZONE_MAP.find(z => path.startsWith(z.prefix));
  if (!match) return next();

  // If auth middleware already identified the user, use that
  if (req.user) {
    getUsers().updateOne(
      { _id: req.user._id },
      { $set: { lastZone: match.zone, lastZoneAt: new Date() } }
    ).catch(() => {});
    return next();
  }

  // Otherwise try to resolve the bot from the token (for public endpoints)
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7);
    if (token.length === 64 && /^[a-f0-9]{64}$/.test(token)) {
      const tokenHash = hashToken(token);
      getUsers().updateOne(
        { tokenHash },
        { $set: { lastZone: match.zone, lastZoneAt: new Date() } }
      ).catch(() => {});
    }
  }

  next();
}
