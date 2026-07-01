// Branded status pages served by the edge worker when a bot's upstream is unreachable.
//
// Ported from backend/lib/pages.js (the relay's tuned originals — same markup, same
// 1.8s→3s self-recovery poll, same iOS-tested video block). Two deliberate differences:
//   1. The domain is passed in (Workers have no process.env).
//   2. Only the pages the worker actually serves are ported: restarting / offline /
//      brandedJson. Unknown handles and relay-owned hosts are passed through to the
//      Railway origin, which keeps serving its own 404 / error pages — one source of
//      truth per page.
//
// ⚠️ DRIFT HAZARD: if backend/lib/pages.js restyles these pages, re-port them here.
// The agent-side markers ('Powered by Morphy', 'Reconnecting · Morphy') are also part
// of the proxy classification contract in index.js — keep them in sync.

export const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// A missing/404 video hides its wrapper instead of rendering a broken-media icon.
function videoBlock(domain, extraStyle = '') {
  const videoBase = `https://www.${domain}/assets/videos/what-happened`;
  return `<div class="video-wrap" style="${extraStyle}">
       <video autoplay loop muted playsinline onerror="var w=this.closest('.video-wrap'); if(w) w.style.display='none'">
         <source src="${videoBase}.webm" type="video/webm">
         <source src="${videoBase}.mp4" type="video/mp4">
       </video></div>`;
}

function shell(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} | Morphy</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',system-ui,-apple-system,sans-serif;background:#0a0a0b;color:#e4e4e7;
      display:flex;align-items:center;justify-content:center;min-height:100dvh;padding:1.5rem;overflow-x:hidden}
    .c{text-align:center;max-width:460px;width:100%;animation:fade-up .6s ease-out both}
    h1{font-family:'Space Grotesk',sans-serif;font-size:1.6rem;font-weight:700;margin-bottom:.6rem;
      display:flex;align-items:center;justify-content:center;gap:.5rem}
    p{color:#a1a1aa;line-height:1.6;margin-bottom:.6rem;font-size:.95rem}
    .lead{color:#e4e4e7;font-size:1rem}
    strong{color:#e4e4e7}
    .dot{width:12px;height:12px;border-radius:50%;display:inline-block}
    .red{background:#ef4444;box-shadow:0 0 8px rgba(239,68,68,.5)}
    .badge{display:inline-block;background:#18181b;border:1px solid #27272a;border-radius:999px;
      padding:.2rem .7rem;font-size:.7rem;color:#52525b;margin-top:1.2rem;font-family:'Space Grotesk',sans-serif}
    .gradient{background:linear-gradient(135deg,#0166FF,#009AFE,#4AEEFF);
      -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
    video{pointer-events:none}
    .video-wrap{position:relative;width:220px;height:220px;margin:0 auto 1.4rem;
      display:flex;align-items:center;justify-content:center}
    .video-wrap::before{content:'';position:absolute;inset:-20px;
      background:radial-gradient(circle,rgba(0,105,254,0.18) 0%,transparent 60%);
      filter:blur(20px);animation:pulse-glow 3s ease-in-out infinite}
    .video-wrap video{position:relative;width:100%;height:100%;object-fit:contain;border-radius:50%}
    .status-pill{font-size:.85rem;color:#71717a;display:inline-flex;align-items:center;gap:.5rem;
      background:#18181b;border:1px solid #27272a;border-radius:9999px;padding:.35rem .9rem;margin-top:.4rem}
    .status-dot{width:8px;height:8px;border-radius:50%;background:linear-gradient(135deg,#0166FF,#009AFE);
      box-shadow:0 0 8px rgba(0,105,254,0.6);animation:pulse-scale 1.6s ease-in-out infinite}
    .status-dot.off{background:#71717a;box-shadow:none;animation:none}
    @keyframes pulse-scale{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.85)}}
    @keyframes pulse-glow{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}
    @keyframes fade-up{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}
  </style>
</head>
<body><div class="c">${body}</div></body>
</html>`;
}

// Shared self-recovery poll. mode 'fast' (restarting) ramps 1s→3s; mode 'slow' (offline) polls
// every ~15s with jitter. We poll "/" (always an HTML document for a bot subdomain) — NOT
// location.href, so a deep-linked non-HTML path can't make the loop reload into JSON/an asset —
// and reload ONLY when "/" comes back as a 2xx text/html document (the real agent SPA is back).
// A substituted 503 (still down) therefore keeps polling instead of reloading into itself.
function retryScript(mode) {
  const fast = mode === 'fast';
  const firstDelay = fast ? '1800' : '15000';
  const schedBody = fast
    ? "var d=Math.min(3000,1000+a*300);"
    : "var d=15000+Math.floor(Math.random()*5000);";
  const reconnectingText = fast
    ? "t.textContent='Reconnecting…';"
    : "t.textContent='Checking again shortly…';";
  return `<script>(function(){
  var a=0;var t=document.getElementById('statusText');
  function back(r){return r.ok&&(r.headers.get('content-type')||'').indexOf('text/html')!==-1;}
  function go(){a++;${reconnectingText}
    fetch('/',{cache:'no-store',redirect:'follow'})
      .then(function(r){if(back(r))location.reload();else sched();})
      .catch(sched);}
  function sched(){${schedBody}setTimeout(go,d);}
  setTimeout(go,${firstDelay});
})();</script>`;
}

// ─── Transient: the agent is (probably) coming right back ────────────────────
export function restartingPage(domain, username) {
  return shell(
    `${esc(username)} — Restarting`,
    `${videoBlock(domain)}
     <h1 class="gradient">Agent is restarting</h1>
     <p class="lead"><strong>${esc(username)}</strong>'s bot is coming back online.</p>
     <p>This can happen after an update, a restart, or a brief network hiccup. No action needed —
        the page refreshes automatically once it's back.</p>
     <div class="status-pill"><span class="status-dot"></span><span id="statusText">Reconnecting…</span></div>
     <div><span class="badge">Powered by Morphy</span></div>
     ${retryScript('fast')}`,
  );
}

// ─── Intentional / prolonged: the agent is genuinely off ─────────────────────
export function offlinePage(domain, username) {
  return shell(
    `${esc(username)} — Offline`,
    `${videoBlock(domain, 'opacity:.6')}
     <h1><span class="dot red"></span><span class="gradient">Agent is offline</span></h1>
     <p class="lead"><strong>${esc(username)}</strong>'s agent isn't running right now.</p>
     <p>Its owner has stopped it, or the host machine is powered down. It'll be back the moment
        <strong>${esc(username)}</strong> brings it online again.</p>
     <div class="status-pill"><span class="status-dot off"></span><span id="statusText">Offline</span></div>
     <div><span class="badge">Powered by Morphy</span></div>
     ${retryScript('slow')}`,
  );
}

// Tiny machine-readable body for NON-navigation substitutions (XHR / sub-resource / WS-failover).
// The agent SPA does response.json() on /app/api failovers, so a substituted HTML body would throw
// "Unexpected token <". This keeps those callers failing cleanly.
export function brandedJson(state) {
  return JSON.stringify({ error: 'agent_unavailable', state, bloby: true });
}
