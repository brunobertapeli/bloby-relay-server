// Shared branded status/error pages for the relay.
//
// Lives in its own module so both lib/proxy.js (upstream-response substitution) and
// routes/resolve.js (DB-state-driven pages) can import the same pages without a circular
// import. All pages are dark-theme + Inter/Space Grotesk + the morphy "what-happened" video
// (with a graceful onerror hide so a missing asset never shows a broken-media icon) and carry
// NO_CACHE so a CDN can never pin an error page after the agent recovers.

const RELAY_DOMAIN = process.env.RELAY_DOMAIN || 'morphyagent.com';
// Assets come from the website (www.<domain>), never the dead bot subdomain. webm keeps the
// transparent alpha (incl. iPhone Safari); mp4 is the no-alpha fallback. Both confirmed present.
const videoBase = `https://www.${RELAY_DOMAIN}/assets/videos/what-happened`;

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
function videoBlock(extraStyle = '') {
  return `<div class="video-wrap" style="${extraStyle}">
       <video autoplay loop muted playsinline onerror="var w=this.closest('.video-wrap'); if(w) w.style.display='none'">
         <source src="${videoBase}.webm" type="video/webm">
         <source src="${videoBase}.mp4" type="video/mp4">
       </video></div>`;
}

export function shell(title, body) {
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
    .btn{display:inline-flex;align-items:center;justify-content:center;
      background:linear-gradient(135deg,#0166FF,#009AFE,#4AEEFF);border:none;border-radius:9999px;
      padding:.55rem 1.4rem;color:#fff;font-size:.875rem;font-weight:500;text-decoration:none;
      font-family:'Space Grotesk',sans-serif;cursor:pointer;height:2.25rem}
    .btn:hover{opacity:.9}
    .actions{display:flex;justify-content:center;gap:.6rem;margin-top:1.2rem;flex-wrap:wrap}
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
// Shown when the relay believes the agent is live but the upstream is briefly unreachable
// (Cloudflare 1033/530 during a restart, a transport error, or a DB blip). Fast auto-retry.
export function restartingPage(username) {
  return shell(
    `${esc(username)} — Restarting`,
    `${videoBlock()}
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
// Shown when the relay KNOWS the agent is down (graceful disconnect, no tunnel, or a heartbeat
// that has been stale past the timeout), or once a Cloudflare error has persisted past the grace
// window. Calm copy, dimmed video, slow background poll — no urgent "reconnecting" ticking.
export function offlinePage(username) {
  return shell(
    `${esc(username)} — Offline`,
    `${videoBlock('opacity:.6')}
     <h1><span class="dot red"></span><span class="gradient">Agent is offline</span></h1>
     <p class="lead"><strong>${esc(username)}</strong>'s agent isn't running right now.</p>
     <p>Its owner has stopped it, or the host machine is powered down. It'll be back the moment
        <strong>${esc(username)}</strong> brings it online again.</p>
     <div class="status-pill"><span class="status-dot off"></span><span id="statusText">Offline</span></div>
     <div><span class="badge">Powered by Morphy</span></div>
     ${retryScript('slow')}`,
  );
}

export function notFoundPage(username) {
  const wwwUrl = `https://www.${RELAY_DOMAIN}`;
  const msg = username
    ? `The bot <strong>${esc(username)}</strong> doesn't exist — maybe it was never created, or the name is misspelled.`
    : 'The page you are looking for does not exist.';
  const reserveHint = username
    ? `<p style="color:#71717a;font-size:.85rem">Want <strong style="color:#a1a1aa">${RELAY_DOMAIN}/${esc(username)}</strong>? You can reserve it.</p>`
    : '';
  return shell(
    'Not Found',
    `${videoBlock('width:160px;height:160px')}
     <h1><span class="gradient">404</span> — Not Found</h1>
     <p>${msg}</p>
     ${reserveHint}
     <div class="actions"><a href="${wwwUrl}/#reserve" class="btn">Reserve a Handle</a></div>`,
  );
}

export function errorPage() {
  return shell(
    'Error',
    `${videoBlock('width:160px;height:160px')}
     <h1 class="gradient">Something went wrong</h1>
     <p>Please try again in a moment. This page refreshes automatically.</p>
     <div class="status-pill"><span class="status-dot"></span><span id="statusText">Retrying…</span></div>
     ${retryScript('fast')}`,
  );
}

export function tooManyRequestsPage() {
  return shell(
    'Slow down',
    `${videoBlock('width:160px;height:160px')}
     <h1 class="gradient">Too many requests</h1>
     <p>You're going a little fast. Please wait a moment and try again.</p>`,
  );
}

// ─── OAuth code-paste landing page ───────────────────────────────────────────
// Shared, permanent redirect target for ALL Morphy OAuth code-paste flows
// (Fitbit / Google Health today, more later). Self-hosted blobies can't expose a
// public callback, so Google redirects the browser here; this dumb static page
// surfaces everything after the path (location.search + location.hash) in a copy
// box so the user can paste it back into their agent. It is GENERIC and never
// changes — it doesn't know or care which skill triggered the flow; the morphy's
// backend parses whatever param it needs out of the pasted tail.
//
// SECURITY: the tail holds a single-use OAuth `code`. The route serving this MUST
// NOT log req.url/req.query, and this page deliberately contains NO <img>/fetch/
// beacon or third-party script that could leak the value off-page. The mascot
// video + webfonts are static first-party/CDN assets that never carry the tail.
//
// Pure client-side: it reads the tail in the browser; the server only emits HTML.
// Design mirrors the relay's branded pages — dark theme, Inter/Space Grotesk, the
// brand gradient, the morphy mascot, and the spinning conic-gradient border from
// the website's focused "Reserve your handle" input field.
export function oauthConnectPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Connect | Morphy</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    :root{color-scheme:dark}
    body{font-family:'Inter',system-ui,-apple-system,sans-serif;background:#0a0a0b;color:#e4e4e7;
      display:flex;align-items:center;justify-content:center;min-height:100dvh;padding:1.5rem;overflow-x:hidden}
    .c{text-align:center;max-width:480px;width:100%;animation:fade-up .6s ease-out both}
    h1{font-family:'Space Grotesk',sans-serif;font-size:1.6rem;font-weight:700;margin-bottom:.6rem;line-height:1.2}
    p{color:#a1a1aa;line-height:1.6;margin-bottom:.6rem;font-size:.95rem}
    .lead{color:#e4e4e7;font-size:1rem;margin-bottom:1.4rem}
    strong{color:#e4e4e7}
    .gradient{background:linear-gradient(135deg,#0166FF,#009AFE,#4AEEFF);
      -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
    video{pointer-events:none}
    .video-wrap{position:relative;width:150px;height:150px;margin:0 auto 1.2rem;
      display:flex;align-items:center;justify-content:center}
    .video-wrap::before{content:'';position:absolute;inset:-20px;
      background:radial-gradient(circle,rgba(0,105,254,0.18) 0%,transparent 60%);
      filter:blur(20px);animation:pulse-glow 3s ease-in-out infinite}
    .video-wrap video{position:relative;width:100%;height:100%;object-fit:contain;border-radius:50%}
    /* Spinning conic-gradient border — same effect as the focused "Reserve your handle" input. */
    .box{position:relative;border-radius:18px;padding:1px;overflow:hidden;margin:0 0 1rem;
      box-shadow:0 0 24px -6px rgba(0,105,254,0.3)}
    .box::before{content:'';position:absolute;inset:-150%;z-index:0;
      background:conic-gradient(from 0deg,#0166FF,#009AFE,#4AEEFF,#0166FF);
      animation:border-spin 3s linear infinite}
    .box.static::before{animation:none;background:#27272a}
    .box-inner{position:relative;z-index:1;background:#18181b;border-radius:calc(18px - 1px);
      padding:1rem 1.1rem;text-align:left}
    code#payload{display:block;word-break:break-all;white-space:pre-wrap;
      font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.8rem;line-height:1.6;
      color:#d7e3f0;max-height:180px;overflow:auto}
    .empty-msg{color:#a1a1aa;font-size:.9rem;line-height:1.6}
    button{width:100%;cursor:pointer;border:none;border-radius:9999px;padding:.8rem 1.4rem;
      font-family:'Space Grotesk',sans-serif;font-size:.95rem;font-weight:600;color:#fff;
      background:linear-gradient(135deg,#0166FF,#009AFE,#4AEEFF);transition:opacity .15s ease}
    button:hover{opacity:.9}
    button.ok{background:#18181b;border:1px solid #27272a;color:#34d399}
    .hint{margin-top:.9rem;font-size:.8rem;color:#71717a}
    .badge{display:inline-block;background:#18181b;border:1px solid #27272a;border-radius:999px;
      padding:.2rem .7rem;font-size:.7rem;color:#52525b;margin-top:1.4rem;font-family:'Space Grotesk',sans-serif}
    @keyframes border-spin{to{transform:rotate(360deg)}}
    @keyframes pulse-glow{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}
    @keyframes fade-up{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}
  </style>
</head>
<body>
  <div class="c">
    <div class="video-wrap">
      <video autoplay loop muted playsinline onerror="var w=this.closest('.video-wrap'); if(w) w.style.display='none'">
        <source src="${videoBase.replace('what-happened', 'bloby_happy')}.webm" type="video/webm">
        <source src="https://www.${RELAY_DOMAIN}/assets/videos/happy.mp4" type="video/mp4">
      </video>
    </div>
    <h1 id="title" class="gradient">You're authorized</h1>
    <p class="lead" id="sub">Copy the value below, go back to your Morphy, and paste it to finish connecting.</p>
    <div class="box" id="box"><div class="box-inner"><code id="payload"></code></div></div>
    <button id="copyBtn">Copy</button>
    <div class="hint" id="hint">Tip: it was auto-copied to your clipboard.</div>
    <div><span class="badge">Powered by Morphy</span></div>
  </div>
<script>
  // Everything after the path: query string + hash. Future-proof — the agent decides
  // which param(s) it needs (code / scope / state / PKCE / implicit-flow tokens).
  var tail = (location.search || '') + (location.hash || '');
  var payloadEl = document.getElementById('payload');
  var btn = document.getElementById('copyBtn');
  var box = document.getElementById('box');

  if (!tail || tail === '?' || tail === '#') {
    document.getElementById('title').textContent = 'Nothing to copy yet';
    document.getElementById('sub').style.display = 'none';
    box.classList.add('static');
    payloadEl.parentNode.innerHTML = '<div class="empty-msg">Finish the Google consent screen first — then you\\u2019ll land back here with something to copy.</div>';
    btn.style.display = 'none';
    document.getElementById('hint').style.display = 'none';
  } else {
    payloadEl.textContent = tail;
    var copy = function () {
      navigator.clipboard.writeText(tail).then(function () {
        btn.textContent = 'Copied \\u2713';
        btn.classList.add('ok');
        setTimeout(function () { btn.textContent = 'Copy'; btn.classList.remove('ok'); }, 1800);
      }).catch(function () {
        // Clipboard API can be blocked (insecure context / permission); selection fallback.
        var r = document.createRange(); r.selectNodeContents(payloadEl);
        var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        document.getElementById('hint').textContent = 'Press \\u2318/Ctrl+C to copy the highlighted text.';
      });
    };
    btn.addEventListener('click', copy);
    copy(); // auto-copy on load (best-effort)
  }
</script>
</body>
</html>`;
}

// Tiny machine-readable body for NON-navigation substitutions (XHR / sub-resource / WS-failover).
// The agent SPA does response.json() on /app/api failovers, so a substituted HTML body would throw
// "Unexpected token <". This keeps those callers failing cleanly.
export function brandedJson(state) {
  return JSON.stringify({ error: 'agent_unavailable', state, bloby: true });
}
