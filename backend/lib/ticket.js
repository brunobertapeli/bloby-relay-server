// Short-lived Ed25519-signed carrier tickets (Step 2 of the DO-carrier migration).
//
// The agent mints a ticket from its long-lived relay token (POST /api/edge/ticket),
// then dials its Durable Object's carrier with the ticket as a Bearer credential.
// The DO verifies the ticket with the PUBLIC key only — the private key never leaves
// Railway, so a compromised edge node can verify but never forge (report §5, fatal #1).
//
// Ticket = base64url(payload) + "." + base64url(ed25519_sig(payload))
//   payload = { u:username, t:tier, iat, exp, jti }
//
// Configured only when EDGE_TICKET_SK is set (base64 PKCS8 DER of an Ed25519 private
// key). Generate the pair with scripts/gen-edge-keys.mjs.

import crypto from 'node:crypto';

const TICKET_TTL_S = 300; // 5 minutes

let cachedKey = null;
function privKey() {
  if (cachedKey) return cachedKey;
  const b64 = process.env.EDGE_TICKET_SK;
  if (!b64) return null;
  cachedKey = crypto.createPrivateKey({
    key: Buffer.from(b64, 'base64'),
    format: 'der',
    type: 'pkcs8',
  });
  return cachedKey;
}

export function ticketConfigured() {
  return !!process.env.EDGE_TICKET_SK;
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

/**
 * Mint a signed carrier ticket for a verified relay user.
 * @param {{username:string, tier:string}} user
 * @returns {{ticket:string, expiresIn:number}}
 */
export function mintTicket(user) {
  const key = privKey();
  if (!key) throw new Error('EDGE_TICKET_SK not configured');
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    u: user.username,
    t: user.tier,
    iat: now,
    exp: now + TICKET_TTL_S,
    jti: crypto.randomUUID(),
  };
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.sign(null, Buffer.from(body), key); // null algo = Ed25519
  return { ticket: `${body}.${b64url(sig)}`, expiresIn: TICKET_TTL_S };
}
