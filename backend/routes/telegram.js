/**
 * Telegram channel — relay-side PROVISIONING only.
 *
 * The relay is "Bloby's own BotFather": it hosts ONE manager bot (Bot API
 * "Managed Bots" feature) whose only job is to mint a per-user CHILD bot at
 * pairing time and hand its token to the user's self-hosted Bloby. After that
 * the relay is gone — each Bloby long-polls its own child bot DIRECTLY against
 * api.telegram.org, so messages never traverse the relay (no egress, fully
 * self-sufficient).
 *
 *   POST /telegram/provision            (auth: relay bearer token)
 *     Mints a provisioning session and returns a t.me/newbot deep link. The user
 *     taps it, confirms "Create Bot" in Telegram, and the manager bot gets a
 *     `managed_bot` update (see handleTelegramManagerWebhook).
 *
 *   GET  /telegram/provision/:sessionId (auth: relay bearer token)
 *     Polled by the Bloby. Returns { ready, token, botUsername, ownerUserId }
 *     once the child bot exists. Single-use: the token row is deleted on read.
 *
 *   handleTelegramManagerWebhook        (manager-bot webhook; secret-token gated)
 *     Receives `managed_bot` updates, fetches the child token via
 *     getManagedBotToken, and marks the matching session ready.
 *
 * One-time setup (Bruno): create the manager bot in @BotFather, enable Bot
 * Management Mode, then setWebhook to api.bloby.bot/api/telegram/manager-webhook
 * with allowed_updates=["managed_bot"] and a secret_token. Env vars:
 *   TELEGRAM_MANAGER_BOT_USERNAME, TELEGRAM_MANAGER_BOT_TOKEN, TELEGRAM_MANAGER_WEBHOOK_SECRET
 */

import { Router } from 'express';
import crypto from 'node:crypto';
import { getDb } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const PROVISION_TTL_SECONDS = 10 * 60; // 10 minutes
const MANAGER_BOT = process.env.TELEGRAM_MANAGER_BOT_USERNAME;
const MANAGER_TOKEN = process.env.TELEGRAM_MANAGER_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_MANAGER_WEBHOOK_SECRET;

function getProvisions() {
  return getDb().collection('telegram_provisions');
}

/** A unique, valid Telegram bot username: 5–32 chars, latin+digits+underscore, must end in 'bot'.
 *  The random slug (~64 bits) is the correlation key the webhook uses to match the new bot back
 *  to its pending session. */
function suggestUsername() {
  const slug = crypto.randomBytes(8).toString('hex'); // 16 hex chars
  return `bloby_${slug}_bot`;                          // 6 + 16 + 4 = 26 chars
}

/** Call a Bot API method on the MANAGER bot. */
async function managerCall(method, params) {
  const r = await fetch(`https://api.telegram.org/bot${MANAGER_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok && data.ok, data };
}

/** Fetch a managed (child) bot's token. The exact identifier param for getManagedBotToken
 *  isn't fully published; try the documented shapes in order. Verify against the live API
 *  during setup (the webhook logs the raw managed_bot payload) and simplify to the right one. */
async function fetchManagedToken(botId, ownerUserId) {
  for (const params of [{ bot_id: botId }, { user_id: ownerUserId }, { user_id: botId }]) {
    const val = Object.values(params)[0];
    if (val == null) continue;
    const { ok, data } = await managerCall('getManagedBotToken', params);
    if (ok) {
      const token = (data.result && data.result.token) || (typeof data.result === 'string' ? data.result : null);
      if (token) return token;
    }
  }
  return null;
}

// ─── POST /api/telegram/provision ────────────────────────────────────────────
router.post('/telegram/provision', authenticate, async (req, res) => {
  try {
    if (!MANAGER_BOT) {
      return res.status(503).json({ error: 'telegram-manager-bot-not-configured' });
    }
    const me = req.user;
    const rawName = req.body && typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const name = (rawName || 'Bloby').slice(0, 64);
    const sessionId = crypto.randomBytes(24).toString('hex');
    const suggestedBotUsername = suggestUsername();
    const expiresAt = new Date(Date.now() + PROVISION_TTL_SECONDS * 1000);

    await getProvisions().insertOne({
      sessionId,
      username: me.username,
      tier: me.tier,
      suggestedBotUsername,
      status: 'pending',
      name,
      expiresAt,
      createdAt: new Date(),
    });

    const deepLink = `https://t.me/newbot/${MANAGER_BOT}/${suggestedBotUsername}?name=${encodeURIComponent(name)}`;
    res.json({ sessionId, deepLink, botUsername: suggestedBotUsername, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    console.error('[telegram/provision]', error.message);
    res.status(500).json({ error: 'Failed to start provisioning' });
  }
});

// ─── GET /api/telegram/provision/:sessionId ──────────────────────────────────
router.get('/telegram/provision/:sessionId', authenticate, async (req, res) => {
  try {
    const me = req.user;
    const { sessionId } = req.params;
    const doc = await getProvisions().findOne({ sessionId, username: me.username });
    if (!doc) return res.status(404).json({ error: 'session-not-found' });
    if (doc.status !== 'ready' || !doc.botToken) {
      return res.json({ ready: false });
    }
    // Single-use: remove the row so the token is served exactly once and not left at rest.
    await getProvisions().deleteOne({ _id: doc._id });
    res.json({ ready: true, token: doc.botToken, botUsername: doc.botUsername, ownerUserId: doc.ownerUserId });
  } catch (error) {
    console.error('[telegram/provision/get]', error.message);
    res.status(500).json({ error: 'Failed to fetch provisioning status' });
  }
});

// ─── Manager-bot webhook ─────────────────────────────────────────────────────
// Receives `managed_bot` updates. Mounted in server.js (express.json) BEFORE the
// global parser. Authenticity rests on the secret-token header Telegram echoes.
export async function handleTelegramManagerWebhook(req, res) {
  try {
    // Fail CLOSED: the secret-token header is the sole authenticity control on this public,
    // token-minting endpoint. If the secret isn't configured, refuse rather than process anonymously.
    if (!WEBHOOK_SECRET) {
      console.error('[telegram/manager-webhook] TELEGRAM_MANAGER_WEBHOOK_SECRET not set — refusing');
      return res.status(503).json({ ok: false });
    }
    if (req.headers['x-telegram-bot-api-secret-token'] !== WEBHOOK_SECRET) {
      return res.status(401).json({ ok: false });
    }
    const update = req.body || {};
    const mb = update.managed_bot;
    if (!mb) return res.status(200).json({ ok: true }); // not a managed_bot update — ignore

    // ManagedBotUpdated = { user: <creator User>, bot: <new bot User> }
    const newBot = mb.bot || {};
    const creator = mb.user || {};
    const botUsername = newBot.username || null;
    const botId = newBot.id || null;
    const ownerUserId = creator.id != null ? String(creator.id) : null;

    console.log(`[telegram/manager-webhook] managed_bot @${botUsername} botId=${botId} owner=${ownerUserId}`);
    // Log the raw shape once so the getManagedBotToken identifier can be confirmed at setup.
    console.log('[telegram/manager-webhook] raw:', JSON.stringify(mb).slice(0, 600));

    if (!botUsername) return res.status(200).json({ ok: true });

    // Correlate to the pending session by the high-entropy username we minted.
    const session = await getProvisions().findOne({ suggestedBotUsername: botUsername, status: 'pending' });
    if (!session) {
      console.warn(`[telegram/manager-webhook] no pending session for @${botUsername}`);
      return res.status(200).json({ ok: true });
    }

    const token = await fetchManagedToken(botId, ownerUserId);
    if (!token) {
      console.error(`[telegram/manager-webhook] getManagedBotToken failed for @${botUsername}`);
      return res.status(200).json({ ok: true });
    }

    await getProvisions().updateOne(
      { _id: session._id },
      { $set: { status: 'ready', botToken: token, botUsername, ownerUserId, readyAt: new Date() } },
    );
    console.log(`[telegram/manager-webhook] session ${session.sessionId} ready for ${session.username}`);

    // Best-effort: nudge the user back to Bloby (they've interacted with the manager bot,
    // so we're allowed to message them).
    if (creator.id) {
      managerCall('sendMessage', {
        chat_id: creator.id,
        text: '✅ Your bot is ready! Head back to Bloby — it just linked automatically.',
      }).catch(() => {});
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[telegram/manager-webhook]', error.message);
    res.status(200).json({ ok: true }); // always 200 so Telegram doesn't retry-storm
  }
}

export default router;
