// Fire-and-forget sync of bot routing state to the Cloudflare edge worker
// (edge/ — Step 1 of the DO-carrier migration; see edge/README.md).
//
// The relay stays the source of truth in Mongo exactly as today; these calls
// mirror the routing-relevant slice (tunnelUrl + liveness) into the bot's
// Durable Object so the worker can proxy without touching Railway. Every call
// is best-effort with a short timeout and NEVER affects the caller's response —
// if the edge is down or unconfigured, bots keep working through the Railway
// proxy path unchanged.
//
// No-ops entirely until BOTH env vars are set:
//   EDGE_ADMIN_URL     e.g. https://morphy-edge.<account>.workers.dev
//   EDGE_ADMIN_SECRET  must match the worker's EDGE_ADMIN_SECRET secret

const TIMEOUT_MS = 3000;

function configured() {
  return !!(process.env.EDGE_ADMIN_URL && process.env.EDGE_ADMIN_SECRET);
}

async function call(method, path, body) {
  if (!configured()) return;
  const url = `${process.env.EDGE_ADMIN_URL.replace(/\/$/, '')}${path}`;
  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-edge-secret': process.env.EDGE_ADMIN_SECRET,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) console.warn(`[edge] ${method} ${path} → ${res.status}`);
  } catch (err) {
    console.warn(`[edge] ${method} ${path} failed:`, err.message);
  }
}

/** Bot registered / rotated its quick-tunnel URL. */
export function edgeSyncTunnel(username, tier, tunnelUrl) {
  call('PUT', '/__edge/route', { username, tier, tunnelUrl }).catch(() => {});
}

/** Heartbeat without rotation — refresh the route's liveness window. */
export function edgeTouch(username, tier) {
  call('POST', '/__edge/touch', { username, tier }).catch(() => {});
}

/** Graceful disconnect / handle release — next request falls through to Railway. */
export function edgeClear(username, tier) {
  call('DELETE', '/__edge/route', { username, tier }).catch(() => {});
}
