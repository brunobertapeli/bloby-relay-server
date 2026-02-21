const USERNAME_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

const RESERVED = new Set([
  'api', 'admin', 'www', 'mail', 'ftp', 'localhost', 'relay',
  'register', 'login', 'signup', 'status', 'health', 'tunnel',
  'heartbeat', 'app', 'dashboard', 'docs', 'help', 'support',
  'blog', 'about', 'contact', 'terms', 'privacy', 'static',
  'assets', 'public', 'favicon', 'robots', 'sitemap', 'disconnect',
  'ws', 'wss', 'socket', 'cdn', 'img', 'css', 'js', 'fonts',
]);

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
