import { Router } from 'express';
import crypto from 'node:crypto';
import { getDb, getUsers } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CODE_LENGTH = 6;

function getPairingCodes() {
  return getDb().collection('pairing_codes');
}

/**
 * POST /api/extension/pair/create
 *
 * Generate a 6-digit pairing code for the Chrome extension.
 * Called by the bot (authenticated via relay token).
 *
 * Headers:  Authorization: Bearer <relay-token>
 * Returns:  { code, expiresAt }
 */
router.post('/extension/pair/create', authenticate, async (req, res) => {
  try {
    // Generate a 6-digit numeric code
    const code = String(crypto.randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);

    // Delete any existing codes for this user
    await getPairingCodes().deleteMany({ userId: req.user._id });

    // Store the code
    await getPairingCodes().insertOne({
      code,
      userId: req.user._id,
      username: req.user.username,
      tier: req.user.tier,
      tunnelUrl: req.user.tunnelUrl,
      expiresAt,
      createdAt: new Date(),
    });

    console.log(`[extension] Pairing code created for ${req.user.username}: ${code} (expires ${expiresAt.toISOString()})`);

    res.json({ code, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    console.error('[extension] pair/create error:', error.message);
    res.status(500).json({ error: 'Failed to create pairing code' });
  }
});

/**
 * POST /api/extension/pair/verify
 *
 * Verify a pairing code and return connection details.
 * Called by the Chrome extension (unauthenticated).
 *
 * Body:     { code: string }
 * Returns:  { serverUrl, username, tier }
 */
router.post('/extension/pair/verify', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || typeof code !== 'string' || code.length !== CODE_LENGTH) {
      return res.status(400).json({ error: 'Invalid code format' });
    }

    // Find and delete the code (one-time use)
    const pairing = await getPairingCodes().findOneAndDelete({
      code,
      expiresAt: { $gt: new Date() },
    });

    if (!pairing) {
      console.log(`[extension] Invalid or expired pairing code: ${code}`);
      return res.status(404).json({ error: 'Invalid or expired code' });
    }

    // Get the user's current tunnel URL and relay info
    const user = await getUsers().findOne(
      { _id: pairing.userId },
      { projection: { username: 1, tier: 1, tunnelUrl: 1 } },
    );

    if (!user) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Build the server URL from the relay subdomain
    const domain = process.env.RELAY_DOMAIN || 'bloby.bot';
    let serverUrl;
    if (user.tier === 'premium') {
      serverUrl = `https://${user.username}.${domain}`;
    } else {
      serverUrl = `https://${user.username}.my.${domain}`;
    }

    console.log(`[extension] Pairing verified for ${user.username} → ${serverUrl}`);

    res.json({
      serverUrl,
      username: user.username,
      tier: user.tier,
    });
  } catch (error) {
    console.error('[extension] pair/verify error:', error.message);
    res.status(500).json({ error: 'Verification failed' });
  }
});

export default router;
