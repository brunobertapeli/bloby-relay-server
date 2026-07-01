// BotDO — one Durable Object per bot (idFromName `${tier}:${username}`).
//
// Step 1 (this file): the DO is the strongly-consistent ROUTE AUTHORITY for its bot.
// The Railway relay pushes routing state here (register / rotate / heartbeat-touch /
// disconnect) and the worker reads it on every request. Replaces the relay's Mongo
// lookup + 4s micro-cache + the 30×1s DNS-warming hack: a route update is visible to
// the very next request, globally.
//
// Step 2 (planned, see edge/README.md): this same DO terminates the agent's persistent
// outbound WSS carrier (hibernatable, incoming) and the route becomes
// { kind: 'carrier' } — traffic is muxed down the agent's own socket and the quick
// tunnel disappears. idFromName IS the routing table; nothing else to keep consistent.
//
// All paths here are INTERNAL: only the worker can reach a DO stub, and the worker
// gates the mutating admin calls behind EDGE_ADMIN_SECRET before forwarding.

// Mirror of the relay's HEARTBEAT_TIMEOUT (360s = 3 missed 120s beats). A route whose
// lastSeenAt is older than this is treated as gone: the worker passes the request
// through to the Railway origin, which owns the authoritative offline/404 pages.
const STALE_MS = 360_000;

// How long a Cloudflare tunnel error may persist before the substituted page flips
// from the optimistic "restarting" to the calm "offline" variant (relay's RESTART_GRACE_MS).
export const RESTART_GRACE_MS = 25_000;

export class BotDO {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ── Read path (worker, hot) ──────────────────────────────────────────────
    if (request.method === 'GET' && path === '/route') {
      const route = await this.ctx.storage.get('route');
      if (!route) return json({ route: null });

      const stale = Date.now() - (route.lastSeenAt || 0) > STALE_MS;
      const cfErrorSince = (await this.ctx.storage.get('cfErrorSince')) || null;
      return json({ route, stale, cfErrorSince });
    }

    // ── Admin path (relay via worker, EDGE_ADMIN_SECRET already verified) ────
    if (request.method === 'PUT' && path === '/route') {
      const body = await request.json();
      const prev = await this.ctx.storage.get('route');
      const route = {
        kind: 'quick',
        username: body.username,
        tier: body.tier,
        tunnelUrl: body.tunnelUrl,
        lastSeenAt: Date.now(),
        updatedAt: Date.now(),
      };
      await this.ctx.storage.put('route', route);
      // A rotated tunnel URL is a fresh start — clear any error-grace state.
      if (!prev || prev.tunnelUrl !== route.tunnelUrl) {
        await this.ctx.storage.delete('cfErrorSince');
      }
      return json({ ok: true });
    }

    if (request.method === 'POST' && path === '/touch') {
      // Heartbeat without rotation: refresh liveness only.
      const route = await this.ctx.storage.get('route');
      if (route) {
        route.lastSeenAt = Date.now();
        await this.ctx.storage.put('route', route);
      }
      return json({ ok: true, hadRoute: !!route });
    }

    if (request.method === 'DELETE' && path === '/route') {
      // Graceful disconnect / handle release: the very next request falls through
      // to the Railway origin, which serves its offline (or 404) page.
      await this.ctx.storage.delete('route');
      await this.ctx.storage.delete('cfErrorSince');
      return json({ ok: true });
    }

    // ── Error-grace bookkeeping (worker, fire-and-forget) ────────────────────
    if (request.method === 'POST' && path === '/cf-error') {
      const since = await this.ctx.storage.get('cfErrorSince');
      if (!since) await this.ctx.storage.put('cfErrorSince', Date.now());
      return json({ ok: true });
    }

    if (request.method === 'POST' && path === '/live') {
      await this.ctx.storage.delete('cfErrorSince');
      return json({ ok: true });
    }

    return json({ error: 'not found' }, 404);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
