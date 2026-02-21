import { hashToken } from '../lib/token.js';
import { getUsers } from '../db.js';

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
