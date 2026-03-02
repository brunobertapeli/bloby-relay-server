import { Router } from 'express';
import dns from 'node:dns/promises';
import { getUsers } from '../db.js';
import { validateTunnelUrl } from '../lib/validate.js';
import { authenticate } from '../middleware/auth.js';
import { tunnelLimiter, heartbeatLimiter } from '../middleware/rateLimiter.js';

const router = Router();

/**
 * Resolve a tunnel hostname from Railway's DNS until it succeeds.
 * Prevents negative DNS caching (NXDOMAIN) from poisoning the resolver
 * before any proxy request tries to use the hostname.
 */
async function warmDns(tunnelUrl) {
  let hostname;
  try { hostname = new URL(tunnelUrl).hostname; } catch { return false; }

  for (let i = 0; i < 30; i++) {
    try {
      await dns.resolve4(hostname);
      console.log(`[dns] ${hostname} resolved after ${i + 1} attempt(s)`);
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  console.warn(`[dns] ${hostname} failed to resolve after 30 attempts`);
  return false;
}

/**
 * PUT /api/tunnel
 *
 * Update the tunnel URL for the authenticated bot.
 * Called on every bot restart after a new Cloudflare tunnel is created.
 *
 * Headers:  Authorization: Bearer <token>
 * Body:     { tunnelUrl: string }
 * Returns:  { success, username, tunnelUrl }
 */
router.put('/tunnel', authenticate, tunnelLimiter, async (req, res) => {
  try {
    const validation = validateTunnelUrl(req.body.tunnelUrl);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    await getUsers().updateOne(
      { _id: req.user._id },
      {
        $set: {
          tunnelUrl: validation.url,
          isOnline: true,
          lastHeartbeat: new Date(),
          updatedAt: new Date(),
        },
      },
    );

    // Warm Railway's DNS cache before responding — prevents ENOTFOUND 502s
    // The supervisor awaits this response, so the URL won't be shown until
    // Railway can actually resolve the tunnel hostname.
    const dnsReady = await warmDns(validation.url);

    res.json({
      success: true,
      username: req.user.username,
      tunnelUrl: validation.url,
      dnsReady,
    });
  } catch (error) {
    console.error('[tunnel]', error.message);
    res.status(500).json({ error: 'Failed to update tunnel URL' });
  }
});

/**
 * POST /api/heartbeat
 *
 * Keep the bot marked as online.  Optionally update the tunnel URL.
 *
 * Headers:  Authorization: Bearer <token>
 * Body:     { tunnelUrl?: string }
 * Returns:  { success, username }
 */
router.post('/heartbeat', authenticate, heartbeatLimiter, async (req, res) => {
  try {
    const update = {
      isOnline: true,
      lastHeartbeat: new Date(),
      updatedAt: new Date(),
    };

    if (req.body.tunnelUrl) {
      const validation = validateTunnelUrl(req.body.tunnelUrl);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
      update.tunnelUrl = validation.url;
    }

    await getUsers().updateOne({ _id: req.user._id }, { $set: update });

    res.json({ success: true, username: req.user.username });
  } catch (error) {
    console.error('[heartbeat]', error.message);
    res.status(500).json({ error: 'Heartbeat failed' });
  }
});

/**
 * POST /api/disconnect
 *
 * Explicitly mark the bot as offline (graceful shutdown).
 *
 * Headers:  Authorization: Bearer <token>
 * Returns:  { success }
 */
router.post('/disconnect', authenticate, async (req, res) => {
  try {
    await getUsers().updateOne(
      { _id: req.user._id },
      {
        $set: {
          isOnline: false,
          tunnelUrl: null,
          updatedAt: new Date(),
        },
      },
    );

    res.json({ success: true });
  } catch (error) {
    console.error('[disconnect]', error.message);
    res.status(500).json({ error: 'Disconnect failed' });
  }
});

/**
 * DELETE /api/handle
 *
 * Remove the authenticated user's handle, freeing it for others.
 *
 * Headers:  Authorization: Bearer <token>
 * Returns:  { success, username }
 */
router.delete('/handle', authenticate, async (req, res) => {
  try {
    await getUsers().deleteOne({ _id: req.user._id });
    res.json({ success: true, username: req.user.username });
  } catch (error) {
    console.error('[handle:delete]', error.message);
    res.status(500).json({ error: 'Failed to release handle' });
  }
});

export default router;
