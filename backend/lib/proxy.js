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
    // HTTP request — send 502 page
    res.writeHead(502, { 'Content-Type': 'text/html' });
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
  <title>Unreachable | Fluxy</title>
  <meta http-equiv="refresh" content="10">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
      background:#0a0a0b;color:#e4e4e7;display:flex;align-items:center;
      justify-content:center;min-height:100vh;padding:1.5rem}
    .c{text-align:center;max-width:460px}
    h1{font-size:1.4rem;margin-bottom:.5rem}
    p{color:#a1a1aa;line-height:1.6;margin-bottom:.75rem}
    .badge{display:inline-block;background:#18181b;border:1px solid #27272a;
      border-radius:999px;padding:.2rem .7rem;font-size:.7rem;color:#52525b;margin-top:.5rem}
  </style>
</head>
<body><div class="c">
  <h1>Bot Unreachable</h1>
  <p>The bot's tunnel is not responding. It may be restarting.</p>
  <p>This page auto-refreshes every 10 seconds.</p>
  <span class="badge">Powered by Fluxy</span>
</div></body>
</html>`;
}

export default proxy;
