// morphy-edge — Cloudflare Worker data plane for bot subdomains.
//
// Step 1 ("quick routes"): browser → this worker (runs at every CF PoP) → the bot's
// current trycloudflare quick-tunnel URL. Replaces the Railway relay's reverse-proxy
// role on the handle subdomains; Railway keeps everything else (auth, marketplace,
// Stripe, register/heartbeat API) and remains the fallback origin for every host and
// handle this worker doesn't actively route.
//
// Design rule: ADDITIVE, NEVER AUTHORITATIVE. If the bot's DO has no fresh route,
// the request is passed through to origin unchanged — Railway then serves exactly
// what it serves today (its proxy, offline/404 pages, www/api routes, managed-tier
// bots via their own A records). Deploying this worker with no registered routes is
// a provable no-op.
//
// Parity contract (ported from backend/lib/proxy.js + routes/resolve.js +
// server.js — keep in sync if those change):
//   • tier parsing: <user>.<domain> = premium, <user>.open.<domain> = free ('at')
//   • never leak a raw Cloudflare error page: classify upstream responses
//     (530 / cf-mitigated / CF-fronted 4xx-5xx body sniff) and substitute the
//     branded restarting/offline page — HTML for navigations, JSON for XHR
//   • x-bloby-origin / agent body markers = authoritative agent bytes → pass through
//   • restarting→offline flip after RESTART_GRACE_MS of persistent tunnel errors
//   • WS upgrades are optimistic (attempted even when liveness is stale)
//   • pass-through 5xx is force-NO_CACHE'd; SSE streams untouched (no timeouts)
//   • GET/HEAD retried once on a transport error before substituting a page

import { BotDO, RESTART_GRACE_MS } from './bot-do.js';
import { NO_CACHE, restartingPage, offlinePage, brandedJson } from './pages.js';

export { BotDO };

// ─── Host parsing (mirror of lib/validate.js parseTierFromSubdomain) ─────────
const FREE_PREFIXES = new Set(['open']);
// Relay-owned hosts that are never bots (subset of RESERVED that appears as a bare
// subdomain in practice; anything else unknown just falls through via no-route).
const SKIP_SUBDOMAINS = new Set(['api', 'www', 'open', 'tunnel', 'edge', 'my', 'relay']);

function parseBotHost(hostname, domain) {
  if (!domain || hostname === domain || !hostname.endsWith(`.${domain}`)) return null;
  const sub = hostname.slice(0, -(domain.length + 1));
  if (SKIP_SUBDOMAINS.has(sub)) return null;

  if (sub.includes('.')) {
    const parts = sub.split('.');
    const prefix = parts[parts.length - 1];
    const username = parts.slice(0, -1).join('.');
    if (FREE_PREFIXES.has(prefix) && !username.includes('.') && username.length >= 3 && username.length <= 30) {
      return { tier: 'at', username: username.toLowerCase() };
    }
    return null;
  }
  if (sub.length >= 3 && sub.length <= 30) return { tier: 'premium', username: sub.toLowerCase() };
  return null;
}

// ─── Route lookup with a tiny isolate cache ──────────────────────────────────
// Absorbs page-load bursts (20-40 subresources) without a DO round trip each.
// 2s TTL: shorter than the relay's 4s Mongo micro-cache, and the DO itself is
// strongly consistent, so worst-case staleness after a rotation is 2s in isolates
// that had the old entry — no DNS warming, no invalidation plumbing.
const ROUTE_CACHE_MS = 2000;
const routeCache = new Map(); // 'tier:username' → { data, at }

async function getRoute(env, key) {
  const hit = routeCache.get(key);
  if (hit && Date.now() - hit.at < ROUTE_CACHE_MS) return hit.data;
  const stub = env.BOT_DO.get(env.BOT_DO.idFromName(key));
  const resp = await stub.fetch('https://do/route');
  const data = await resp.json();
  if (routeCache.size > 5000) routeCache.clear(); // bound memory under a scan
  routeCache.set(key, { data, at: Date.now() });
  return data;
}

function doStub(env, key) {
  return env.BOT_DO.get(env.BOT_DO.idFromName(key));
}

// ─── Upstream response classification (port of lib/proxy.js) ─────────────────
const SNIFF_LIMIT = 4096;
const SNIFF_MS = 1500;
const CF_MARKERS = [
  'cf-error-details', 'cf-wrapper', '| Cloudflare</title>',
  'data-translate="error"', 'data-translate="what_happened"', 'window._cf_',
];
const CLOUDFLARED_MARKERS = [
  'opening a stream to the origin',
  'Unable to reach the origin service',
];
const AGENT_MARKERS = ['Powered by Morphy', 'Reconnecting · Morphy', 'Backend down · Morphy', 'x-bloby'];

function classifyByHeaders(request, resp) {
  const status = resp.status;
  const h = resp.headers;

  if (h.get('x-bloby-origin')) return 'pass';       // authoritative agent bytes
  if (status === 530) return 'cf-error';            // CF's 1xxx tunnel-error wrapper
  if (h.get('cf-mitigated')) return 'cf-error';     // managed challenge / Turnstile

  const isCf = (h.get('server') || '').toLowerCase().includes('cloudflare') || !!h.get('cf-ray');
  if (!(isCf && status >= 400)) return 'pass';

  // CF-fronted 4xx/5xx with no inspectable body → fail safe to branded.
  if (request.method === 'HEAD' || status === 204 || status === 304 || !resp.body) return 'cf-error';
  return 'maybe';
}

function bodyLooksLikeCf(prefix) {
  for (const a of AGENT_MARKERS) if (prefix.includes(a)) return false;
  for (const m of CLOUDFLARED_MARKERS) if (prefix.includes(m)) return true;
  let hits = 0;
  for (const m of CF_MARKERS) if (prefix.includes(m)) hits++;
  return hits >= 2;
}

// Read up to SNIFF_LIMIT decoded bytes (bounded by SNIFF_MS), then hand back both the
// sniffed text and a reconstructed stream carrying the full body. (Workers fetch
// decompresses gzip/br transparently, so no zlib port is needed.)
async function sniffBody(resp) {
  const reader = resp.body.getReader();
  const chunks = [];
  let len = 0;
  let upstreamDone = false;
  const deadline = Date.now() + SNIFF_MS;

  while (len < SNIFF_LIMIT && Date.now() < deadline) {
    const timeLeft = deadline - Date.now();
    const next = await Promise.race([
      reader.read(),
      new Promise((r) => setTimeout(() => r('timeout'), timeLeft)),
    ]);
    if (next === 'timeout') break;
    if (next.done) { upstreamDone = true; break; }
    chunks.push(next.value);
    len += next.value.byteLength;
  }

  let text = '';
  try {
    const buf = new Uint8Array(len);
    let off = 0;
    for (const c of chunks) { buf.set(c, off); off += c.byteLength; }
    text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  } catch { text = ''; }

  const stream = new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      if (upstreamDone) controller.close();
    },
    async pull(controller) {
      if (upstreamDone) return;
      try {
        const { done, value } = await reader.read();
        if (done) controller.close();
        else controller.enqueue(value);
      } catch (e) {
        controller.error(e);
      }
    },
    cancel(reason) {
      try { reader.cancel(reason); } catch {}
    },
  });

  return { text, stream };
}

// ─── Branded substitution (port of lib/proxy.js brandedFor) ──────────────────
function isNavigation(request) {
  if (request.headers.get('sec-fetch-mode') === 'navigate') return true;
  const p = new URL(request.url).pathname;
  return request.method === 'GET'
    && (request.headers.get('accept') || '').includes('text/html')
    && !p.startsWith('/api') && !p.startsWith('/app/api');
}

function brandedResponse(request, domain, username, state, status = 503) {
  const headers = { 'X-Bloby-State': state, ...NO_CACHE };
  if (request.method === 'HEAD') return new Response(null, { status, headers });
  if (isNavigation(request)) {
    const html = state === 'offline' ? offlinePage(domain, username) : restartingPage(domain, username);
    return new Response(html, {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8', ...headers },
    });
  }
  return new Response(brandedJson(state), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

// Current page mode from the DO's error-grace state (RESTART_GRACE_MS port).
function pageMode(cfErrorSince) {
  return cfErrorSince && Date.now() - cfErrorSince > RESTART_GRACE_MS ? 'offline' : 'restarting';
}

// ─── Proxying ─────────────────────────────────────────────────────────────────
function buildTarget(request, tunnelUrl) {
  const target = new URL(request.url);
  const t = new URL(tunnelUrl);
  target.protocol = t.protocol;
  target.host = t.host;
  return target;
}

function upstreamHeaders(request) {
  const headers = new Headers(request.headers);
  // xfwd parity with http-proxy: the agent sees who's really calling.
  const clientIp = request.headers.get('cf-connecting-ip');
  if (clientIp) {
    const prior = headers.get('x-forwarded-for');
    headers.set('X-Forwarded-For', prior ? `${prior}, ${clientIp}` : clientIp);
  }
  headers.set('X-Forwarded-Proto', 'https');
  headers.set('X-Forwarded-Host', new URL(request.url).hostname);
  return headers;
}

async function proxyWebSocket(request, route, meta) {
  const target = buildTarget(request, route.tunnelUrl);
  let resp;
  try {
    // Transparent upgrade passthrough: the runtime splices the sockets for us.
    const upstream = new Request(target, request);
    const clientIp = request.headers.get('cf-connecting-ip');
    if (clientIp) upstream.headers.set('X-Forwarded-For', clientIp);
    upstream.headers.set('X-Forwarded-Proto', 'https');
    upstream.headers.set('X-Forwarded-Host', new URL(request.url).hostname);
    resp = await fetch(upstream);
  } catch {
    return brandedResponse(request, meta.domain, meta.username, 'restarting', 502);
  }
  if (resp.status !== 101) {
    // Dead tunnel answered the upgrade with an ordinary HTTP response (e.g. 530).
    // Never write CF bytes to the client socket (server.js proxyReqWs parity).
    return brandedResponse(request, meta.domain, meta.username, pageMode(meta.cfErrorSince), 503);
  }
  return resp;
}

async function proxyHttp(request, route, meta, ctx, env) {
  const target = buildTarget(request, route.tunnelUrl);
  const headers = upstreamHeaders(request);
  const canRetry = request.method === 'GET' || request.method === 'HEAD';

  const init = { method: request.method, headers, redirect: 'manual' };
  if (!canRetry && request.method !== 'OPTIONS') init.body = request.body;

  let resp;
  try {
    resp = await fetch(target, init);
  } catch (e) {
    if (canRetry) {
      // Stale-socket race parity: one retry on a fresh connection before any page.
      try { resp = await fetch(target, init); } catch {
        return onCfError(request, meta, ctx, env, 502);
      }
    } else {
      return onCfError(request, meta, ctx, env, 502);
    }
  }

  const verdict = classifyByHeaders(request, resp);
  if (verdict === 'cf-error') {
    try { ctx.waitUntil(resp.body?.cancel()); } catch {}
    return onCfError(request, meta, ctx, env, 503);
  }

  if (verdict === 'maybe') {
    const { text, stream } = await sniffBody(resp);
    if (bodyLooksLikeCf(text)) {
      try { ctx.waitUntil(stream.cancel()); } catch {}
      return onCfError(request, meta, ctx, env, 503);
    }
    return forward(resp, stream, meta, ctx, env, true);
  }

  return forward(resp, resp.body, meta, ctx, env, false);
}

function forward(resp, body, meta, ctx, env, sniffed) {
  // A real agent response came back — clear the error-grace window if one was open.
  if (meta.cfErrorSince) {
    ctx.waitUntil(doStub(env, meta.key).fetch('https://do/live', { method: 'POST' }).catch(() => {}));
    routeCache.delete(meta.key);
  }

  // Common case: nothing to mutate → return the upstream Response untouched so the
  // runtime keeps its opaque passthrough (no re-encode, headers byte-identical,
  // multi-value Set-Cookie preserved for free).
  if (!sniffed && resp.status < 500) return resp;

  const headers = new Headers(resp.headers);
  // Reconstructing a Response detaches the body from the passthrough optimization and
  // yields DECODED bytes — the original encoding/length headers no longer describe it.
  headers.delete('content-encoding');
  headers.delete('content-length');
  if (resp.status >= 500) {
    // A pass-through 5xx must never be cacheable downstream (lib/proxy.js parity).
    for (const [k, v] of Object.entries(NO_CACHE)) headers.set(k, v);
  }
  return new Response(body, { status: resp.status, statusText: resp.statusText, headers });
}

function onCfError(request, meta, ctx, env, status) {
  ctx.waitUntil(doStub(env, meta.key).fetch('https://do/cf-error', { method: 'POST' }).catch(() => {}));
  return brandedResponse(request, meta.domain, meta.username, pageMode(meta.cfErrorSince), status);
}

// ─── Admin API (called by the Railway relay, shared-secret gated) ─────────────
async function secretsMatch(given, expected) {
  if (!given || !expected) return false;
  const enc = new TextEncoder();
  const a = enc.encode(given);
  const b = enc.encode(expected);
  if (a.byteLength !== b.byteLength) return false;
  try {
    return crypto.subtle.timingSafeEqual(a, b);
  } catch {
    return given === expected;
  }
}

async function handleAdmin(request, env) {
  const url = new URL(request.url);
  if (url.pathname === '/__edge/health') {
    return new Response(JSON.stringify({ ok: true, worker: 'morphy-edge' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const ok = await secretsMatch(request.headers.get('x-edge-secret'), env.EDGE_ADMIN_SECRET);
  if (!ok) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 });

  let body = {};
  if (request.method !== 'GET') {
    try { body = await request.json(); } catch {}
  } else {
    body = { username: url.searchParams.get('username'), tier: url.searchParams.get('tier') };
  }
  const username = String(body.username || '').toLowerCase();
  const tier = String(body.tier || '');
  if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(username) || !['premium', 'at'].includes(tier)) {
    return new Response(JSON.stringify({ error: 'invalid username/tier' }), { status: 400 });
  }
  const key = `${tier}:${username}`;
  const stub = doStub(env, key);
  routeCache.delete(key); // this isolate sees the change immediately

  if (url.pathname === '/__edge/route' && request.method === 'PUT') {
    if (!/^https:\/\//.test(String(body.tunnelUrl || ''))) {
      return new Response(JSON.stringify({ error: 'tunnelUrl must be https' }), { status: 400 });
    }
    return stub.fetch('https://do/route', {
      method: 'PUT',
      body: JSON.stringify({ username, tier, tunnelUrl: body.tunnelUrl }),
    });
  }
  if (url.pathname === '/__edge/touch' && request.method === 'POST') {
    return stub.fetch('https://do/touch', { method: 'POST' });
  }
  if (url.pathname === '/__edge/route' && request.method === 'DELETE') {
    return stub.fetch('https://do/route', { method: 'DELETE' });
  }
  if (url.pathname === '/__edge/route' && request.method === 'GET') {
    return stub.fetch('https://do/route'); // debug: inspect a bot's route state
  }
  return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
}

// ─── Entry ────────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = url.hostname;

    // Admin/control surface — reachable on any host (normally the workers.dev URL),
    // secret-gated, and shadowed away from bot paths.
    if (url.pathname.startsWith('/__edge/')) return handleAdmin(request, env);

    // On the workers.dev host there is no origin to fall through to.
    if (hostname.endsWith('.workers.dev')) {
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    }

    const parsed = parseBotHost(hostname, env.RELAY_DOMAIN);
    if (!parsed) return fetch(request); // relay-owned / unparseable host → origin untouched

    const key = `${parsed.tier}:${parsed.username}`;
    let data;
    try {
      data = await getRoute(env, key);
    } catch {
      return fetch(request); // DO hiccup → behave exactly like today (Railway path)
    }

    const { route, stale, cfErrorSince } = data || {};
    const isUpgrade = (request.headers.get('upgrade') || '').toLowerCase() === 'websocket';

    // No fresh route → pass through to origin (Railway serves its offline/404/proxy
    // exactly as today; managed bots resolve via their own A records).
    // WS parity with lookupBotForWs: upgrades stay optimistic on a stale route.
    if (!route || route.kind !== 'quick' || !route.tunnelUrl || (stale && !isUpgrade)) {
      return fetch(request);
    }

    const meta = { key, username: parsed.username, domain: env.RELAY_DOMAIN, cfErrorSince };
    if (isUpgrade) return proxyWebSocket(request, route, meta);
    return proxyHttp(request, route, meta, ctx, env);
  },
};
