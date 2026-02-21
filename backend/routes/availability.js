import { Router } from 'express';
import { getUsers } from '../db.js';
import { validateUsername, TIERS, buildRelayUrl } from '../lib/validate.js';

const router = Router();

/**
 * GET /api/availability/:username
 *
 * Check per-tier availability for a username.
 * The same username can be registered on different tiers independently.
 *
 * Returns: { username, valid, error?, handles: [{ tier, url, paid, price, available }] }
 */
router.get('/availability/:username', async (req, res) => {
  try {
    const raw = req.params.username;
    const uv = validateUsername(raw);

    if (!uv.valid) {
      return res.json({
        username: raw.toLowerCase().trim(),
        valid: false,
        error: uv.error,
        handles: [],
      });
    }

    // Find all existing registrations for this username (one per tier max)
    const existing = await getUsers()
      .find({ username: uv.username }, { projection: { tier: 1 } })
      .toArray();

    const takenTiers = new Set(existing.map((u) => u.tier));

    const handles = Object.entries(TIERS).map(([tier, config]) => ({
      tier,
      url: buildRelayUrl(uv.username, tier),
      paid: config.paid,
      price: config.price,
      available: !takenTiers.has(tier),
    }));

    res.json({
      username: uv.username,
      valid: true,
      handles,
    });
  } catch (error) {
    console.error('[availability]', error.message);
    res.status(500).json({ error: 'Availability check failed' });
  }
});

export default router;
