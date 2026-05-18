import httpProxy from 'http-proxy';

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  xfwd: true,
  ws: true,
  secure: false,
});

proxy.on('error', (err, req, res) => {
  console.error('[proxy] error:', err.message);
  if (res.writeHead) {
    // HTTP request — send 502 page with no-cache + fast auto-retry
    res.writeHead(502, {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    });
    res.end(errorPage());
  } else {
    // WebSocket upgrade — res is a Socket, clean it up
    res.destroy();
  }
});

function errorPage() {
  const domain = process.env.RELAY_DOMAIN || 'bloby.bot';
  const videoBase = `https://www.${domain}/assets/videos/bloby_restarting`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Restarting | Bloby</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',system-ui,-apple-system,sans-serif;
      background:#0a0a0b;color:#e4e4e7;display:flex;align-items:center;
      justify-content:center;min-height:100dvh;padding:1.5rem;overflow:hidden}
    .c{text-align:center;max-width:420px;width:100%;animation:fade-up .6s ease-out both}
    .video-wrap{position:relative;width:220px;height:220px;margin:0 auto 1.4rem;
      display:flex;align-items:center;justify-content:center}
    .video-wrap::before{content:'';position:absolute;inset:-20px;
      background:radial-gradient(circle,rgba(175,39,227,0.18) 0%,transparent 60%);
      filter:blur(20px);animation:pulse-glow 3s ease-in-out infinite}
    .video-wrap video{position:relative;width:100%;height:100%;object-fit:contain;
      pointer-events:none;border-radius:50%}
    h1{font-family:'Space Grotesk',sans-serif;font-size:1.6rem;font-weight:700;
      margin-bottom:.6rem;background:linear-gradient(135deg,#04D1FE,#AF27E3,#FB4072);
      -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
    p{color:#a1a1aa;line-height:1.6;margin-bottom:.6rem;font-size:.95rem}
    .lead{color:#e4e4e7;font-size:1rem}
    .sub{font-size:.85rem;color:#71717a;display:inline-flex;align-items:center;gap:.5rem;
      background:#18181b;border:1px solid #27272a;border-radius:9999px;
      padding:.35rem .9rem;margin-top:.4rem}
    .sub .dot{width:8px;height:8px;border-radius:50%;
      background:linear-gradient(135deg,#04D1FE,#AF27E3);
      box-shadow:0 0 8px rgba(175,39,227,0.6);animation:pulse 1.6s ease-in-out infinite}
    .badge{display:inline-block;background:#18181b;border:1px solid #27272a;
      border-radius:999px;padding:.2rem .7rem;font-size:.7rem;color:#52525b;
      margin-top:1.2rem;font-family:'Space Grotesk',sans-serif}
    @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.85)}}
    @keyframes pulse-glow{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}
    @keyframes fade-up{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}
  </style>
</head>
<body><div class="c">
  <div class="video-wrap">
    <video autoplay loop muted playsinline>
      <source src="${videoBase}.webm" type="video/webm">
    </video>
  </div>
  <h1>Agent is restarting</h1>
  <p class="lead">Hang tight — your bot is coming back online.</p>
  <p>This can happen after an update, a restart, or a brief network hiccup. No action needed; the page will refresh automatically once the agent is back.</p>
  <div class="sub" id="status"><span class="dot"></span><span id="statusText">Reconnecting…</span></div>
  <div><span class="badge">Powered by Bloby</span></div>
</div>
<script>
(function(){
  var attempt = 0;
  var statusEl = document.getElementById('statusText');
  function retry() {
    attempt++;
    fetch(location.href, { cache: 'no-store', redirect: 'follow' })
      .then(function(r) {
        if (r.ok || (r.status !== 502 && r.status !== 503)) {
          location.reload();
        } else {
          schedule();
        }
      })
      .catch(function() { schedule(); });
  }
  function schedule() {
    var delay = Math.min(3000, 1000 + attempt * 250);
    statusEl.textContent = 'Reconnecting in ' + Math.ceil(delay/1000) + 's… (attempt ' + attempt + ')';
    setTimeout(retry, delay);
  }
  setTimeout(retry, 1800);
})();
</script>
</body>
</html>`;
}

export default proxy;
