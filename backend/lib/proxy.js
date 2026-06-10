import httpProxy from 'http-proxy';
import zlib from 'node:zlib';
import { NO_CACHE, restartingPage, offlinePage, brandedJson } from './pages.js';

// ─────────────────────────────────────────────────────────────────────────────
// Why this file is more than a one-liner:
//
// The relay reverse-proxies user.bloby.bot → https://<random>.trycloudflare.com (a Cloudflare
// "quick tunnel" running on the user's box). When that tunnel's connector dies but the relay DB
// still thinks the bot is online, the trycloudflare hostname STILL resolves (Cloudflare anycast),
// and the edge answers with a fully-formed HTTP response: status 530 + the raw "Error 1033 /
// Argo Tunnel error" HTML page. To http-proxy that is a *successful* upstream response, not a
// transport error — so proxy.on('error') never fires and the ugly Cloudflare page is piped
// straight to the user. (Confirmed against http-proxy@1.18.1 web-incoming/web-outgoing: the
// error path is only reached for socket/connection failures.)
//
// Fix: own the response. resolveBot/server.js pass selfHandleResponse per request, so http-proxy
// emits 'proxyRes' and does NOT auto-pipe. We classify the upstream response; for a Cloudflare-edge
// error we substitute a branded page; otherwise we faithfully forward it (status + headers + body,
// streaming-safe for SSE/binary). The agent's OWN branded error pages (which also come back through
// the CF edge) are recognised and passed through untouched.
// ─────────────────────────────────────────────────────────────────────────────

const SNIFF_LIMIT = 4096; // enough to see the agent's <title> markers AND its "Powered by Bloby" badge
const SNIFF_MS = 1500;    // cap how long we'll buffer an ambiguous error body before deciding
const HOP_BY_HOP = [
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade',
];

// Per-request context set by resolveBot: { username, page:'restarting'|'offline', onCfError, onLive }.
// Keyed by req so it never serializes onto the upstream wire and is GC'd with the request.
export const reqContext = new WeakMap();

// NOTE: selfHandleResponse is passed PER REQUEST via proxy.web(req,res,{selfHandleResponse:true}).
// We deliberately do NOT set proxyTimeout globally — http-proxy implements it as an inactivity
// timeout (proxyReq.setTimeout) that would abort the agent's long-lived SSE chat (25s keep-alive
// pings). The dead-tunnel case returns a 530 we already catch; it doesn't hang.
const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  xfwd: true,
  ws: true,
  secure: false,
  preserveHeaderKeyCase: true,
});

// ─── Classification ──────────────────────────────────────────────────────────
// Returns 'pass' | 'cf-error' | 'maybe' | 'maybe-compressed'. Header-first; body sniff only when
// a CF-fronted 4xx/5xx is genuinely ambiguous.
function classifyByHeaders(req, proxyRes) {
  const status = proxyRes.statusCode;
  const h = proxyRes.headers || {};

  // Authoritative agent proof: the agent stamped its own bytes → never substitute.
  if (h['x-bloby-origin']) return 'pass';
  // 530 is exclusively Cloudflare's wrapper for 1xxx tunnel/DNS errors (the bug). Header-only.
  if (status === 530) return 'cf-error';
  // Cloudflare managed-challenge / Turnstile interstitial.
  if (h['cf-mitigated']) return 'cf-error';

  // server:cloudflare + cf-ray are stamped on EVERY response through a quick tunnel (success too),
  // so they carry almost no signal on their own — use them only to gate the body sniff.
  const isCf = String(h['server'] || '').toLowerCase().includes('cloudflare') || !!h['cf-ray'];
  if (!(isCf && status >= 400)) return 'pass';

  // CF-fronted 4xx/5xx with no body to inspect → fail safe to branded (never leak a raw CF page).
  if (req.method === 'HEAD' || status === 204 || status === 304) return 'cf-error';

  const enc = String(h['content-encoding'] || '').toLowerCase();
  return (enc && enc !== 'identity') ? 'maybe-compressed' : 'maybe';
}

// CF error-template STRUCTURAL markers (never prose a normal app would print).
const CF_MARKERS = [
  'cf-error-details', 'cf-wrapper', '| Cloudflare</title>',
  'data-translate="error"', 'data-translate="what_happened"', 'window._cf_',
];
// cloudflared's OWN origin-unreachable errors (plain text, none of the edge-template markers
// above): the connector is up but the local origin is down — exactly what the agent's
// self-update restart produces ("502 Bad Gateway — An error occurred while opening a stream
// to the origin"). Phrasing is unmistakable, so a single hit suffices. Without these, the
// raw 502 was classified as a real agent response and piped through verbatim — and since it
// carries no self-recovery script, a browser (or the dashboard's workspace iframe) sat on it
// forever.
const CLOUDFLARED_MARKERS = [
  'opening a stream to the origin',
  'Unable to reach the origin service',
];
// Positive AGENT proof inside the first prefix (early <title>s; badge if it lands in-window).
const AGENT_MARKERS = ['Powered by Bloby', 'Reconnecting · Bloby', 'Backend down · Bloby', 'x-bloby'];

function bodyLooksLikeCf(prefix) {
  for (const a of AGENT_MARKERS) if (prefix.includes(a)) return false; // agent bytes → pass
  for (const m of CLOUDFLARED_MARKERS) if (prefix.includes(m)) return true; // connector-level origin error
  let hits = 0;
  for (const m of CF_MARKERS) if (prefix.includes(m)) hits++;
  return hits >= 2; // two independent CF structural markers ⇒ genuine CF template
}

function decodePrefix(buf, enc) {
  try {
    if (enc.includes('br')) return zlib.brotliDecompressSync(buf).toString('utf8');
    if (enc.includes('gzip')) return zlib.gunzipSync(buf).toString('utf8');
    if (enc.includes('deflate')) return zlib.inflateSync(buf).toString('utf8');
  } catch {
    return null; // truncated/partial prefix won't decode → caller fail-safes to branded
  }
  return buf.toString('utf8');
}

// A request is a top-level navigation only if it clearly wants an HTML document.
function isNavigation(req) {
  if (req.headers['sec-fetch-mode'] === 'navigate') return true;
  const p = (req.url || '').split('?')[0];
  return req.method === 'GET'
    && String(req.headers['accept'] || '').includes('text/html')
    && !p.startsWith('/api') && !p.startsWith('/app/api');
}

// Substitute a branded response. Navigations get the HTML page; everything else (XHR, sub-resource,
// module script, WS-failover fetch) gets a small JSON 503 so callers fail cleanly instead of
// choking on '<'. Status is 503 by default (temporarily unavailable; keeps the page's poll going).
function brandedFor(req, res, status = 503) {
  const ctx = reqContext.get(req) || {};
  if (ctx.onCfError) { try { ctx.onCfError(); } catch {} }
  const state = ctx.page === 'offline' ? 'offline' : 'restarting';
  if (res.headersSent || res.writableEnded) { try { res.end(); } catch {} return; }

  if (req.method === 'HEAD') {
    res.writeHead(status, { 'X-Bloby-State': state, ...NO_CACHE });
    res.end();
    return;
  }
  if (isNavigation(req)) {
    const html = state === 'offline' ? offlinePage(ctx.username) : restartingPage(ctx.username);
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'X-Bloby-State': state, ...NO_CACHE });
    res.end(html);
  } else {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'X-Bloby-State': state, ...NO_CACHE });
    res.end(brandedJson(state));
  }
}

// Faithful replication of http-proxy's web-outgoing pass (skipped under selfHandleResponse): copy
// status + every non-hop-by-hop header (preserving case via rawHeaders and multi-value Set-Cookie),
// fix HTTP/1.0 framing, and force NO_CACHE on any pass-through 5xx.
function forwardHead(req, res, proxyRes) {
  const ctx = reqContext.get(req);
  if (ctx && ctx.onLive) { try { ctx.onLive(); } catch {} } // a real agent response came back

  const raw = proxyRes.rawHeaders || [];
  for (let i = 0; i < raw.length; i += 2) {
    const key = raw[i];
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.includes(lower)) continue;
    if (lower === 'set-cookie') continue; // set as an array below to preserve multiple cookies
    if (proxyRes.headers[lower] === undefined) continue;
    try { res.setHeader(key, proxyRes.headers[lower]); } catch {}
  }
  const sc = proxyRes.headers['set-cookie'];
  if (sc) { try { res.setHeader('Set-Cookie', sc); } catch {} }

  // HTTP/1.0 framing parity (mirrors http-proxy's setConnection / removeChunked passes).
  if (req.httpVersion === '1.0') {
    res.removeHeader('transfer-encoding');
    res.setHeader('Connection', req.headers.connection || 'close');
  } else if (req.httpVersion !== '2.0' && !proxyRes.headers.connection) {
    res.setHeader('Connection', req.headers.connection || 'keep-alive');
  }

  // A pass-through 5xx must never be cacheable downstream, even if the origin said otherwise.
  if (proxyRes.statusCode >= 500) {
    for (const [k, v] of Object.entries(NO_CACHE)) res.setHeader(k, v);
  }

  res.statusCode = proxyRes.statusCode;
  if (proxyRes.statusMessage) res.statusMessage = proxyRes.statusMessage;
  res.writeHead(res.statusCode); // headers already staged via setHeader

  if (String(res.getHeader('content-type') || '').includes('text/event-stream')) {
    try { res.flushHeaders(); res.socket?.setNoDelay(true); } catch {}
  }
}

// ─── Upstream HTTP response interceptor ──────────────────────────────────────
proxy.on('proxyRes', (proxyRes, req, res) => {
  try {
    if (res.headersSent || res.writableEnded) { proxyRes.resume(); return; }

    const verdict = classifyByHeaders(req, proxyRes);
    if (verdict === 'cf-error') { proxyRes.resume(); return brandedFor(req, res, 503); }
    if (verdict === 'pass') { forwardHead(req, res, proxyRes); proxyRes.pipe(res); return; }

    // 'maybe' / 'maybe-compressed': buffer a bounded prefix, then decide.
    const enc = String(proxyRes.headers['content-encoding'] || '').toLowerCase();
    const chunks = [];
    let len = 0;
    let decided = false;
    proxyRes.pause();
    const timer = setTimeout(finish, SNIFF_MS);

    function finish() {
      if (decided) return;
      decided = true;
      clearTimeout(timer);
      const buf = Buffer.concat(chunks);
      const text = (verdict === 'maybe-compressed') ? decodePrefix(buf, enc) : buf.toString('utf8');
      // decode failure ⇒ treat as CF error (fail safe, never leak).
      const looksCf = (text === null) ? true : bodyLooksLikeCf(text);
      if (looksCf) { try { proxyRes.destroy(); } catch {} return brandedFor(req, res, 503); }
      // Real agent response: forward the buffered prefix, then stream the rest.
      forwardHead(req, res, proxyRes);
      for (const c of chunks) res.write(c);
      proxyRes.pipe(res);
      proxyRes.resume();
    }

    proxyRes.on('readable', () => {
      let c;
      while (!decided && (c = proxyRes.read()) !== null) {
        chunks.push(c);
        len += c.length;
        if (len >= SNIFF_LIMIT) { finish(); break; }
      }
    });
    proxyRes.on('end', finish);
    proxyRes.on('error', () => {
      if (decided) return;
      decided = true;
      clearTimeout(timer);
      brandedFor(req, res, 503);
    });
  } catch (e) {
    console.error('[proxyRes] handler error:', e.message);
    try { if (!res.headersSent) brandedFor(req, res, 502); else res.destroy(); } catch {}
  }
});

// ─── WebSocket: don't leak a raw Cloudflare error during the upgrade ─────────
// If the tunnel is dead, the upgrade gets an ordinary HTTP response (e.g. 530) instead of a 101.
// http-proxy would write that onto the client socket. We register first, so we destroy the upstream
// response and the client socket before any CF bytes are written. The socket 'error' guard keeps a
// write-after-destroy from crashing the process.
proxy.on('proxyReqWs', (proxyReq, _req, socket) => {
  socket.on('error', () => {});
  proxyReq.on('response', (proxyRes) => {
    try {
      if (!proxyRes.upgrade) {
        try { proxyRes.destroy(); } catch {}
        if (!socket.destroyed) {
          try { socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n'); } catch {}
          socket.destroy();
        }
      }
    } catch {
      try { socket.destroy(); } catch {}
    }
  });
});

// ─── Transport-level failures (ECONNREFUSED/RESET/ENOTFOUND/abort/TLS) ───────
// These mean the origin couldn't even be reached — treat as a transient restart.
proxy.on('error', (err, req, res) => {
  console.error('[proxy] error:', err.message);
  if (res && res.writeHead && !res.writableEnded) {
    brandedFor(req, res, 502);
  } else if (res && res.destroy) {
    try { res.destroy(); } catch {} // res is a WS socket
  }
});

export default proxy;
