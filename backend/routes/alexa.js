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
 *     and forwards AskMorphyIntent to the linked user's tunnel. Returns the
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
import { verifyAlexaRequest } from '../lib/alexa-verify.js';

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

/**
 * Strip the invocation name (and common Alexa filler words) from the start of
 * a query slot. The test simulator and some real-device patterns leak the
 * invocation into AMAZON.SearchQuery — e.g. "ask my morphy what day is today"
 * yields query="my morphy what day is today" instead of just "what day is today".
 *
 * Idempotent and case-insensitive. Strips at most one invocation/connector pass.
 */
function cleanQuery(rawQuery) {
  let q = String(rawQuery || '').trim();
  if (!q) return q;

  // Order matters: longer phrases first so "my morphy" wins over "morphy".
  const invocations = ['my morphy', 'morphy'];
  for (const name of invocations) {
    const re = new RegExp(`^${name}\\b[\\s,.:;-]*`, 'i');
    if (re.test(q)) {
      q = q.replace(re, '').trim();
      break;
    }
  }

  // Drop a single leading connector word that the user might have said as part
  // of the invocation phrase ("to ...", "for ...", "about ...").
  q = q.replace(/^(to|for|about|please)\b[\s,.:;-]+/i, '').trim();

  return q;
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

/**
 * Send a Progressive Response directive to Alexa. This buys time — once Alexa
 * receives a directive, the skill has ~30s total to send the final response
 * instead of the default ~8s window. The directive itself plays a short
 * "working on it" line so the user knows something's happening.
 *
 * Best-effort: failures are logged but don't break the main flow.
 */
async function sendProgressiveResponse(envelope, speech) {
  const requestId = envelope?.request?.requestId;
  const token = envelope?.context?.System?.apiAccessToken;
  const apiEndpoint = envelope?.context?.System?.apiEndpoint || 'https://api.amazonalexa.com';
  if (!requestId || !token) return;

  try {
    const r = await fetch(`${apiEndpoint}/v1/directives`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        header: { requestId },
        directive: { type: 'VoicePlayer.Speak', speech: String(speech || '').slice(0, 600) },
      }),
    });
    if (!r.ok) {
      console.warn(`[alexa/handle] Progressive Response rejected: ${r.status}`);
    }
  } catch (err) {
    console.warn('[alexa/handle] Progressive Response failed:', err.message);
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
    // Node lowercases all incoming header names. Amazon may send EITHER the
    // legacy SHA1 `Signature` header, OR the newer `Signature-256` (SHA256),
    // or both. The inline verifier prefers SHA256 when present and falls back
    // to SHA1 to cover the dev-console test simulator and older devices.
    const certUrl = req.headers.signaturecertchainurl;
    const sigSha1 = req.headers.signature;
    const sigSha256 = req.headers['signature-256'];
    const rawBody = req.body instanceof Buffer ? req.body.toString('utf-8') : String(req.body || '');

    if (!certUrl || (!sigSha1 && !sigSha256)) {
      console.warn('[alexa/handle] Missing signature headers — sig keys present:',
        Object.keys(req.headers).filter((k) => k.toLowerCase().includes('sig')));
      return res.status(400).json({ error: 'Missing Alexa signature headers' });
    }

    let envelope;
    try { envelope = JSON.parse(rawBody); }
    catch { return res.status(400).json({ error: 'Malformed JSON' }); }

    const requestTimestamp = envelope?.request?.timestamp;
    if (!requestTimestamp) return res.status(400).json({ error: 'Request timestamp missing' });

    // Opt-in bypass for diagnosis. Logs loudly on every request so it can't
    // be silently left on. UNSET before publishing.
    const skipVerify = process.env.ALEXA_SKIP_VERIFY === 'true';

    if (skipVerify) {
      console.warn('[alexa/handle] ⚠ ALEXA_SKIP_VERIFY=true — accepting unverified request');
    } else {
      try {
        const { algo } = await verifyAlexaRequest({
          certUrl, sigSha256, sigSha1, rawBody, timestamp: requestTimestamp,
        });
        console.log(`[alexa/handle] verified (${algo})`);
      } catch (verErr) {
        console.warn('[alexa/handle] Signature verification failed:', {
          msg: verErr?.message || String(verErr),
          certUrl,
          sigSha1Len: sigSha1?.length || 0,
          sigSha256Len: sigSha256?.length || 0,
          bodyLen: rawBody.length,
          bodyFirst80: rawBody.slice(0, 80),
          bodyLast40: rawBody.slice(-40),
          contentType: req.headers['content-type'],
          contentLength: req.headers['content-length'],
        });
        return res.status(400).json({ error: 'Invalid Alexa signature' });
      }
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

    // ── 4. LaunchRequest — "Alexa, open Morphy" ────────────────────────────
    if (requestType === 'LaunchRequest') {
      const link = alexaUserId ? await getLinks().findOne({ alexaUserId }) : null;
      if (!link) {
        return res.json(alexaResponse(
          "Welcome to Morphy. To get started, open your Morphy dashboard, grab a pairing code, then say: link with code, followed by your six digits.",
          { endSession: false, reprompt: "Say: link with code, followed by your six digits." },
        ));
      }
      return res.json(alexaResponse(
        "Morphy here, what can I help with?",
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
        "You can ask me anything you'd ask in your Morphy chat. For example: what's on my schedule, or summarize my emails.",
        { endSession: false, reprompt: "What would you like to ask?" },
      ));
    }
    if (intentName === 'AMAZON.FallbackIntent') {
      return res.json(alexaResponse(
        "I didn't quite catch that. Try saying it again, starting with: tell me, ask about, or what.",
        { endSession: false, reprompt: "Try saying: tell me what time it is, or ask about my schedule." },
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
          "That code didn't match or has expired. Generate a fresh one from your Morphy dashboard and try again.",
          { endSession: false, reprompt: "Try saying: link with code, then your new six digits." },
        ));
      }

      // Upsert the link: an Alexa user can only be linked to one Morphy at a time;
      // a fresh pair replaces any prior linkage.
      await getLinks().updateOne(
        { alexaUserId },
        { $set: { alexaUserId, username: codeDoc.username, linkedAt: new Date() } },
        { upsert: true },
      );

      return res.json(alexaResponse(
        "Linked successfully. What can I help with?",
        { endSession: false, reprompt: "I'm listening." },
      ));
    }

    // ── 7. AskMorphyIntent — forward to the user's tunnel ─────────────────
    if (intentName === 'AskMorphyIntent') {
      if (!alexaUserId) {
        return res.json(alexaResponse("I couldn't identify your Alexa account.", { endSession: true }));
      }
      const link = await getLinks().findOne({ alexaUserId });
      if (!link) {
        return res.json(alexaResponse(
          "This Alexa isn't linked to a Morphy yet. Open your Morphy dashboard, grab a pairing code, then say: link with code, followed by your six digits.",
          { endSession: false, reprompt: "Say: link with code, followed by your six digits." },
        ));
      }

      const user = await getUsers().findOne(
        { username: link.username },
        { projection: { username: 1, tunnelUrl: 1, isOnline: 1, alexaSharedSecret: 1 } },
      );
      if (!user || !user.tunnelUrl || !user.alexaSharedSecret) {
        return res.json(alexaResponse(
          "I can't reach your Morphy right now. Make sure it's online and the Alexa channel is enabled.",
          { endSession: true },
        ));
      }
      if (user.isOnline === false) {
        return res.json(alexaResponse(
          "Your Morphy appears to be offline. Start it up and try again.",
          { endSession: true },
        ));
      }

      const query = cleanQuery(slots.query?.value || '');
      if (!query) {
        return res.json(alexaResponse("What would you like to ask?", { endSession: false }));
      }

      // Fire a Progressive Response after 2s if the Pi hasn't replied yet.
      // This extends Alexa's response window from ~8s to ~30s.
      const progressiveTimer = setTimeout(() => {
        sendProgressiveResponse(envelope, "Working on it.").catch(() => {});
      }, 2_000);

      try {
        const { reply, endSession } = await forwardToTunnel(user, {
          text: query,
          alexaUserId,
          sessionId,
          kind: 'ask',
        });
        clearTimeout(progressiveTimer);
        return res.json(alexaResponse(
          reply || "I don't have anything to say to that.",
          { endSession: !!endSession, reprompt: endSession ? null : "Anything else?" },
        ));
      } catch (err) {
        clearTimeout(progressiveTimer);
        const msg = err.name === 'AbortError'
          ? "I'll reply in your chat when I'm done."
          : `Trouble reaching your Morphy: ${err.message}`;
        console.warn('[alexa/handle] Forward error:', err.message || err);
        return res.json(alexaResponse(msg, { endSession: true }));
      }
    }

    return res.json(alexaResponse(
      "I'm not sure how to handle that. Try saying it again, starting with: tell me, or ask about.",
      { endSession: false, reprompt: "What would you like to ask?" },
    ));
  } catch (error) {
    console.error('[alexa/handle]', error);
    res.status(500).json({ error: 'Internal error' });
  }
}

export default router;
