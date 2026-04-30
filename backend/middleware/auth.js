import { hashToken } from '../lib/token.js';
import { getUsers } from '../db.js';

/**
 * Optional bearer-token authentication.
 * If the request has a valid token, attaches req.user. Otherwise continues without it.
 * Use this when bot identity is nice-to-have (e.g. recording transactions on downloads).
 */
export async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();

  const token = header.slice(7);
  if (!token || token.length !== 64 || !/^[a-f0-9]{64}$/.test(token)) return next();

  try {
    const tokenHash = hashToken(token);
    const user = await getUsers().findOne({ tokenHash });
    if (user) req.user = user;
  } catch { /* silent — optional auth */ }
  next();
}

/**
 * Bearer-token authentication middleware.
 * Hashes the incoming token and looks it up in the users collection.
 * Attaches the matched user document to `req.user`.
 */
export async function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = header.slice(7);

  // A valid raw token is 64 hex chars (32 bytes)
  if (!token || token.length !== 64 || !/^[a-f0-9]{64}$/.test(token)) {
    return res.status(401).json({ error: 'Invalid token format' });
  }

  try {
    const tokenHash = hashToken(token);
    const user = await getUsers().findOne({ tokenHash });

    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('[auth] Error:', error.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Bot authentication via `X-Bloby-Token` header (preferred) or
 * `Authorization: Bearer` (fallback).
 *
 * Use this on any endpoint that may go through the MPP 402 → retry flow:
 * the mppx client strips Authorization on retry to inject the Payment
 * credential, so bot identity needs a separate header to survive the
 * second leg.
 */
export async function authenticateBlobyHeader(req, res, next) {
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
    console.error('[auth/bloby-header]', error.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
}
