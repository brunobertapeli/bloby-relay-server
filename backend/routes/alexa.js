/**
 * Alexa channel — relay-side entrypoints.
 *
 *   POST /api/alexa/pair    (auth: bearer relay token)
 *     Mints a 6-digit pairing code for the bot. Returns { code, expiresAt,
 *     sharedSecret }. The shared secret is the per-user value the relay later
 *     sends as `x-bloby-alexa-secret` when forwarding inbound utterances to
 *     the user's tunnel — the Pi stores it once and verifies on each call.
 *
 *   POST /api/alexa/handle  (Amazon-signed webhook)
 *     The public endpoint configured on the Alexa skill. Verifies the request
 *     came from Amazon (signature + cert + timestamp), dispatches on intent,
 *     and forwards AskBlobyIntent to the linked user's tunnel. Returns the
 *     Alexa-flavored JSON envelope.
 *
 * The signature/cert verification depends on the `alexa-verifier` npm package
 * (declared in package.json). It checks: cert URL host/port/path, cert chain
 * back to Amazon's root, that the cert covers echo-api.amazon.com, and the
 * SHA1-RSA signature over the raw request body.
 */

import { Router } from 'express';
import crypto from 'node:crypto';
import { getDb, getUsers } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import verifier from 'alexa-verifier';

const router = Router();

// ─── Limits ────────────────────────────────────────────────────────────────
const PAIR_TTL_SECONDS = 10 * 60;            // 10 minutes
const PI_FORWARD_TIMEOUT_MS = 27_000;        // < Alexa's ~30s ceiling
const MAX_REPLY_CHARS = 4_000;               // Alexa caps SSML around 8k chars; keep headroom

// ─── Helpers ────────────────────────────────────────────────────────────────
function get6DigitCode() {
  // Cryptographically random 6-digit code: 000000–999999.
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function getPairingCodes() {
  return getDb().collection('alexa_pairing_codes');
}

function getLinks() {
  return getDb().collection('alexa_links');
}

/** Build a standard Alexa response envelope. */
function alexaResponse(speech, { endSession = false, reprompt = null } = {}) {
  const safe = String(speech || '').slice(0, MAX_REPLY_CHARS);
  const resp = {
    version: '1.0',
    response: {
      outputSpeech: { type: 'PlainText', text: safe },
      shouldEndSession: endSession,
    },
  };
  if (reprompt) {
    resp.response.reprompt = {
      outputSpeech: { type: 'PlainText', text: String(reprompt).slice(0, MAX_REPLY_CHARS) },
    };
  }
  return resp;
}

/** Forward an utterance to a user's tunnel and return the Pi's reply text. */
async function forwardToTunnel(user, payload) {
  const url = `${user.tunnelUrl.replace(/\/$/, '')}/api/channels/alexa/handle`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), PI_FORWARD_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bloby-alexa-secret': user.alexaSharedSecret,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) {
      const msg = data.error || `Pi returned ${r.status}`;
      throw new Error(msg);
    }
    return { reply: data.reply || '', endSession: !!data.endSession, overflow: !!data.overflow };
  } finally {
    clearTimeout(t);
  }
}

// ─── POST /api/alexa/pair ───────────────────────────────────────────────────
// Auth: bearer relay token (the same token the bot uses for register/heartbeat).
// Generates a fresh 6-digit code, ensures a per-user shared secret exists.
router.post('/alexa/pair', authenticate, async (req, res) => {
  try {
    const me = req.user;

    // Ensure the user has a persistent alexaSharedSecret. Generate once, reuse forever.
    let sharedSecret = me.alexaSharedSecret;
    if (!sharedSecret) {
      sharedSecret = crypto.randomBytes(32).toString('hex');
      await getUsers().updateOne({ _id: me._id }, { $set: { alexaSharedSecret: sharedSecret } });
    }

    // Mint a fresh code. We don't pre-clear old codes — they auto-expire via TTL.
    const code = get6DigitCode();
    const expiresAt = new Date(Date.now() + PAIR_TTL_SECONDS * 1000);

    await getPairingCodes().insertOne({
      code,
      username: me.username,
      tier: me.tier,
      expiresAt,
      createdAt: new Date(),
    });

    res.json({
      code,
      expiresAt: expiresAt.toISOString(),
      sharedSecret,
    });
  } catch (error) {
    if (error.code === 11000) {
      // Astronomically rare collision on the 6-digit code — caller retries.
      return res.status(409).json({ error: 'Code collision, retry' });
    }
    console.error('[alexa/pair]', error.message);
    res.status(500).json({ error: 'Failed to mint pairing code' });
  }
});

// ─── POST /api/alexa/handle ─────────────────────────────────────────────────
// Amazon-signed webhook. Mounted in server.js with express.raw so we keep the
// raw body for signature verification.
//
// Exported (not on the router) so server.js can attach the right body parser.
export async function handleAlexaRequest(req, res) {
  try {
    // ── 1. Verify Amazon signature ─────────────────────────────────────────
    const certUrl = req.headers.signaturecertchainurl;
    const signature = req.headers.signature;
    const rawBody = req.body instanceof Buffer ? req.body.toString('utf-8') : String(req.body || '');

    if (!certUrl || !signature) {
      return res.status(400).json({ error: 'Missing Alexa signature headers' });
    }

    try {
      await new Promise((resolve, reject) => {
        verifier(certUrl, signature, rawBody, (err) => (err ? reject(err) : resolve()));
      });
    } catch (verErr) {
      console.warn('[alexa/handle] Signature verification failed:', verErr.message || verErr);
      return res.status(400).json({ error: 'Invalid Alexa signature' });
    }

    let envelope;
    try { envelope = JSON.parse(rawBody); }
    catch { return res.status(400).json({ error: 'Malformed JSON' }); }

    // ── 2. Reject stale timestamps (defense in depth) ──────────────────────
    const ts = envelope?.request?.timestamp ? Date.parse(envelope.request.timestamp) : 0;
    if (!ts || Math.abs(Date.now() - ts) > 150_000) {
      return res.status(400).json({ error: 'Request timestamp out of range' });
    }

    const requestType = envelope?.request?.type;
    const alexaUserId = envelope?.session?.user?.userId
      || envelope?.context?.System?.user?.userId
      || null;
    const sessionId = envelope?.session?.sessionId || null;

    // ── 3. SessionEndedRequest — just acknowledge ──────────────────────────
    if (requestType === 'SessionEndedRequest') {
      return res.json({ version: '1.0', response: { shouldEndSession: true } });
    }

    // ── 4. LaunchRequest — "Alexa, open Bloby" ─────────────────────────────
    if (requestType === 'LaunchRequest') {
      const link = alexaUserId ? await getLinks().findOne({ alexaUserId }) : null;
      if (!link) {
        return res.json(alexaResponse(
          "Welcome to Bloby. To get started, open your bloby dashboard, grab a pairing code, then say: link with code, followed by your six digits.",
          { endSession: false, reprompt: "Say: link with code, followed by your six digits." },
        ));
      }
      return res.json(alexaResponse(
        "Bloby here, what can I help with?",
        { endSession: false, reprompt: "I'm listening." },
      ));
    }

    if (requestType !== 'IntentRequest') {
      return res.json(alexaResponse("I didn't catch that.", { endSession: true }));
    }

    const intentName = envelope.request.intent?.name;
    const slots = envelope.request.intent?.slots || {};

    // ── 5. System intents ──────────────────────────────────────────────────
    if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
      return res.json(alexaResponse('Goodbye.', { endSession: true }));
    }
    if (intentName === 'AMAZON.HelpIntent') {
      return res.json(alexaResponse(
        "You can ask me anything you'd ask in your bloby chat. For example: what's on my schedule, or summarize my emails.",
        { endSession: false, reprompt: "What would you like to ask?" },
      ));
    }

    // ── 6. LinkIntent — redeem pairing code ────────────────────────────────
    if (intentName === 'LinkIntent') {
      const codeRaw = slots.code?.value || '';
      const code = String(codeRaw).replace(/\D/g, '');
      if (code.length !== 6) {
        return res.json(alexaResponse(
          "I need a six digit code. Try again, like: link with code one two three four five six.",
          { endSession: false, reprompt: "Say: link with code, followed by your six digits." },
        ));
      }
      if (!alexaUserId) {
        return res.json(alexaResponse("I couldn't identify your Alexa account.", { endSession: true }));
      }

      const pending = await getPairingCodes().findOneAndDelete({ code });
      const codeDoc = pending?.value || pending; // mongo driver v5 vs v6
      if (!codeDoc?.username) {
        return res.json(alexaResponse(
          "That code didn't match or has expired. Generate a fresh one from your bloby dashboard and try again.",
          { endSession: false, reprompt: "Try saying: link with code, then your new six digits." },
        ));
      }

      // Upsert the link: an Alexa user can only be linked to one bloby at a time;
      // a fresh pair replaces any prior linkage.
      await getLinks().updateOne(
        { alexaUserId },
        { $set: { alexaUserId, username: codeDoc.username, linkedAt: new Date() } },
        { upsert: true },
      );

      return res.json(alexaResponse(
        `Linked to ${codeDoc.username}. What can I help with?`,
        { endSession: false, reprompt: "I'm listening." },
      ));
    }

    // ── 7. AskBlobyIntent — forward to the user's tunnel ──────────────────
    if (intentName === 'AskBlobyIntent') {
      if (!alexaUserId) {
        return res.json(alexaResponse("I couldn't identify your Alexa account.", { endSession: true }));
      }
      const link = await getLinks().findOne({ alexaUserId });
      if (!link) {
        return res.json(alexaResponse(
          "This Alexa isn't linked to a bloby yet. Open your bloby dashboard, grab a pairing code, then say: link with code, followed by your six digits.",
          { endSession: false, reprompt: "Say: link with code, followed by your six digits." },
        ));
      }

      const user = await getUsers().findOne(
        { username: link.username },
        { projection: { username: 1, tunnelUrl: 1, isOnline: 1, alexaSharedSecret: 1 } },
      );
      if (!user || !user.tunnelUrl || !user.alexaSharedSecret) {
        return res.json(alexaResponse(
          `I can't reach ${link.username} right now. Make sure your bloby is online and the Alexa channel is enabled.`,
          { endSession: true },
        ));
      }
      if (user.isOnline === false) {
        return res.json(alexaResponse(
          `${link.username} appears to be offline. Start it up and try again.`,
          { endSession: true },
        ));
      }

      const query = slots.query?.value || '';
      if (!query.trim()) {
        return res.json(alexaResponse("What would you like to ask?", { endSession: false }));
      }

      try {
        const { reply, endSession } = await forwardToTunnel(user, {
          text: query,
          alexaUserId,
          sessionId,
          kind: 'ask',
        });
        return res.json(alexaResponse(
          reply || "I don't have anything to say to that.",
          { endSession: !!endSession, reprompt: endSession ? null : "Anything else?" },
        ));
      } catch (err) {
        const msg = err.name === 'AbortError'
          ? "I'll reply in your chat when I'm done."
          : `Trouble reaching your bloby: ${err.message}`;
        console.warn('[alexa/handle] Forward error:', err.message || err);
        return res.json(alexaResponse(msg, { endSession: true }));
      }
    }

    return res.json(alexaResponse("I don't know that one.", { endSession: false, reprompt: "What can I help with?" }));
  } catch (error) {
    console.error('[alexa/handle]', error);
    res.status(500).json({ error: 'Internal error' });
  }
}

export default router;
