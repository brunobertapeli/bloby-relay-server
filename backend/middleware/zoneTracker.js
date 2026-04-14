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

  if (!match) {
    console.log(`[zone] no match for path: ${path}`);
    return next();
  }

  console.log(`[zone] matched path: ${path} → zone: ${match.zone}`);

  // If auth middleware already identified the user, use that
  if (req.user) {
    console.log(`[zone] req.user exists: ${req.user.username}, updating zone`);
    getUsers().updateOne(
      { _id: req.user._id },
      { $set: { lastZone: match.zone, lastZoneAt: new Date() } }
    ).then(r => console.log(`[zone] update result (user):`, r.modifiedCount))
     .catch(e => console.error(`[zone] update error:`, e.message));
    return next();
  }

  // Otherwise try to resolve the bot from the token (for public endpoints)
  const header = req.headers.authorization;
  console.log(`[zone] no req.user, auth header present: ${!!header}`);

  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7);
    console.log(`[zone] token length: ${token.length}, valid hex: ${/^[a-f0-9]{64}$/.test(token)}`);
    if (token.length === 64 && /^[a-f0-9]{64}$/.test(token)) {
      const tokenHash = hashToken(token);
      getUsers().updateOne(
        { tokenHash },
        { $set: { lastZone: match.zone, lastZoneAt: new Date() } }
      ).then(r => console.log(`[zone] update result (token):`, r.modifiedCount))
       .catch(e => console.error(`[zone] update error:`, e.message));
    }
  } else {
    console.log(`[zone] no valid auth header, skipping`);
  }

  next();
}
