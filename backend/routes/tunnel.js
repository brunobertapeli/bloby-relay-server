import { Router } from 'express';
import dns from 'node:dns/promises';
import { getUsers } from '../db.js';
import { validateTunnelUrl } from '../lib/validate.js';
import { authenticate } from '../middleware/auth.js';
import { tunnelLimiter, heartbeatLimiter } from '../middleware/rateLimiter.js';
import { invalidateUserCache } from './resolve.js';
import { edgeSyncTunnel, edgeTouch, edgeClear } from '../lib/edge.js';

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
    invalidateUserCache(req.user.username); // resolve.js micro-cache must see the new URL now
    edgeSyncTunnel(req.user.username, req.user.tier, validation.url); // mirror to the CF edge (no-op if unconfigured)

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
 * POST /api/wallet
 *
 * The bot reports its agent wallet address once it holds a relay token. Managed
 * (tunnel-off) bots never heartbeat or call register, so this is how their wallet
 * reaches the relay for the dashboard. Fill-only: it won't overwrite a wallet the
 * user has already set/rotated to a different address.
 *
 * Headers:  Authorization: Bearer <token>
 * Body:     { walletAddress: string }
 */
router.post('/wallet', authenticate, async (req, res) => {
  try {
    const addr = (req.body.walletAddress || '').trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }
    await getUsers().updateOne(
      { _id: req.user._id, $or: [{ walletAddress: null }, { walletAddress: { $exists: false } }, { walletAddress: addr }] },
      { $set: { walletAddress: addr, updatedAt: new Date() } },
    );
    res.json({ success: true });
  } catch (error) {
    console.error('[wallet]', error.message);
    res.status(500).json({ error: 'Failed to set wallet' });
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
      // Refresh world-map presence in this SAME write. The zoneTracker middleware used to
      // do a separate updateOne on every heartbeat (doubling the per-beat write load) AND
      // dragged the bot back to town_square each beat. Folding only the timestamp here keeps
      // the dot on the map in its actual last zone, at zero extra write cost.
      lastZoneAt: new Date(),
    };

    let rotatedTunnel = null;
    if (req.body.tunnelUrl) {
      const validation = validateTunnelUrl(req.body.tunnelUrl);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
      // Only treat this as a rotation when the URL actually CHANGED. The agent includes its
      // tunnelUrl on every heartbeat, so comparing against the stored value avoids warming
      // DNS + invalidating the resolve micro-cache on every single beat — the source of the
      // "[dns] <host> resolved after N attempt(s)" log flood.
      if (validation.url !== req.user.tunnelUrl) {
        update.tunnelUrl = validation.url;
        rotatedTunnel = validation.url;
      }
    }

    await getUsers().updateOne({ _id: req.user._id }, { $set: update });
    if (rotatedTunnel) invalidateUserCache(req.user.username); // routing changed mid-TTL

    // Mirror liveness/rotation to the CF edge worker (no-op if unconfigured). The stored
    // tunnelUrl rides along so a touch can self-heal a missing route (see lib/edge.js).
    if (rotatedTunnel) edgeSyncTunnel(req.user.username, req.user.tier, rotatedTunnel);
    else edgeTouch(req.user.username, req.user.tier, req.user.tunnelUrl || null);

    // If the heartbeat carried a rotated tunnel URL, warm Railway's DNS in the background so the
    // next proxy hit doesn't ENOTFOUND. Fire-and-forget — never delay the heartbeat cadence.
    if (rotatedTunnel) warmDns(rotatedTunnel).catch(() => {});

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
    invalidateUserCache(req.user.username); // go offline immediately, not after the TTL
    edgeClear(req.user.username, req.user.tier); // edge falls through to Railway's offline page

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
    invalidateUserCache(req.user.username);
    edgeClear(req.user.username, req.user.tier); // freed handle must stop routing at the edge too
    res.json({ success: true, username: req.user.username });
  } catch (error) {
    console.error('[handle:delete]', error.message);
    res.status(500).json({ error: 'Failed to release handle' });
  }
});

export default router;
