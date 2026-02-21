import { Router } from 'express';
import { getUsers } from '../db.js';
import { generateToken } from '../lib/token.js';
import { validateUsername } from '../lib/validate.js';
import { registerLimiter } from '../middleware/rateLimiter.js';

const router = Router();

/**
 * POST /api/register
 *
 * Register a new username and receive an auth token.
 * The token is returned ONCE — the caller must store it securely.
 *
 * Body:     { username: string }
 * Returns:  { username, token, relayUrl }
 */
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const validation = validateUsername(req.body.username);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const { raw, hash } = generateToken();
    const now = new Date();

    try {
      await getUsers().insertOne({
        username: validation.username,
        tokenHash: hash,
        tunnelUrl: null,
        isOnline: false,
        lastHeartbeat: null,
        createdAt: now,
        updatedAt: now,
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ error: 'Username is already taken' });
      }
      throw err;
    }

    const domain = process.env.RELAY_DOMAIN || 'fluxy.bot';

    res.status(201).json({
      username: validation.username,
      token: raw,
      relayUrl: `https://${validation.username}.${domain}`,
    });
  } catch (error) {
    console.error('[register]', error.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

export default router;
