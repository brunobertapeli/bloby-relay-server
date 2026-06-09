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
import instanceRoutes from './routes/instances.js';
import stripeRoutes, { stripeWebhookHandler } from './routes/stripe.js';
import claimRoutes from './routes/claim.js';
import marketplaceRoutes from './routes/marketplace.js';
import serviceRoutes from './routes/services.js';
import extensionRoutes from './routes/extension.js';
import resolveRoutes from './routes/resolve.js';
import worldRoutes from './routes/world.js';
import messengerRoutes from './routes/messenger.js';
import alexaRoutes, { handleAlexaRequest } from './routes/alexa.js';
import telegramRoutes, { handleTelegramManagerWebhook, ensureManagerWebhook } from './routes/telegram.js';
import { zoneTracker } from './middleware/zoneTracker.js';
import { NO_CACHE, notFoundPage, errorPage } from './lib/pages.js';

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
      // Allow any subdomain of the relay domain (e.g. www.bloby.bot)
      if (relayDomain && origin.endsWith(`.${relayDomain}`)) return cb(null, true);
      // Allow Chrome extension origins
      if (origin.startsWith('chrome-extension://')) return cb(null, true);
      cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }),
);

// ─── Connect to MongoDB ─────────────────────────────────────────────────────
await connect();

// ─── Register the Telegram manager-bot webhook (idempotent; no manual setWebhook needed) ─────
ensureManagerWebhook();

// ─── Subdomain resolver (before any route matching) ─────────────────────────
// Intercepts  username.bloby.bot  →  reverse-proxies to tunnel
// MUST run before body parsing — express.json() consumes the request stream,
// which prevents http-proxy from forwarding POST bodies to bot tunnels.
app.use(subdomainResolver);

// ─── Stripe webhook (raw body — must be BEFORE express.json()) ──────────────
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

// ─── Alexa skill webhook (raw body — must be BEFORE express.json()) ─────────
// Signature verification needs the exact bytes Amazon signed.
app.post('/api/alexa/handle', express.raw({ type: 'application/json', limit: '64kb' }), handleAlexaRequest);

// ─── Telegram manager-bot webhook (managed_bot updates) ─────────────────────
// Telegram sends JSON; authenticity is the secret-token header (no body signature),
// so plain express.json() is fine. Mounted before the global parser for symmetry.
app.post('/api/telegram/manager-webhook', express.json({ limit: '256kb' }), handleTelegramManagerWebhook);

// ─── Body parsing (relay API only — after subdomain proxy) ───────────────────
app.use('/api', express.json({ limit: '16kb' }));

// ─── API routes ──────────────────────────────────────────────────────────────
app.use('/api', apiLimiter);
app.use(zoneTracker);
app.use('/api', registerRoutes);
app.use('/api', tunnelRoutes);
app.use('/api', statusRoutes);
app.use('/api', availabilityRoutes);
app.use('/api', authRoutes);
app.use('/api', instanceRoutes);
app.use('/api', stripeRoutes);
app.use('/api', claimRoutes);
app.use('/api', marketplaceRoutes);
app.use('/api', serviceRoutes);
app.use('/api', extensionRoutes);
app.use('/api', worldRoutes);
app.use('/api', messengerRoutes);
app.use('/api', alexaRoutes);
app.use('/api', telegramRoutes);
app.use('/api', healthRoutes);

// ─── Install scripts ────────────────────────────────────────────────────────
// curl -fsSL https://bloby.bot/install | sh
// irm https://bloby.bot/install.ps1 | iex
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
// bloby.bot  →  www.bloby.bot  (so visitors see the website, not "Cannot GET /")
app.get('/', (req, res, next) => {
  const domain = process.env.RELAY_DOMAIN;
  if (domain && req.hostname === domain) {
    return res.redirect(301, `https://www.${domain}/`);
  }
  next();
});

// ─── Path-based fallback (must be last route) ────────────────────────────────
// Handles  relay.bloby.bot/username  →  reverse-proxies to tunnel
app.use('/', resolveRoutes);

// ─── Branded catch-all 404 ───────────────────────────────────────────────────
// Anything that fell through (an unmatched non-/api path) gets the branded page, never a bare
// "Cannot GET /…". API paths still get JSON so programmatic callers aren't handed HTML.
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).set(NO_CACHE).json({ error: 'Not found' });
  }
  res.status(404).set(NO_CACHE).type('html').send(notFoundPage());
});

// ─── Global error handler ────────────────────────────────────────────────────
// Content-negotiated: API / XHR callers get JSON; browser navigations get the branded page.
app.use((err, req, res, _next) => {
  console.error('[server] Unhandled error:', err.message);
  if (res.headersSent) return;
  if (req.path.startsWith('/api') || req.xhr || !String(req.headers.accept || '').includes('text/html')) {
    return res.status(500).set(NO_CACHE).json({ error: 'Internal server error' });
  }
  res.status(500).set(NO_CACHE).type('html').send(errorPage());
});

// ─── Start ───────────────────────────────────────────────────────────────────
const server = http.createServer(app);

// ─── WebSocket upgrade handler (proxy WS to bot tunnels) ─────────────────────
const relayDomainForWs = process.env.RELAY_DOMAIN;

server.on('upgrade', async (req, socket, head) => {
  // Guard the raw socket so a write-after-destroy (e.g. the client hung up) can't crash the relay.
  socket.on('error', () => {});

  const host = req.headers.host?.split(':')[0];
  const url = req.url;
  console.log(`[ws-upgrade] host=${host} url=${url} relayDomain=${relayDomainForWs}`);

  if (!host || !relayDomainForWs || !host.endsWith(`.${relayDomainForWs}`)) {
    console.log('[ws-upgrade] rejected: host mismatch');
    return socket.destroy();
  }

  // Skip relay's own subdomains (open.<domain> is the free-tier landing host, not a bot)
  if (host === `api.${relayDomainForWs}` || host === `www.${relayDomainForWs}` || host === `open.${relayDomainForWs}`) {
    console.log('[ws-upgrade] rejected: relay subdomain');
    return socket.destroy();
  }

  // Same parser as the HTTP path, so the free tier (bruno.open.<domain>) resolves identically.
  const subdomain = host.slice(0, -(relayDomainForWs.length + 1));
  const parsed = parseTierFromSubdomain(subdomain);
  console.log(`[ws-upgrade] subdomain=${subdomain} parsed=${JSON.stringify(parsed)}`);
  if (!parsed) return socket.destroy();

  function closeSocket(statusLine) {
    if (socket.destroyed) return;
    try { socket.write(`HTTP/1.1 ${statusLine}\r\nConnection: close\r\n\r\n`); } catch {}
    socket.destroy();
  }

  try {
    const bot = await lookupBot(parsed.username, parsed.tier);
    console.log(`[ws-upgrade] lookupBot result=${JSON.stringify(bot)}`);
    if (bot) {
      console.log(`[ws-upgrade] proxying WS to ${bot.tunnelUrl}`);
      // Per-call error callback: a dead tunnel during the WS handshake closes cleanly instead of
      // surfacing a raw Cloudflare upgrade failure. (proxy.js also intercepts the upstream response
      // so a 530 is never written to the socket.)
      proxy.ws(req, socket, head, { target: bot.tunnelUrl }, (err) => {
        if (err) {
          console.error('[ws-upgrade] proxy.ws error:', err.message);
          closeSocket('502 Bad Gateway');
        }
      });
    } else {
      console.log('[ws-upgrade] bot not found or offline');
      closeSocket('503 Service Unavailable');
    }
  } catch (err) {
    console.error('[ws-upgrade] error:', err.message);
    socket.destroy();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[relay] Bloby relay server listening on :${PORT}`);
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
