const USERNAME_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export const RESERVED = new Set([
  // Infrastructure / internal
  'api', 'admin', 'www', 'mail', 'ftp', 'localhost', 'relay', 'my',
  'register', 'login', 'signup', 'status', 'health', 'tunnel',
  'heartbeat', 'app', 'dashboard', 'docs', 'help', 'support',
  'blog', 'about', 'contact', 'terms', 'privacy', 'static',
  'assets', 'public', 'favicon', 'robots', 'sitemap', 'disconnect',
  'ws', 'wss', 'socket', 'cdn', 'img', 'css', 'js', 'fonts',
  // Frontend pages / common routes
  'marketplace', 'square', 'how', 'pricing', 'features', 'changelog',
  'store', 'shop', 'download', 'downloads', 'faq', 'explore', 'search',
  'home', 'install', 'settings', 'account', 'profile', 'billing',
  'notifications', 'inbox', 'messages', 'community', 'templates',
  'plugins', 'extensions', 'integrations', 'webhooks', 'oauth', 'sso',
  'verify', 'confirm', 'invite', 'enterprise', 'pro', 'team', 'teams',
  'security', 'legal', 'careers', 'press', 'news', 'updates', 'demo',
]);

// ─── Tiers ───────────────────────────────────────────────────────────────────

const FREE_PREFIXES = new Set(['open']);

export const TIERS = {
  premium: { prefix: null, paid: true, price: 5 },
  at:      { prefix: 'open', paid: false, price: 0 },
};

export const VALID_TIERS = new Set(Object.keys(TIERS));

/**
 * Validate a tier string.
 */
export function validateTier(tier) {
  if (!tier || !VALID_TIERS.has(tier)) {
    return { valid: false, error: 'Invalid tier. Must be one of: premium, at' };
  }
  return { valid: true, tier };
}

/**
 * Build the full relay URL for a username + tier.
 *
 *   premium → https://bloby.bot/bruno
 *   at      → https://my.bloby.bot/bruno
 */
export function buildRelayUrl(username, tier) {
  const domain = process.env.RELAY_DOMAIN || 'bloby.bot';
  const config = TIERS[tier];
  if (config.prefix) {
    return `https://${config.prefix}.${domain}/${username}`;
  }
  return `https://${domain}/${username}`;
}

/**
 * Build the internal subdomain URL for proxying.
 *
 *   premium → https://bruno.bloby.bot
 *   at      → https://bruno.my.bloby.bot
 */
export function buildSubdomainUrl(username, tier) {
  const domain = process.env.RELAY_DOMAIN || 'bloby.bot';
  const config = TIERS[tier];
  if (config.prefix) {
    return `https://${username}.${config.prefix}.${domain}`;
  }
  return `https://${username}.${domain}`;
}

// Map subdomain prefix back to tier name in DB
const PREFIX_TO_TIER = Object.fromEntries(
  Object.entries(TIERS).filter(([, c]) => c.prefix).map(([tier, c]) => [c.prefix, tier]),
);

/**
 * Parse tier + username from a subdomain.
 *
 * Premium:  subdomain "bruno"      → { tier: "premium", username: "bruno" }
 * Free:     subdomain "bruno.my"   → { tier: "at", username: "bruno" }
 */
export function parseTierFromSubdomain(subdomain) {
  // Two-level subdomain: "bruno.my" → free tier
  if (subdomain.includes('.')) {
    const parts = subdomain.split('.');
    const prefix = parts[parts.length - 1];
    const username = parts.slice(0, -1).join('.');
    if (FREE_PREFIXES.has(prefix) && username.length >= 3 && username.length <= 30) {
      return { tier: PREFIX_TO_TIER[prefix], username: username.toLowerCase() };
    }
    return null;
  }

  // Single-level subdomain → premium username
  if (subdomain.length >= 3 && subdomain.length <= 30) {
    return { tier: 'premium', username: subdomain.toLowerCase() };
  }

  return null;
}

// ─── Username validation ─────────────────────────────────────────────────────

/**
 * Validate and normalise a username.
 * Rules: 3-30 chars, lowercase alphanumeric + hyphens, no leading/trailing hyphen.
 */
export function validateUsername(raw) {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, error: 'Username is required' };
  }

  const username = raw.toLowerCase().trim();

  if (username.length < 3 || username.length > 30) {
    return { valid: false, error: 'Username must be 3–30 characters' };
  }

  if (!USERNAME_RE.test(username)) {
    return {
      valid: false,
      error: 'Only lowercase letters, numbers, and hyphens allowed (cannot start or end with a hyphen)',
    };
  }

  if (RESERVED.has(username)) {
    return { valid: false, error: 'This username is reserved' };
  }

  return { valid: true, username };
}

// ─── Tunnel URL validation ───────────────────────────────────────────────────

/**
 * Validate a tunnel URL.  Must be HTTPS.
 */
export function validateTunnelUrl(raw) {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, error: 'Tunnel URL is required' };
  }

  try {
    const parsed = new URL(raw.trim());

    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Tunnel URL must use HTTPS' };
    }

    if (parsed.hostname.length < 3) {
      return { valid: false, error: 'Invalid hostname' };
    }

    // Return origin only (no path / query / hash)
    return { valid: true, url: parsed.origin };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}
