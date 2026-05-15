import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getDb, getUsers } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { jwtAuth } from '../middleware/jwtAuth.js';
import { validateUsername } from '../lib/validate.js';
import {
  messengerKeyLimiter,
  messengerConnectLimiter,
  messengerSendLimiter,
  messengerInboxLimiter,
  messengerReadLimiter,
} from '../middleware/rateLimiter.js';

const router = Router();

// ─── Limits ─────────────────────────────────────────────────────────────────
const MAX_PAYLOAD_BYTES = 64 * 1024;       // 64 KB per encrypted message
const MAX_PUBKEY_BYTES = 256;              // generous: 32-byte X25519 = 44 base64 chars
const MAX_INBOX_MESSAGES = 200;            // metadata page size
const MAX_READ_IDS = 50;                   // per /read call

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Canonical pair: always sort usernames alphabetically so (a,b) and (b,a) map
 * to the same connection document. Lets the unique index on (userA, userB)
 * cover both directions with a single check.
 */
function canonicalPair(u1, u2) {
  const [userA, userB] = [u1, u2].sort();
  return { userA, userB };
}

function isBase64(str) {
  return typeof str === 'string' && /^[A-Za-z0-9+/=]+$/.test(str);
}

function getConnections() {
  return getDb().collection('messenger_connections');
}

function getMessages() {
  return getDb().collection('messenger_messages');
}

/**
 * Look up the peer username on the opposite side of a connection doc.
 */
function peerOf(conn, me) {
  return conn.userA === me ? conn.userB : conn.userA;
}

// ─── PUT /api/messenger/key ──────────────────────────────────────────────────
// Publish (or rotate) this bloby's long-lived public key.
//
// The relay never sees the matching private key. Rotating keys invalidates the
// ability to decrypt any pending messages that were encrypted to the old one,
// so skills should rotate sparingly.
//
// Body:    { pubkey: string (base64) }
// Returns: { ok, username, pubkey }
router.put('/messenger/key', authenticate, messengerKeyLimiter, async (req, res) => {
  try {
    const { pubkey } = req.body || {};
    if (!pubkey || !isBase64(pubkey) || pubkey.length > MAX_PUBKEY_BYTES) {
      return res.status(400).json({ error: 'pubkey must be a base64 string' });
    }

    await getUsers().updateOne(
      { _id: req.user._id },
      { $set: { messengerPubkey: pubkey, messengerKeyAt: new Date() } },
    );

    // Promote any pending connections that were waiting on this key.
    await maybeActivatePending(req.user.username);

    res.json({ ok: true, username: req.user.username, pubkey });
  } catch (error) {
    console.error('[messenger/key]', error.message);
    res.status(500).json({ error: 'Failed to publish key' });
  }
});

/**
 * If both peers in a pending connection now have a published pubkey, flip
 * the connection to 'active'. Called on key publish and on connect.
 */
async function maybeActivatePending(username) {
  const conns = await getConnections()
    .find({ status: 'pending', $or: [{ userA: username }, { userB: username }] })
    .toArray();

  if (!conns.length) return;

  const peerNames = conns.map((c) => peerOf(c, username));
  const peers = await getUsers()
    .find({ username: { $in: peerNames } })
    .project({ username: 1, messengerPubkey: 1 })
    .toArray();

  const haveKey = new Set(peers.filter((p) => p.messengerPubkey).map((p) => p.username));
  const me = await getUsers().findOne({ username }, { projection: { messengerPubkey: 1 } });
  const meHasKey = !!me?.messengerPubkey;
  if (!meHasKey) return;

  const toActivate = conns.filter((c) => haveKey.has(peerOf(c, username))).map((c) => c._id);
  if (!toActivate.length) return;

  await getConnections().updateMany(
    { _id: { $in: toActivate } },
    { $set: { status: 'active', acceptedAt: new Date(), updatedAt: new Date() } },
  );
}

// ─── POST /api/messenger/connect ─────────────────────────────────────────────
// Toggle a 1-on-1 connection with another bloby.
//
// Behavior (idempotent toggle):
//   - active connection exists  → remove it (and purge all messages)
//   - peer already requested me → flip to active (if both have keys)
//   - I already requested peer  → no-op (still pending)
//   - nothing exists            → create pending request from me to peer
//
// Body:    { username: string }
// Returns: { status: 'pending'|'active'|'removed', peer, requiresKey? }
router.post('/messenger/connect', authenticate, messengerConnectLimiter, async (req, res) => {
  try {
    const me = req.user.username;
    const { username: rawTarget } = req.body || {};

    const uv = validateUsername(rawTarget);
    if (!uv.valid) return res.status(400).json({ error: uv.error });
    const peer = uv.username;

    if (peer === me) {
      return res.status(400).json({ error: 'Cannot connect to yourself' });
    }

    const peerUser = await getUsers().findOne({ username: peer }, { projection: { username: 1, messengerPubkey: 1 } });
    if (!peerUser) {
      return res.status(404).json({ error: 'Peer username not found' });
    }

    const { userA, userB } = canonicalPair(me, peer);
    const connections = getConnections();
    const existing = await connections.findOne({ userA, userB });

    // Case 1: connection already exists.
    if (existing) {
      // Active → toggle off. Wipe all messages so there is no encrypted residue.
      if (existing.status === 'active') {
        await getMessages().deleteMany({ connectionId: existing._id });
        await connections.deleteOne({ _id: existing._id });
        return res.json({ status: 'removed', peer });
      }

      // Pending and the peer was the one who requested first → accept.
      if (existing.status === 'pending' && existing.initiator === peer) {
        const meUser = await getUsers().findOne({ _id: req.user._id }, { projection: { messengerPubkey: 1 } });
        const bothHaveKeys = !!meUser?.messengerPubkey && !!peerUser.messengerPubkey;

        if (!bothHaveKeys) {
          // Mark mutual intent but stay pending until both keys exist.
          await connections.updateOne(
            { _id: existing._id },
            { $set: { mutual: true, updatedAt: new Date() } },
          );
          return res.json({
            status: 'pending',
            peer,
            requiresKey: !meUser?.messengerPubkey ? 'self' : 'peer',
          });
        }

        await connections.updateOne(
          { _id: existing._id },
          { $set: { status: 'active', mutual: true, acceptedAt: new Date(), updatedAt: new Date() } },
        );
        return res.json({ status: 'active', peer });
      }

      // Pending and I'm already the initiator → idempotent no-op.
      return res.json({ status: 'pending', peer });
    }

    // Case 2: nothing exists → create a pending request.
    await connections.insertOne({
      userA, userB,
      initiator: me,
      status: 'pending',
      mutual: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return res.json({ status: 'pending', peer });
  } catch (error) {
    if (error.code === 11000) {
      // Lost a race; re-resolve by re-reading.
      return res.status(409).json({ error: 'Connection state changed, retry' });
    }
    console.error('[messenger/connect]', error.message);
    res.status(500).json({ error: 'Connect failed' });
  }
});

// ─── GET /api/messenger/peer/:username ──────────────────────────────────────
// Fetch a connected peer's published pubkey so the bloby can encrypt to it.
// Returns 403 if no active connection exists.
router.get('/messenger/peer/:username', authenticate, async (req, res) => {
  try {
    const me = req.user.username;
    const uv = validateUsername(req.params.username);
    if (!uv.valid) return res.status(400).json({ error: uv.error });
    const peer = uv.username;

    const { userA, userB } = canonicalPair(me, peer);
    const conn = await getConnections().findOne({ userA, userB, status: 'active' });
    if (!conn) {
      return res.status(403).json({ error: 'No active connection with this peer' });
    }

    const peerUser = await getUsers().findOne(
      { username: peer },
      { projection: { username: 1, messengerPubkey: 1, isOnline: 1 } },
    );
    if (!peerUser?.messengerPubkey) {
      return res.status(404).json({ error: 'Peer has not published a key' });
    }

    res.json({
      username: peerUser.username,
      pubkey: peerUser.messengerPubkey,
      isOnline: !!peerUser.isOnline,
    });
  } catch (error) {
    console.error('[messenger/peer]', error.message);
    res.status(500).json({ error: 'Lookup failed' });
  }
});

// ─── POST /api/messenger/send ────────────────────────────────────────────────
// Store one opaque encrypted payload for a connected peer.
//
// The relay never inspects `payload`. Skills are responsible for the entire
// envelope (nonce, ephemeral pubkey, ciphertext, MAC) — the recommended
// scheme is documented in BLOBY-MESSENGER.md.
//
// Body:    { to: string, payload: string (base64, ≤ 64KB) }
// Returns: { ok, messageId, createdAt }
router.post('/messenger/send', authenticate, messengerSendLimiter, async (req, res) => {
  try {
    const me = req.user.username;
    const { to, payload } = req.body || {};

    const uv = validateUsername(to);
    if (!uv.valid) return res.status(400).json({ error: uv.error });
    const peer = uv.username;

    if (!payload || !isBase64(payload)) {
      return res.status(400).json({ error: 'payload must be a base64 string' });
    }
    if (payload.length > MAX_PAYLOAD_BYTES) {
      return res.status(413).json({ error: `payload exceeds ${MAX_PAYLOAD_BYTES} bytes` });
    }

    const { userA, userB } = canonicalPair(me, peer);
    const conn = await getConnections().findOne({ userA, userB, status: 'active' });
    if (!conn) {
      return res.status(403).json({ error: 'No active connection with this peer' });
    }

    const now = new Date();
    const result = await getMessages().insertOne({
      connectionId: conn._id,
      from: me,
      to: peer,
      payload,
      createdAt: now,
    });

    res.json({ ok: true, messageId: result.insertedId.toString(), createdAt: now.toISOString() });
  } catch (error) {
    console.error('[messenger/send]', error.message);
    res.status(500).json({ error: 'Send failed' });
  }
});

// ─── GET /api/messenger/inbox ────────────────────────────────────────────────
// "Peek" endpoint — the god endpoint a widget polls on every render. Returns
// everything needed to draw a status UI without ever touching ciphertext:
//   - connections: all active + pending connections involving me (with peer
//     names, status, mutual flag, online-ness for the "Connected" widget)
//   - pendingIncoming: peers who requested me — action items
//   - messages: METADATA ONLY for queued messages → { id, from, createdAt, bytes }
//
// This endpoint is read-only. It never deletes a message and is safe to poll
// continuously from a UI. To actually consume a message, call POST /read.
//
// Returns: { connections, pendingIncoming, messages, totalUnread, byPeer }
router.get('/messenger/inbox', authenticate, messengerInboxLimiter, async (req, res) => {
  try {
    const me = req.user.username;

    // Connections (joined with peer's online state for the widget UX).
    const conns = await getConnections()
      .find({ $or: [{ userA: me }, { userB: me }] })
      .toArray();

    const peerNames = conns.map((c) => peerOf(c, me));
    const peerDocs = peerNames.length
      ? await getUsers()
          .find({ username: { $in: peerNames } })
          .project({ username: 1, isOnline: 1, messengerPubkey: 1 })
          .toArray()
      : [];
    const peerMap = new Map(peerDocs.map((p) => [p.username, p]));

    const connections = conns.map((c) => {
      const peer = peerOf(c, me);
      const p = peerMap.get(peer);
      return {
        id: c._id.toString(),
        peer,
        status: c.status,
        initiator: c.initiator,
        mutual: !!c.mutual,
        peerOnline: !!p?.isOnline,
        peerHasKey: !!p?.messengerPubkey,
        createdAt: c.createdAt?.toISOString(),
        acceptedAt: c.acceptedAt?.toISOString() || null,
      };
    });

    const pendingIncoming = connections
      .filter((c) => c.status === 'pending' && c.initiator !== me)
      .map((c) => c.peer);

    // Message metadata — payload is intentionally NOT projected.
    const msgs = await getMessages()
      .find({ to: me })
      .project({ from: 1, createdAt: 1, payload: 1 })
      .sort({ createdAt: 1 })
      .limit(MAX_INBOX_MESSAGES)
      .toArray();

    const messages = msgs.map((m) => ({
      id: m._id.toString(),
      from: m.from,
      // Approx decoded byte length, computed from the base64 string length so
      // we don't ship the actual bytes back to the widget.
      bytes: Math.floor((m.payload?.length || 0) * 3 / 4),
      createdAt: m.createdAt.toISOString(),
    }));

    // Convenience aggregation for "Messages — From  /  1 new — handle" widgets.
    const byPeer = {};
    for (const m of messages) {
      byPeer[m.from] = (byPeer[m.from] || 0) + 1;
    }

    res.json({
      connections,
      pendingIncoming,
      messages,
      totalUnread: messages.length,
      byPeer,
      truncated: messages.length === MAX_INBOX_MESSAGES,
    });
  } catch (error) {
    console.error('[messenger/inbox]', error.message);
    res.status(500).json({ error: 'Inbox failed' });
  }
});

// ─── POST /api/messenger/read ────────────────────────────────────────────────
// "Consume" endpoint — returns the ciphertext payload for each requested ID
// AND deletes it from the relay in the same operation. This is what the bloby's
// internal decryption loop calls; the human-facing widget should never call it.
//
// Per-message atomicity is guaranteed by findOneAndDelete: the relay only ever
// returns a payload that it has just removed, so no two calls can decrypt the
// same blob twice. IDs that don't belong to the caller (or no longer exist)
// are silently skipped.
//
// Body:    { ids: string[] }     (max 50 per call)
// Returns: { messages: [{ id, from, payload, createdAt }] }
router.post('/messenger/read', authenticate, messengerReadLimiter, async (req, res) => {
  try {
    const me = req.user.username;
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' });
    }
    if (ids.length > MAX_READ_IDS) {
      return res.status(413).json({ error: `Too many ids (max ${MAX_READ_IDS})` });
    }

    const objectIds = [];
    for (const id of ids) {
      try { objectIds.push(new ObjectId(String(id))); } catch { /* skip invalid */ }
    }
    if (!objectIds.length) return res.json({ messages: [] });

    // findOneAndDelete is atomic per-message — the relay can't return a payload
    // it didn't also remove. Run them in parallel for throughput.
    const results = await Promise.all(
      objectIds.map((_id) =>
        getMessages().findOneAndDelete({ _id, to: me }),
      ),
    );

    const messages = results
      .filter((doc) => doc) // null when not found / not addressed to me
      .map((doc) => ({
        id: doc._id.toString(),
        from: doc.from,
        payload: doc.payload,
        createdAt: doc.createdAt.toISOString(),
      }));

    res.json({ messages });
  } catch (error) {
    console.error('[messenger/read]', error.message);
    res.status(500).json({ error: 'Read failed' });
  }
});

// ─── GET /api/messenger/connections-summary  (dashboard) ────────────────────
// JWT-authenticated, account-scoped. Returns per-bloby connection counts so
// the dashboard can render "Bloby Messenger - N Connections" rows.
//
// Returns: { byBloby: { [username]: { active: string[], pendingIncoming: string[], pendingOutgoing: string[] } } }
router.get('/messenger/connections-summary', jwtAuth, async (req, res) => {
  try {
    const accountId = new ObjectId(req.account.id);

    const blobies = await getUsers()
      .find({ accountId })
      .project({ username: 1 })
      .toArray();

    const usernames = blobies.map((b) => b.username);
    if (!usernames.length) return res.json({ byBloby: {} });

    const conns = await getConnections()
      .find({ $or: [{ userA: { $in: usernames } }, { userB: { $in: usernames } }] })
      .toArray();

    const byBloby = {};
    for (const u of usernames) {
      byBloby[u] = { active: [], pendingIncoming: [], pendingOutgoing: [] };
    }

    for (const c of conns) {
      // A single connection may involve two of the account's own blobies; cover both sides.
      for (const me of [c.userA, c.userB]) {
        if (!byBloby[me]) continue;
        const peer = peerOf(c, me);
        if (c.status === 'active') {
          byBloby[me].active.push(peer);
        } else if (c.initiator === me) {
          byBloby[me].pendingOutgoing.push(peer);
        } else {
          byBloby[me].pendingIncoming.push(peer);
        }
      }
    }

    res.json({ byBloby });
  } catch (error) {
    console.error('[messenger/connections-summary]', error.message);
    res.status(500).json({ error: 'Failed to load summary' });
  }
});

export default router;
