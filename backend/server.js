import http from 'node:http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { connect, close } from './db.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { subdomainResolver, lookupBotForWs } from './routes/resolve.js';
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
import { zoneTracker } from './middleware/zoneTracker.js';
import { NO_CACHE, notFoundPage, errorPage, oauthConnectPage } from './lib/pages.js';
import { startSweeper } from './lib/sweeper.js';

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
      // Allow any subdomain of the relay domain (e.g. www.morphyagent.com)
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

// ─── Subdomain resolver (before any route matching) ─────────────────────────
// Intercepts  username.morphyagent.com  →  reverse-proxies to tunnel
// MUST run before body parsing — express.json() consumes the request stream,
// which prevents http-proxy from forwarding POST bodies to bot tunnels.
app.use(subdomainResolver);

// ─── Stripe webhook (raw body — must be BEFORE express.json()) ──────────────
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

// ─── Alexa skill webhook (raw body — must be BEFORE express.json()) ─────────
// Signature verification needs the exact bytes Amazon signed.
app.post('/api/alexa/handle', express.raw({ type: 'application/json', limit: '64kb' }), handleAlexaRequest);

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
app.use('/api', healthRoutes);

// ─── Install scripts ────────────────────────────────────────────────────────
// curl -fsSL https://morphyagent.com/install | sh
// irm https://morphyagent.com/install.ps1 | iex
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The canonical install scripts are the website's static files (frontend/public/);
// the relay (apex) just redirects so `morphyagent.com/install` keeps working without
// a second drift-prone copy. curl -fsSL and PowerShell irm both follow 302s.
app.get('/install', (_req, res) => {
  res.redirect(302, `https://www.${process.env.RELAY_DOMAIN || 'morphyagent.com'}/install`);
});
app.get('/install.ps1', (_req, res) => {
  res.redirect(302, `https://www.${process.env.RELAY_DOMAIN || 'morphyagent.com'}/install.ps1`);
});

// ─── OAuth code-paste redirect landing page ──────────────────────────────────
// Shared, permanent redirect target for all Morphy OAuth code-paste flows (Fitbit /
// Google Health, etc). Google redirects the browser to https://morphyagent.com/oauth/connect
// after consent; this dumb static page shows the auth tail (search + hash) in a copy
// box so the user can paste it back into their self-hosted agent. Generic & never
// changes — each blueprint just registers this URI on its own Google OAuth client.
//
// Public + unauthenticated (Google's redirect carries no Morphy session). Both the
// bare and trailing-slash forms are served (Google sends exactly what's registered).
//
// SECURITY: the query string holds a single-use OAuth `code` — do NOT log _req.url /
// _req.query here, and never add analytics/beacons to this route.
app.get(['/oauth/connect', '/oauth/connect/'], (_req, res) => {
  res.set(NO_CACHE).type('html').send(oauthConnectPage());
});

// ─── Bare domain → www redirect ──────────────────────────────────────────────
// morphyagent.com  →  www.morphyagent.com  (so visitors see the website, not "Cannot GET /")
app.get('/', (req, res, next) => {
  const domain = process.env.RELAY_DOMAIN;
  if (domain && req.hostname === domain) {
    return res.redirect(301, `https://www.${domain}/`);
  }
  next();
});

// ─── Path-based fallback (must be last route) ────────────────────────────────
// Handles  relay.morphyagent.com/username  →  reverse-proxies to tunnel
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
    // Optimistic lookup: proxy the upgrade whenever a tunnelUrl exists, even if the DB
    // flag is stale/offline. A dead tunnel is closed cleanly by the proxy.ws error
    // callback below; a healthy-but-stale bot keeps its realtime channel instead of being
    // hard-503'd. (The HTTP path — resolveBot — keeps its strict offline check + branded page.)
    const bot = await lookupBotForWs(parsed.username, parsed.tier);
    console.log(`[ws-upgrade] lookupBotForWs result=${JSON.stringify(bot)}`);
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
  console.log(`[relay] Morphy relay server listening on :${PORT}`);
  // Managed-instance reconciliation (stuck provisioning, EC2 health, IP drift, grace periods).
  startSweeper();
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
