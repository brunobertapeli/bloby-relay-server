import { Router } from 'express';
import { getUsers } from '../db.js';
import { generateToken } from '../lib/token.js';
import { validateUsername, validateTier, buildRelayUrl } from '../lib/validate.js';
import { registerLimiter } from '../middleware/rateLimiter.js';

const router = Router();

/**
 * POST /api/register
 *
 * Register a new username with a chosen tier.
 * The token is returned ONCE — the caller must store it securely.
 *
 * Body:     { username: string, tier: "premium" | "at" }
 * Returns:  { username, tier, token, relayUrl }
 */
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const uv = validateUsername(req.body.username);
    if (!uv.valid) return res.status(400).json({ error: uv.error });

    const tv = validateTier(req.body.tier);
    if (!tv.valid) return res.status(400).json({ error: tv.error });

    const { raw, hash } = generateToken();
    const now = new Date();

    try {
      await getUsers().insertOne({
        username: uv.username,
        tier: tv.tier,
        tokenHash: hash,
        tunnelUrl: null,
        isOnline: false,
        lastHeartbeat: null,
        createdAt: now,
        updatedAt: now,
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ error: 'This handle is already taken' });
      }
      throw err;
    }

    res.status(201).json({
      username: uv.username,
      tier: tv.tier,
      token: raw,
      relayUrl: buildRelayUrl(uv.username, tv.tier),
    });
  } catch (error) {
    console.error('[register]', error.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

export default router;
