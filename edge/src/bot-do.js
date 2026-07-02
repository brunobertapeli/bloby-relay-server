// BotDO — one Durable Object per bot (idFromName `${tier}:${username}`).
//
// Two roles, selected by the caller (the worker in src/index.js):
//
//  A) QUICK-MODE ROUTE AUTHORITY (Step 1, still supported): the relay mirrors a bot's
//     trycloudflare URL here; the worker reads it and proxies browser traffic to the tunnel.
//
//  B) CARRIER TERMINATOR (Step 2, this file's new core): the agent holds TWO persistent
//     hibernatable WebSocket carriers (control + bulk) into this DO. Browser HTTP and
//     WebSocket traffic is muxed down those carriers to the agent, which replays it to its
//     local 127.0.0.1:7400 server. No tunnel, no random URL, no DNS churn — a reconnect is
//     just the agent redialing this same DO.
//
// All worker→DO calls carry `x-morphy-internal: 1` (the worker strips any inbound copy from
// browsers). Internal calls: /route /touch /cf-error /live (quick-mode admin) and /carrier
// (the agent's carrier upgrade). Everything else is a browser request to proxy over a carrier.
//
// Wire protocol: see ./protocol.js (mirrored by the agent in Bloby/supervisor/relay-tunnel.ts).

import {
  T, F, CLASS, encodeFrame, encodeJson, decodeFrame, payloadJson, u32, readU32,
} from './protocol.js';

const STALE_MS = 360_000;         // quick-mode route liveness (mirrors relay HEARTBEAT_TIMEOUT)
export const RESTART_GRACE_MS = 25_000;
const CARRIER_GRACE_MS = 10_000;  // after last carrier drops, show "reconnecting" this long
const DEFAULT_WINDOW = 256 * 1024;
const CHUNK = 64 * 1024;
const RESP_TIMEOUT_MS = 30_000;

export class BotDO {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.nextStreamId = 2;
    // In-memory, per-activation. HTTP streams live only during an active fetch (never span
    // hibernation — that needs 10s idle). WS-stream identity survives hibernation via the
    // browser socket's serializeAttachment, so it is NOT kept here.
    this.http = new Map();       // sid -> { respResolve, respReject, bodyController, agentWindow, sendWaiter, ended }
    this.pubKeyPromise = null;
  }

  // ───────────────────────── entry ─────────────────────────
  async fetch(request) {
    const url = new URL(request.url);
    if (request.headers.get('x-morphy-internal') === '1') {
      if (url.pathname === '/carrier') return this.handleCarrierConnect(request);
      return this.handleAdmin(request, url); // /route /touch /cf-error /live
    }
    // Browser request to proxy over the carrier.
    if ((request.headers.get('upgrade') || '').toLowerCase() === 'websocket') {
      return this.proxyBrowserWs(request);
    }
    return this.proxyBrowserHttp(request);
  }

  // ───────────────────────── quick-mode admin (Step 1) ─────────────────────────
  async handleAdmin(request, url) {
    const path = url.pathname;
    const m = request.method;

    if (m === 'GET' && path === '/route') {
      const route = await this.ctx.storage.get('route');
      const carrierUp = this.ctx.getWebSockets('carrier').length > 0;
      if (!route) return json({ route: null, carrierUp });
      const stale = route.kind === 'quick' && Date.now() - (route.lastSeenAt || 0) > STALE_MS;
      const cfErrorSince = (await this.ctx.storage.get('cfErrorSince')) || null;
      return json({ route, stale, carrierUp, cfErrorSince });
    }
    if (m === 'PUT' && path === '/route') {
      const b = await request.json();
      const prev = await this.ctx.storage.get('route');
      const route = { kind: 'quick', username: b.username, tier: b.tier, tunnelUrl: b.tunnelUrl, lastSeenAt: Date.now(), updatedAt: Date.now() };
      await this.ctx.storage.put('route', route);
      if (!prev || prev.tunnelUrl !== route.tunnelUrl) await this.ctx.storage.delete('cfErrorSince');
      return json({ ok: true });
    }
    if (m === 'POST' && path === '/touch') {
      const route = await this.ctx.storage.get('route');
      if (route && route.kind === 'quick') { route.lastSeenAt = Date.now(); await this.ctx.storage.put('route', route); }
      return json({ ok: true, hadRoute: !!(route && route.kind === 'quick') });
    }
    if (m === 'DELETE' && path === '/route') {
      const route = await this.ctx.storage.get('route');
      if (!route || route.kind === 'quick') { await this.ctx.storage.delete('route'); await this.ctx.storage.delete('cfErrorSince'); }
      return json({ ok: true });
    }
    if (m === 'POST' && path === '/cf-error') {
      if (!(await this.ctx.storage.get('cfErrorSince'))) await this.ctx.storage.put('cfErrorSince', Date.now());
      return json({ ok: true });
    }
    if (m === 'POST' && path === '/live') { await this.ctx.storage.delete('cfErrorSince'); return json({ ok: true }); }
    return json({ error: 'not found' }, 404);
  }

  // ───────────────────────── carrier connect (Step 2) ─────────────────────────
  async handleCarrierConnect(request) {
    const url = new URL(request.url);
    const role = url.searchParams.get('role') === 'bulk' ? 'bulk' : 'control';
    const expectUser = request.headers.get('x-morphy-user') || '';
    const expectTier = request.headers.get('x-morphy-tier') || '';
    const auth = request.headers.get('authorization') || '';
    const ticket = auth.startsWith('Bearer ') ? auth.slice(7) : url.searchParams.get('ticket') || '';

    const claims = await this.verifyTicket(ticket, expectUser, expectTier);
    if (!claims) return new Response('invalid ticket', { status: 401 });

    let sessionId;
    if (role === 'control') {
      // Last-writer-wins: a fresh control carrier evicts any existing session (duplicate machine).
      sessionId = crypto.randomUUID();
      for (const old of this.ctx.getWebSockets('carrier')) {
        try { old.send(encodeJson(T.GOAWAY, 0, { reason: 'superseded' })); } catch {}
        try { old.close(1012, 'superseded'); } catch {}
      }
      await this.ctx.storage.put('session', sessionId);
      await this.ctx.storage.put('route', { kind: 'carrier', username: claims.u, tier: claims.t, lastCarrierAt: Date.now() });
      this.notifyPresence(claims.u, claims.t, true); // dashboard isOnline = live carrier
    } else {
      sessionId = (await this.ctx.storage.get('session')) || crypto.randomUUID();
    }

    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];
    this.ctx.acceptWebSocket(server, ['carrier']);
    server.serializeAttachment({ carrier: role, sessionId, user: claims.u });
    try {
      server.send(encodeJson(T.HELLO_ACK, 0, { role, sessionId, window: DEFAULT_WINDOW }));
    } catch {}
    return new Response(null, { status: 101, webSocket: client });
  }

  // ───────────────────────── browser HTTP over carrier ─────────────────────────
  async proxyBrowserHttp(request) {
    const control = this.carrier('control');
    if (!control) return this.carrierDownResponse(request);
    const sid = this.allocStream();
    const url = new URL(request.url);
    const headers = headersToObject(request.headers);
    const remoteIp = request.headers.get('cf-connecting-ip') || '';
    const cls = this.classForRequest(request, headers);
    const dataCarrier = cls === CLASS.BULK ? (this.carrier('bulk') || control) : control;

    let respResolve, respReject;
    const respP = new Promise((res, rej) => { respResolve = res; respReject = rej; });
    // pending/endReceived buffer response DATA that arrives before the ReadableStream's controller
    // exists — which happens routinely: the controller is only created after `await respP`
    // resolves (a microtask hop), and body DATA (esp. on the bulk carrier, racing RESP on control)
    // can land in that gap. Without buffering those frames were dropped → truncated bodies under
    // concurrency; an END landing there deleted the stream → RESP timed out → 503.
    const st = { respResolve, respReject, bodyController: null, pending: [], endReceived: false, agentWindow: DEFAULT_WINDOW, sendWaiter: null };
    this.http.set(sid, st);

    send(control, encodeJson(T.OPEN, sid, {
      kind: 'http', method: request.method, url: url.pathname + url.search, headers, remoteIp, class: cls,
    }));
    this.pumpRequestBody(request, sid, dataCarrier).catch(() => this.resetStream(sid, 1));

    const timer = setTimeout(() => respReject(new Error('resp timeout')), RESP_TIMEOUT_MS);
    let head;
    try { head = await respP; } catch { clearTimeout(timer); this.http.delete(sid); return this.carrierDownResponse(request); }
    clearTimeout(timer);

    const noBody = head.status === 204 || head.status === 304 || request.method === 'HEAD';
    if (noBody) { this.http.delete(sid); return new Response(null, { status: head.status, statusText: head.statusText || '', headers: respHeaders(head.headers) }); }

    const self = this;
    const body = new ReadableStream({
      start(c) {
        // Runs synchronously at construction — no frame can interleave the flush below.
        st.bodyController = c;
        for (const chunk of st.pending) { try { c.enqueue(chunk); } catch {} }
        st.pending = [];
        if (st.endReceived) { try { c.close(); } catch {} self.http.delete(sid); }
        else send(control, encodeFrame(T.WINDOW_UPDATE, 0, sid, u32(DEFAULT_WINDOW)));
      },
      pull() { send(control, encodeFrame(T.WINDOW_UPDATE, 0, sid, u32(CHUNK))); },
      cancel() { self.resetStream(sid, 2); },
    });
    return new Response(body, { status: head.status, statusText: head.statusText || '', headers: respHeaders(head.headers) });
  }

  async pumpRequestBody(request, sid, carrier) {
    const st = this.http.get(sid);
    if (!request.body || !st) { send(carrier, endFrame(sid)); return; }
    const reader = request.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) { send(carrier, endFrame(sid)); break; }
      let off = 0;
      while (off < value.length) {
        await this.awaitSendWindow(sid);
        const cur = this.http.get(sid); if (!cur) return; // reset/gone
        const n = Math.min(CHUNK, value.length - off, cur.agentWindow);
        cur.agentWindow -= n;
        send(carrier, encodeFrame(T.DATA, 0, sid, value.subarray(off, off + n)));
        off += n;
      }
    }
  }

  awaitSendWindow(sid) {
    const st = this.http.get(sid);
    if (!st || st.agentWindow > 0) return Promise.resolve();
    return new Promise((resolve) => { st.sendWaiter = resolve; });
  }

  // ───────────────────────── browser WS over carrier ─────────────────────────
  async proxyBrowserWs(request) {
    const control = this.carrier('control');
    if (!control) return new Response('carrier offline', { status: 503 });
    const sid = this.allocStream();
    const url = new URL(request.url);
    const headers = headersToObject(request.headers);
    const remoteIp = request.headers.get('cf-connecting-ip') || '';
    const proto = (request.headers.get('sec-websocket-protocol') || '').split(',')[0].trim();

    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];
    this.ctx.acceptWebSocket(server, ['ws']);
    server.serializeAttachment({ sid, proto });

    send(control, encodeJson(T.OPEN, sid, {
      kind: 'ws', method: 'GET', url: url.pathname + url.search, headers, remoteIp, class: CLASS.INTERACTIVE, proto,
    }));

    const h = {};
    if (proto) h['Sec-WebSocket-Protocol'] = proto;
    return new Response(null, { status: 101, webSocket: client, headers: h });
  }

  // ───────────────────────── hibernation handlers ─────────────────────────
  async webSocketMessage(ws, message) {
    const att = ws.deserializeAttachment() || {};
    if (att.carrier) return this.onCarrierFrame(message);
    if (att.sid !== undefined) return this.onBrowserWsMessage(att.sid, message);
  }

  webSocketClose(ws) {
    const att = ws.deserializeAttachment() || {};
    if (att.carrier) {
      // If no carriers remain, record the drop time so the worker can show a brief
      // "reconnecting" page before falling through to offline.
      if (this.ctx.getWebSockets('carrier').length === 0) {
        this.ctx.storage.get('route').then((r) => {
          if (r && r.kind === 'carrier') {
            r.lastCarrierAt = Date.now();
            this.ctx.storage.put('route', r);
            this.notifyPresence(r.username, r.tier, false); // best-effort offline signal
          }
        }).catch(() => {});
      }
      return;
    }
    if (att.sid !== undefined) {
      const control = this.carrier('control');
      if (control) send(control, encodeFrame(T.CLOSE, 0, att.sid, null));
    }
  }

  webSocketError(ws) { this.webSocketClose(ws); }

  onBrowserWsMessage(sid, message) {
    const control = this.carrier('control');
    if (!control) return;
    const binary = typeof message !== 'string';
    const payload = binary ? new Uint8Array(message) : new TextEncoder().encode(message);
    send(control, encodeFrame(T.DATA, binary ? F.WS_BINARY : 0, sid, payload));
  }

  onCarrierFrame(message) {
    const f = decodeFrame(message);
    const { type, flags, streamId: sid, payload } = f;

    if (type === T.PING) { const c = this.carrier('control'); if (c) send(c, encodeFrame(T.PONG, 0, 0, payload)); return; }
    if (type === T.PONG) return;

    if (type === T.RESP) {
      const st = this.http.get(sid);
      if (st) st.respResolve(payloadJson(payload));
      return;
    }
    if (type === T.WINDOW_UPDATE) {
      const st = this.http.get(sid);
      if (st) { st.agentWindow += readU32(payload); const w = st.sendWaiter; st.sendWaiter = null; if (w) w(); }
      return;
    }
    if (type === T.DATA) {
      const st = this.http.get(sid);
      if (st) { // HTTP response body
        if (st.bodyController) {
          if (payload.length) { try { st.bodyController.enqueue(payload.slice()); } catch {} }
          if (flags & F.END) { try { st.bodyController.close(); } catch {} this.http.delete(sid); }
        } else {
          // Controller not ready yet — buffer in arrival order; start() flushes + closes.
          if (payload.length) st.pending.push(payload.slice());
          if (flags & F.END) st.endReceived = true;
        }
        return;
      }
      // WS message → browser
      const bws = this.browserWs(sid);
      if (bws) { try { bws.send(flags & F.WS_BINARY ? payload.slice() : new TextDecoder().decode(payload)); } catch {} }
      return;
    }
    if (type === T.CLOSE || type === T.RESET) {
      const st = this.http.get(sid);
      if (st) {
        try { st.respReject(new Error('closed')); } catch {} // no-op if RESP already resolved
        if (st.bodyController) { try { st.bodyController.close(); } catch {} this.http.delete(sid); }
        else st.endReceived = true; // controller pending → start() closes after flushing pending
        return;
      }
      const bws = this.browserWs(sid);
      if (bws) { try { bws.close(1011, 'agent closed'); } catch {} }
      return;
    }
  }

  // ───────────────────────── helpers ─────────────────────────
  carrier(role) {
    for (const ws of this.ctx.getWebSockets('carrier')) {
      const a = ws.deserializeAttachment() || {};
      if (a.carrier === role) return ws;
    }
    return null;
  }
  browserWs(sid) {
    for (const ws of this.ctx.getWebSockets('ws')) {
      const a = ws.deserializeAttachment() || {};
      if (a.sid === sid) return ws;
    }
    return null;
  }
  allocStream() {
    const used = new Set();
    for (const ws of this.ctx.getWebSockets('ws')) { const a = ws.deserializeAttachment() || {}; if (a.sid !== undefined) used.add(a.sid); }
    do { this.nextStreamId += 2; if (this.nextStreamId > 0x7fffffff) this.nextStreamId = 2; }
    while (used.has(this.nextStreamId) || this.http.has(this.nextStreamId));
    return this.nextStreamId;
  }
  resetStream(sid, code) {
    const st = this.http.get(sid);
    if (st) { try { st.respReject(new Error('reset')); } catch {} try { st.bodyController && st.bodyController.error(new Error('reset')); } catch {} this.http.delete(sid); }
    const c = this.carrier('control');
    if (c) send(c, encodeFrame(T.RESET, 0, sid, new Uint8Array([code & 0xff])));
  }
  classForRequest(request, headers) {
    const len = parseInt(headers['content-length'] || '0', 10);
    if ((request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') && len > CHUNK) return CLASS.BULK;
    return CLASS.INTERACTIVE;
  }
  carrierDownResponse(request) {
    // The route said carrier, but no carrier is attached right now. 503 so the worker
    // can substitute its branded reconnecting/offline page (it owns the pages).
    return new Response('carrier offline', { status: 503, headers: { 'x-morphy-carrier': 'down' } });
  }

  // Best-effort presence signal → Railway flips users.isOnline (relay mode has no heartbeat).
  // Fire-and-forget: a carrier is connected (connect) or was just closing (disconnect), so the
  // DO stays alive long enough for this sub-second POST. Reuses EDGE_ADMIN_SECRET.
  notifyPresence(username, tier, online) {
    try {
      fetch(`https://api.${this.env.RELAY_DOMAIN}/api/edge/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-edge-secret': this.env.EDGE_ADMIN_SECRET || '' },
        body: JSON.stringify({ username, tier, online }),
      }).catch(() => {});
    } catch {}
  }

  async getPubKey() {
    if (this.pubKeyPromise) return this.pubKeyPromise;
    const x = this.env.EDGE_TICKET_PK;
    this.pubKeyPromise = crypto.subtle.importKey('jwk', { kty: 'OKP', crv: 'Ed25519', x }, { name: 'Ed25519' }, false, ['verify']);
    return this.pubKeyPromise;
  }
  async verifyTicket(ticket, expectUser, expectTier) {
    try {
      if (!ticket || !this.env.EDGE_TICKET_PK) return null;
      const dot = ticket.indexOf('.');
      if (dot < 0) return null;
      const body = ticket.slice(0, dot), sigB64 = ticket.slice(dot + 1);
      const key = await this.getPubKey();
      const ok = await crypto.subtle.verify({ name: 'Ed25519' }, key, b64urlToBytes(sigB64), new TextEncoder().encode(body));
      if (!ok) return null;
      const p = JSON.parse(new TextDecoder().decode(b64urlToBytes(body)));
      if (!p.exp || p.exp * 1000 < Date.now()) return null;
      if (p.u !== expectUser || p.t !== expectTier) return null;
      return p;
    } catch { return null; }
  }
}

// ───────────────────────── module helpers ─────────────────────────
function send(ws, frame) { try { ws.send(frame); } catch {} }
function endFrame(sid) { return encodeFrame(T.DATA, F.END, sid, null); }

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

const HOP = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);
function headersToObject(h) {
  const o = {};
  for (const [k, v] of h) { if (!HOP.has(k.toLowerCase())) o[k] = v; }
  return o;
}
function respHeaders(obj) {
  const h = new Headers();
  for (const k in obj) { if (!HOP.has(k.toLowerCase())) { try { h.set(k, obj[k]); } catch {} } }
  return h;
}
function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}
