import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { connect, close } from './db.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { subdomainResolver } from './routes/resolve.js';
import registerRoutes from './routes/register.js';
import tunnelRoutes from './routes/tunnel.js';
import statusRoutes from './routes/status.js';
import healthRoutes from './routes/health.js';
import availabilityRoutes from './routes/availability.js';
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

// ─── Body parsing (small payloads only) ──────────────────────────────────────
app.use(express.json({ limit: '16kb' }));

// ─── Connect to MongoDB ─────────────────────────────────────────────────────
await connect();

// ─── Subdomain resolver (before any route matching) ─────────────────────────
// Intercepts  username.fluxy.bot  →  302 to tunnel URL
app.use(subdomainResolver);

// ─── API routes ──────────────────────────────────────────────────────────────
app.use('/api', apiLimiter);
app.use('/api', registerRoutes);
app.use('/api', tunnelRoutes);
app.use('/api', statusRoutes);
app.use('/api', availabilityRoutes);
app.use('/api', healthRoutes);

// ─── Path-based fallback (must be last) ──────────────────────────────────────
// Handles  relay.fluxy.bot/username  →  302 to tunnel URL
app.use('/', resolveRoutes);

// ─── Global error handler ────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[server] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ───────────────────────────────────────────────────────────────────
const server = app.listen(PORT, '0.0.0.0', () => {
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
