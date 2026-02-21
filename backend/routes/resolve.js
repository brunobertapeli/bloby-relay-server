import { Router } from 'express';
import { getUsers } from '../db.js';
import { redirectLimiter } from '../middleware/rateLimiter.js';

const HEARTBEAT_TIMEOUT = parseInt(process.env.HEARTBEAT_TIMEOUT_MS || '120000', 10);

const router = Router();

// ─── Core resolve logic (shared by subdomain + path handlers) ───────────────

async function resolveBot(username, subPath, res) {
  if (username.includes('.') || username.length < 3 || username.length > 30) {
    return res.status(404).send(notFoundPage());
  }

  const user = await getUsers().findOne(
    { username },
    { projection: { username: 1, tunnelUrl: 1, isOnline: 1, lastHeartbeat: 1 } },
  );

  if (!user) {
    return res.status(404).send(notFoundPage(username));
  }

  const stale =
    user.lastHeartbeat &&
    Date.now() - user.lastHeartbeat.getTime() > HEARTBEAT_TIMEOUT;

  if (!user.tunnelUrl || !user.isOnline || stale) {
    if (user.isOnline && stale) {
      getUsers()
        .updateOne({ _id: user._id }, { $set: { isOnline: false } })
        .catch(() => {});
    }
    return res.status(503).send(offlinePage(username));
  }

  // Build target: tunnel origin + whatever sub-path was requested
  const target = user.tunnelUrl + (subPath === '/' ? '' : subPath);
  res.redirect(302, target);
}

// ─── Subdomain middleware ───────────────────────────────────────────────────
// Intercepts requests like  bruno.fluxy.bot/anything
// before normal route matching runs.

export function subdomainResolver(req, res, next) {
  const domain = process.env.RELAY_DOMAIN;
  if (!domain) return next();

  const host = req.hostname; // e.g. "bruno.fluxy.bot"

  // Skip bare domain and www
  if (host === domain || host === `www.${domain}`) return next();

  if (host.endsWith(`.${domain}`)) {
    const sub = host.slice(0, -(domain.length + 1));

    // Only single-level, valid-length subdomains
    if (sub && !sub.includes('.') && sub.length >= 3 && sub.length <= 30) {
      return resolveBot(sub.toLowerCase(), req.originalUrl, res);
    }
  }

  next();
}

// ─── Path-based fallback: GET /:username ─────────────────────────────────────
// Used when wildcard DNS isn't set up yet, or for direct testing:
//   relay.fluxy.bot/bruno  →  302 → tunnel URL

router.get('/:username', redirectLimiter, async (req, res) => {
  try {
    const username = req.params.username.toLowerCase().trim();
    await resolveBot(username, '/', res);
  } catch (error) {
    console.error('[resolve]', error.message);
    res.status(500).send(errorPage());
  }
});

export default router;

// ─── Static HTML pages ──────────────────────────────────────────────────────

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shell(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} | Fluxy</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
      background:#0a0a0b;color:#e4e4e7;display:flex;align-items:center;
      justify-content:center;min-height:100vh;padding:1.5rem}
    .c{text-align:center;max-width:460px}
    h1{font-size:1.4rem;margin-bottom:.5rem;display:flex;align-items:center;
      justify-content:center;gap:.5rem}
    p{color:#a1a1aa;line-height:1.6;margin-bottom:.75rem}
    strong{color:#e4e4e7}
    .dot{width:12px;height:12px;border-radius:50%;display:inline-block}
    .red{background:#ef4444;animation:pulse 2s infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
    .badge{display:inline-block;background:#18181b;border:1px solid #27272a;
      border-radius:999px;padding:.2rem .7rem;font-size:.7rem;color:#52525b;margin-top:.5rem}
  </style>
</head>
<body><div class="c">${body}</div></body>
</html>`;
}

function offlinePage(username) {
  return shell(
    `${esc(username)} — Offline`,
    `<meta http-equiv="refresh" content="15">
     <h1><span class="dot red"></span> Bot Offline</h1>
     <p><strong>${esc(username)}</strong>'s bot is currently unreachable.
        It may be restarting or the host machine is powered off.</p>
     <p>This page auto-refreshes every 15 seconds.</p>
     <span class="badge">Powered by Fluxy</span>`,
  );
}

function notFoundPage(username) {
  const msg = username
    ? `The bot <strong>${esc(username)}</strong> does not exist.`
    : 'The page you are looking for does not exist.';
  return shell('Not Found', `<h1>404 — Not Found</h1><p>${msg}</p><span class="badge">Powered by Fluxy</span>`);
}

function errorPage() {
  return shell(
    'Error',
    `<meta http-equiv="refresh" content="10">
     <h1>Something went wrong</h1>
     <p>Please try again in a moment. This page auto-refreshes.</p>`,
  );
}
