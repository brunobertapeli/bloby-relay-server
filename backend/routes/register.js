import { Router } from 'express';
import { getUsers, getDb } from '../db.js';
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

/**
 * POST /api/handle/claim-reserved
 *
 * Activate a reserved (purchased) premium handle using the activation code.
 * Verifies the code against reservedHandles in accounts, then registers in users.
 *
 * Body:     { handle: string, hash: string }
 * Returns:  { username, tier, token, relayUrl }
 */
router.post('/handle/claim-reserved', registerLimiter, async (req, res) => {
  try {
    const { handle, hash } = req.body;
    if (!handle || !hash) {
      return res.status(400).json({ error: 'Handle and activation code are required' });
    }

    const uv = validateUsername(handle);
    if (!uv.valid) return res.status(400).json({ error: uv.error });

    const db = getDb();

    // Find the account that has this handle reserved with matching hash
    const account = await db.collection('accounts').findOne({
      reservedHandles: { $elemMatch: { handle: uv.username, hash } },
    });

    if (!account) {
      return res.status(403).json({ error: 'Invalid activation code' });
    }

    // Register the handle in users collection
    const { raw, hash: tokenHash } = generateToken();
    const now = new Date();

    try {
      await getUsers().insertOne({
        username: uv.username,
        tier: 'premium',
        tokenHash,
        tunnelUrl: null,
        isOnline: false,
        lastHeartbeat: null,
        createdAt: now,
        updatedAt: now,
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ error: 'This handle is already activated' });
      }
      throw err;
    }

    res.status(201).json({
      username: uv.username,
      tier: 'premium',
      token: raw,
      relayUrl: buildRelayUrl(uv.username, 'premium'),
    });
  } catch (error) {
    console.error('[claim-reserved]', error.message);
    res.status(500).json({ error: 'Claim failed' });
  }
});

export default router;
