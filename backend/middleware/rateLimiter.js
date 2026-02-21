import rateLimit from 'express-rate-limit';

/** Registration — 5 per IP per hour */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registrations — try again later' },
});

/** Tunnel URL updates — 30 per user per minute */
export const tunnelLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many tunnel updates — slow down' },
  keyGenerator: (req) => req.user?.username || req.ip,
});

/** Heartbeats — 60 per user per minute */
export const heartbeatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many heartbeats — slow down' },
  keyGenerator: (req) => req.user?.username || req.ip,
});

/** Redirect lookups — 120 per IP per minute */
export const redirectLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests — please try again later',
});

/** General API — 100 per IP per minute */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded — please try again later' },
});
