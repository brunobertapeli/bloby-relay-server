import { Router } from 'express';
import { getUsers } from '../db.js';
import { redirectLimiter } from '../middleware/rateLimiter.js';
import { parseTierFromSubdomain, buildSubdomainUrl, RESERVED } from '../lib/validate.js';
import proxy from '../lib/proxy.js';

const HEARTBEAT_TIMEOUT = parseInt(process.env.HEARTBEAT_TIMEOUT_MS || '120000', 10);

const router = Router();

// ─── Core resolve logic (shared by subdomain + path handlers) ───────────────

// Error/status pages must never be cached — stale 502/503 pages cause "Host Error" on restart
const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
};

async function resolveBot(username, tier, req, res) {
  if (username.includes('.') || username.length < 3 || username.length > 30) {
    return res.set(NO_CACHE_HEADERS).status(404).send(notFoundPage());
  }

  const query = { username };
  if (tier) query.tier = tier;

  const user = await getUsers().findOne(
    query,
    { projection: { username: 1, tier: 1, tunnelUrl: 1, isOnline: 1, lastHeartbeat: 1 } },
  );

  if (!user) {
    return res.set(NO_CACHE_HEADERS).status(404).send(notFoundPage(username));
  }

  // If accessed via the wrong tier subdomain, 404
  if (tier && user.tier !== tier) {
    return res.set(NO_CACHE_HEADERS).status(404).send(notFoundPage(username));
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
    return res.set(NO_CACHE_HEADERS).status(503).send(offlinePage(username));
  }

  // Reverse-proxy to the bot's tunnel (URL stays in the address bar)
  proxy.web(req, res, { target: user.tunnelUrl });
}

// ─── Lookup-only helper (for WS upgrade in server.js) ───────────────────────

export async function lookupBot(username, tier) {
  const query = { username };
  if (tier) query.tier = tier;

  const user = await getUsers().findOne(
    query,
    { projection: { tier: 1, tunnelUrl: 1, isOnline: 1, lastHeartbeat: 1 } },
  );

  if (!user) return null;
  if (tier && user.tier !== tier) return null;

  const stale =
    user.lastHeartbeat &&
    Date.now() - user.lastHeartbeat.getTime() > HEARTBEAT_TIMEOUT;

  if (!user.tunnelUrl || !user.isOnline || stale) {
    if (user.isOnline && stale) {
      getUsers()
        .updateOne({ _id: user._id }, { $set: { isOnline: false } })
        .catch(() => {});
    }
    return null;
  }

  return { tunnelUrl: user.tunnelUrl };
}

// ─── Subdomain middleware ───────────────────────────────────────────────────
// Intercepts:
//   bruno.fluxy.bot/*        → premium (username from subdomain)
//   bruno.at.fluxy.bot/*     → free "at" tier (username from subdomain)

export function subdomainResolver(req, res, next) {
  const domain = process.env.RELAY_DOMAIN;
  if (!domain) return next();

  const host = req.hostname;

  // Skip bare domain, www, api, and my — relay's own routes apply there
  if (host === domain || host === `www.${domain}` || host === `api.${domain}` || host === `my.${domain}`) return next();

  if (host.endsWith(`.${domain}`)) {
    const subdomain = host.slice(0, -(domain.length + 1));
    const parsed = parseTierFromSubdomain(subdomain);

    if (!parsed) return next();

    // Proxy everything (including /api/* paths) — the bot handles its own API
    return resolveBot(parsed.username, parsed.tier, req, res);
  }

  next();
}

// ─── Path-based shortcut: GET /:username ─────────────────────────────────────
// Redirects:
//   fluxy.bot/bruno      →  bruno.fluxy.bot       (premium)
//   my.fluxy.bot/bruno   →  bruno.my.fluxy.bot    (free)

router.get('/:username', redirectLimiter, async (req, res) => {
  try {
    const username = req.params.username.toLowerCase().trim();

    if (username.includes('.') || username.length < 3 || username.length > 30) {
      return res.set(NO_CACHE_HEADERS).status(404).send(notFoundPage());
    }

    // Reserved names are pages, not bots — redirect to www so the SPA handles them
    const domain = process.env.RELAY_DOMAIN;
    if (domain && RESERVED.has(username)) {
      return res.redirect(301, `https://www.${domain}/${username}`);
    }

    // Determine tier from host: my.fluxy.bot → free ("at"), fluxy.bot → premium
    const host = req.hostname;
    const tier = (domain && host === `my.${domain}`) ? 'at' : 'premium';

    const user = await getUsers().findOne(
      { username, tier },
      { projection: { tier: 1 } },
    );

    if (!user) {
      return res.set(NO_CACHE_HEADERS).status(404).send(notFoundPage(username));
    }

    const subdomainUrl = buildSubdomainUrl(username, user.tier);
    return res.redirect(302, subdomainUrl);
  } catch (error) {
    console.error('[resolve]', error.message);
    res.set(NO_CACHE_HEADERS).status(500).send(errorPage());
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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',system-ui,sans-serif;
      background:#0a0a0b;color:#e4e4e7;display:flex;align-items:center;
      justify-content:center;min-height:100vh;padding:1.5rem}
    .c{text-align:center;max-width:460px}
    h1{font-family:'Space Grotesk',sans-serif;font-size:1.6rem;font-weight:700;
      margin-bottom:.5rem;display:flex;align-items:center;
      justify-content:center;gap:.5rem}
    p{color:#a1a1aa;line-height:1.6;margin-bottom:.75rem;font-size:.95rem}
    strong{color:#e4e4e7}
    .dot{width:12px;height:12px;border-radius:50%;display:inline-block}
    .red{background:#ef4444;animation:pulse 2s infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
    .badge{display:inline-block;background:#18181b;border:1px solid #27272a;
      border-radius:999px;padding:.2rem .7rem;font-size:.7rem;color:#52525b;margin-top:.5rem}
    .gradient{background:linear-gradient(135deg,#04D1FE,#AF27E3,#FB4072);
      -webkit-background-clip:text;-webkit-text-fill-color:transparent;
      background-clip:text}
    .btn{display:inline-flex;align-items:center;justify-content:center;
      background:linear-gradient(135deg,#04D1FE,#AF27E3,#FB4072);
      border:none;border-radius:9999px;
      padding:.55rem 1.4rem;color:#fff;font-size:.875rem;font-weight:500;
      text-decoration:none;transition:all .2s;font-family:'Space Grotesk',sans-serif;
      cursor:pointer;height:2.25rem}
    .btn:hover{opacity:.9}
    .actions{display:flex;justify-content:center;gap:.6rem;margin-top:1.2rem;flex-wrap:wrap}
    video{pointer-events:none}
  </style>
</head>
<body><div class="c">${body}</div></body>
</html>`;
}

function offlinePage(username) {
  return shell(
    `${esc(username)} — Offline`,
    `<h1><span class="dot red"></span> Bot Offline</h1>
     <p><strong>${esc(username)}</strong>'s bot is currently unreachable.
        It may be restarting or the host machine is powered off.</p>
     <p class="sub" id="status">Retrying...</p>
     <span class="badge">Powered by Fluxy</span>
     <script>
     (function(){
       var a=0;
       function retry(){a++;
         fetch(location.href,{cache:'no-store',redirect:'follow'})
           .then(function(r){if(r.ok||(r.status!==502&&r.status!==503))location.reload();else sched()})
           .catch(function(){sched()});
       }
       function sched(){
         var d=Math.min(3000,1000+a*300);
         document.getElementById('status').textContent='Retrying in '+Math.ceil(d/1000)+'s...';
         setTimeout(retry,d);
       }
       setTimeout(retry,2000);
     })();
     </script>`,
  );
}

function notFoundPage(username) {
  const domain = process.env.RELAY_DOMAIN || 'fluxy.bot';
  const wwwUrl = `https://www.${domain}`;
  const videoBase = `${wwwUrl}/assets/videos/fluxy_what_happened`;
  const msg = username
    ? `The bot <strong>${esc(username)}</strong> doesn't exist — maybe it was never created, or the name is misspelled.`
    : 'The page you are looking for does not exist.';
  const reserveHint = username
    ? `<p style="color:#71717a;font-size:.85rem">Want <strong style="color:#a1a1aa">${domain}/${esc(username)}</strong>? You can reserve it.</p>`
    : '';
  return shell('Not Found',
    `<video autoplay loop muted playsinline style="height:140px;margin:0 auto .8rem">
       <source src="${videoBase}.mov" type='video/mp4; codecs="hvc1"'>
       <source src="${videoBase}.webm" type="video/webm">
     </video>
     <h1><span class="gradient">404</span> — Not Found</h1>
     <p>${msg}</p>
     ${reserveHint}
     <div class="actions">
       <a href="${wwwUrl}/#reserve" class="btn btn-primary">Reserve a Handle</a>
     </div>`);
}

function errorPage() {
  return shell(
    'Error',
    `<meta http-equiv="refresh" content="10">
     <h1>Something went wrong</h1>
     <p>Please try again in a moment. This page auto-refreshes.</p>`,
  );
}
