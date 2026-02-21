import crypto from 'node:crypto';

/**
 * Generate a cryptographically secure auth token.
 * Returns { raw, hash } — raw is sent to the user once, hash is stored in DB.
 */
export function generateToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = hashToken(raw);
  return { raw, hash };
}

/**
 * SHA-256 hash a token for storage / lookup.
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}
