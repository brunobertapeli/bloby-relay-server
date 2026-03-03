import http from 'node:http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { connect, close } from './db.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { subdomainResolver, lookupBot } from './routes/resolve.js';
import { parseTierFromSubdomain } from './lib/validate.js';
import proxy from './lib/proxy.js';
import registerRoutes from './routes/register.js';
import tunnelRoutes from './routes/tunnel.js';
import statusRoutes from './routes/status.js';
import healthRoutes from './routes/health.js';
import availabilityRoutes from './routes/availability.js';
import authRoutes from './routes/auth.js';
import resolveRoutes from './routes/resolve.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Trust proxy (Railway / Cloudflare) ─────────────────────────────────────
app.set('trust proxy', 1);

// ─── Security headers ───────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // inline styles in status pages
  }),
);

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = [process.env.FRONTEND_URL].filter(Boolean);
const relayDomain = process.env.RELAY_DOMAIN;

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // non-browser requests
      if (origin.includes('.up.railway.app')) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      // Allow any subdomain of the relay domain (e.g. www.fluxy.bot)
      if (relayDomain && origin.endsWith(`.${relayDomain}`)) return cb(null, true);
      cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }),
);

// ─── Connect to MongoDB ─────────────────────────────────────────────────────
await connect();

// ─── Subdomain resolver (before any route matching) ─────────────────────────
// Intercepts  username.fluxy.bot  →  reverse-proxies to tunnel
// MUST run before body parsing — express.json() consumes the request stream,
// which prevents http-proxy from forwarding POST bodies to bot tunnels.
app.use(subdomainResolver);

// ─── Body parsing (relay API only — after subdomain proxy) ───────────────────
app.use('/api', express.json({ limit: '16kb' }));

// ─── API routes ──────────────────────────────────────────────────────────────
app.use('/api', apiLimiter);
app.use('/api', registerRoutes);
app.use('/api', tunnelRoutes);
app.use('/api', statusRoutes);
app.use('/api', availabilityRoutes);
app.use('/api', authRoutes);
app.use('/api', healthRoutes);

// ─── Install scripts ────────────────────────────────────────────────────────
// curl -fsSL https://fluxy.bot/install | sh
// irm https://fluxy.bot/install.ps1 | iex
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.get('/install', (_req, res) => {
  res.type('text/plain').sendFile(path.join(__dirname, 'public', 'install.sh'));
});
app.get('/install.ps1', (_req, res) => {
  res.type('text/plain').sendFile(path.join(__dirname, 'public', 'install.ps1'));
});

// ─── Bare domain → www redirect ──────────────────────────────────────────────
// fluxy.bot  →  www.fluxy.bot  (so visitors see the website, not "Cannot GET /")
app.get('/', (req, res, next) => {
  const domain = process.env.RELAY_DOMAIN;
  if (domain && req.hostname === domain) {
    return res.redirect(301, `https://www.${domain}`);
  }
  next();
});

// ─── Path-based fallback (must be last) ──────────────────────────────────────
// Handles  relay.fluxy.bot/username  →  reverse-proxies to tunnel
app.use('/', resolveRoutes);

// ─── Global error handler ────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[server] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ───────────────────────────────────────────────────────────────────
const server = http.createServer(app);

// ─── WebSocket upgrade handler (proxy WS to bot tunnels) ─────────────────────
const relayDomainForWs = process.env.RELAY_DOMAIN;

server.on('upgrade', async (req, socket, head) => {
  const host = req.headers.host?.split(':')[0];
  const url = req.url;
  console.log(`[ws-upgrade] host=${host} url=${url} relayDomain=${relayDomainForWs}`);

  if (!host || !relayDomainForWs || !host.endsWith(`.${relayDomainForWs}`)) {
    console.log('[ws-upgrade] rejected: host mismatch');
    return socket.destroy();
  }

  // Skip relay's own subdomains
  if (host === `api.${relayDomainForWs}` || host === `www.${relayDomainForWs}`) {
    console.log('[ws-upgrade] rejected: relay subdomain');
    return socket.destroy();
  }

  const subdomain = host.slice(0, -(relayDomainForWs.length + 1));
  const parsed = parseTierFromSubdomain(subdomain);
  console.log(`[ws-upgrade] subdomain=${subdomain} parsed=${JSON.stringify(parsed)}`);
  if (!parsed) return socket.destroy();

  try {
    const bot = await lookupBot(parsed.username, parsed.tier);
    console.log(`[ws-upgrade] lookupBot result=${JSON.stringify(bot)}`);
    if (bot) {
      console.log(`[ws-upgrade] proxying WS to ${bot.tunnelUrl}`);
      proxy.ws(req, socket, head, { target: bot.tunnelUrl });
    } else {
      console.log('[ws-upgrade] bot not found or offline');
      socket.destroy();
    }
  } catch (err) {
    console.error('[ws-upgrade] error:', err);
    socket.destroy();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[relay] Fluxy relay server listening on :${PORT}`);
});

// ─── Graceful shutdown ───────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(`[relay] ${signal} received — shutting down`);
  server.close(async () => {
    await close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
