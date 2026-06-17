import { Router } from 'express';
import { getUsers } from '../db.js';

// Keep in sync with routes/resolve.js — both read HEARTBEAT_TIMEOUT_MS, which must be
// >3× the agent's 120s heartbeat interval (shared/relay.ts). Default 360s.
const HEARTBEAT_TIMEOUT = parseInt(process.env.HEARTBEAT_TIMEOUT_MS || '360000', 10);

const router = Router();

/**
 * GET /api/status/:username
 *
 * Public endpoint — check whether a bot is online.
 *
 * Returns: { username, online, lastSeen }
 */
router.get('/status/:username', async (req, res) => {
  try {
    const username = req.params.username.toLowerCase().trim();

    const user = await getUsers().findOne(
      { username },
      { projection: { username: 1, isOnline: 1, lastHeartbeat: 1 } },
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const stale =
      user.lastHeartbeat &&
      Date.now() - user.lastHeartbeat.getTime() > HEARTBEAT_TIMEOUT;

    const online = user.isOnline && !stale;

    // Lazily mark offline when stale
    if (user.isOnline && stale) {
      getUsers()
        .updateOne({ _id: user._id }, { $set: { isOnline: false } })
        .catch(() => {});
    }

    res.json({
      username: user.username,
      online,
      lastSeen: user.lastHeartbeat || null,
    });
  } catch (error) {
    console.error('[status]', error.message);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

export default router;
