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
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Unreachable | Bloby</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
      background:#0a0a0b;color:#e4e4e7;display:flex;align-items:center;
      justify-content:center;min-height:100vh;padding:1.5rem}
    .c{text-align:center;max-width:460px}
    h1{font-size:1.4rem;margin-bottom:.5rem}
    p{color:#a1a1aa;line-height:1.6;margin-bottom:.75rem}
    .sub{font-size:.85rem}
    .badge{display:inline-block;background:#18181b;border:1px solid #27272a;
      border-radius:999px;padding:.2rem .7rem;font-size:.7rem;color:#52525b;margin-top:.5rem}
  </style>
</head>
<body><div class="c">
  <h1>Bot Unreachable</h1>
  <p>The bot's tunnel is not responding. It may be restarting.</p>
  <p class="sub" id="status">Retrying...</p>
  <span class="badge">Powered by Bloby</span>
</div>
<script>
(function(){
  var attempt = 0;
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
    var delay = Math.min(2000, 500 + attempt * 200);
    document.getElementById('status').textContent = 'Retrying in ' + Math.ceil(delay/1000) + 's... (attempt ' + attempt + ')';
    setTimeout(retry, delay);
  }
  setTimeout(retry, 1500);
})();
</script>
</body>
</html>`;
}

export default proxy;
