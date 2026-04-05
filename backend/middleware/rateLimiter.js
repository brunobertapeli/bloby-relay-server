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

/** Claim code generation — 10 per account per hour */
export const claimGenerateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many claim codes generated — try again later' },
});

/** Claim verification — 5 per IP per 5 minutes (anti-brute-force) */
export const claimVerifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many verification attempts — try again later' },
});

/** Marketplace checkout — 20 per account per hour */
export const marketplaceCheckoutLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many checkout attempts — try again later' },
});

/** Marketplace redeem — 10 per IP per 5 minutes (anti-brute-force) */
export const marketplaceRedeemLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many redeem attempts — try again later' },
});

/** Google auth — 10 per IP per 15 minutes */
export const authGoogleLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts — try again later' },
});

/** Instance provisioning callback — 20 per IP per minute */
export const instanceCallbackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many callback requests — try again later' },
});

/** Claim status polling — 30 per IP per minute */
export const claimStatusLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many status checks — try again later' },
});

/** Claim blobies list — 15 per IP per minute */
export const claimBlobiesLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — try again later' },
});
