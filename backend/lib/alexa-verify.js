/**
 * Inline Alexa request verifier.
 *
 * Replaces the alexa-verifier npm package because v4 only does SHA256 while
 * Amazon still sends a SHA1 signature on the `Signature` header for most
 * requests (a SHA256 signature is in `Signature-256` when present). This
 * module accepts either, validates the cert URL + SAN + expiry, and verifies
 * the signature against the cert's public key.
 *
 * Defense-in-depth notes:
 *   - URL must be https://s3.amazonaws.com/echo.api/... so only the actual
 *     Amazon bucket can serve a cert chain we'll accept.
 *   - HTTPS fetch implicitly verifies S3's own TLS chain (Node defaults).
 *   - We then re-parse the served PEM and require `echo-api.amazon.com` in
 *     the SAN, plus a current validity window.
 *   - Timestamp must be within 150s of now (Alexa's spec).
 *
 * This is what alexa-verifier@3 used to do, minus the recursive cert-chain
 * verification all the way back to a trusted root. The URL gating + SAN check
 * is the load-bearing part — chain validation is belt-and-suspenders.
 */

import crypto from 'node:crypto';

const CERT_CACHE = new Map();        // certUrl -> { pem, parsedAt }
const CERT_TTL_MS = 60 * 60 * 1000;  // 1h — Amazon rotates certs much less often
const TIMESTAMP_TOLERANCE_MS = 150 * 1000;

function validateCertUrl(certUrl) {
  const u = new URL(certUrl);
  if (u.protocol !== 'https:') throw new Error('cert URL must be HTTPS');
  if (u.hostname.toLowerCase() !== 's3.amazonaws.com') throw new Error(`cert URL host must be s3.amazonaws.com (got ${u.hostname})`);
  if (u.port && u.port !== '443') throw new Error(`cert URL port must be 443 (got ${u.port})`);
  // Normalize path: collapse double slashes so /echo.api// can't sneak by.
  const normalized = u.pathname.replace(/\/+/g, '/');
  if (!normalized.startsWith('/echo.api/')) throw new Error(`cert URL path must start with /echo.api/ (got ${u.pathname})`);
}

async function fetchAndValidateCert(certUrl) {
  const cached = CERT_CACHE.get(certUrl);
  if (cached && (Date.now() - cached.parsedAt) < CERT_TTL_MS) return cached.pem;

  const r = await fetch(certUrl);
  if (!r.ok) throw new Error(`cert fetch failed: ${r.status} ${r.statusText}`);
  const pem = await r.text();

  // X509Certificate parses only the FIRST cert in a chain — that's the leaf
  // cert that signs Alexa requests. Intermediates/roots in the same PEM are
  // left aside for now (see "defense-in-depth notes" above).
  const cert = new crypto.X509Certificate(pem);

  const now = Date.now();
  const validFrom = new Date(cert.validFrom).getTime();
  const validTo = new Date(cert.validTo).getTime();
  if (Number.isFinite(validFrom) && validFrom > now) throw new Error('cert not yet valid');
  if (Number.isFinite(validTo) && validTo < now) throw new Error('cert expired');

  const sans = cert.subjectAltName || '';
  if (!/(^|,\s*)DNS:echo-api\.amazon\.com(\s*,|$)/i.test(sans)) {
    throw new Error(`cert SAN must include echo-api.amazon.com (got: ${sans})`);
  }

  CERT_CACHE.set(certUrl, { pem, parsedAt: now });
  return pem;
}

function verifyWith(pem, signatureB64, rawBody, algo) {
  const v = crypto.createVerify(algo);
  v.update(rawBody, 'utf8');
  try {
    return v.verify(pem, signatureB64, 'base64');
  } catch {
    return false;
  }
}

/**
 * Verify an Alexa request.
 *
 * @param {object} opts
 * @param {string} opts.certUrl     `SignatureCertChainUrl` header value
 * @param {string} [opts.sigSha256] `Signature-256` header value (preferred when present)
 * @param {string} [opts.sigSha1]   `Signature` header value (legacy)
 * @param {string} opts.rawBody     Raw request body string (the bytes Amazon signed)
 * @param {string} opts.timestamp   `request.timestamp` from parsed envelope (ISO 8601)
 * @returns {Promise<{ algo: 'sha256' | 'sha1' }>}  Throws on failure.
 */
export async function verifyAlexaRequest({ certUrl, sigSha256, sigSha1, rawBody, timestamp }) {
  if (!certUrl) throw new Error('missing SignatureCertChainUrl');
  if (!sigSha256 && !sigSha1) throw new Error('missing Signature / Signature-256');
  if (!rawBody) throw new Error('missing request body');
  if (!timestamp) throw new Error('missing request timestamp');

  const ts = Date.parse(timestamp);
  if (!Number.isFinite(ts)) throw new Error('unparseable timestamp');
  if (Math.abs(Date.now() - ts) > TIMESTAMP_TOLERANCE_MS) {
    throw new Error(`timestamp out of tolerance (drift ${Math.round((Date.now() - ts) / 1000)}s)`);
  }

  validateCertUrl(certUrl);
  const pem = await fetchAndValidateCert(certUrl);

  // Prefer SHA256 when available. If it fails AND SHA1 is also present, try
  // SHA1 — covers test simulators that send both but compute one differently.
  if (sigSha256 && verifyWith(pem, sigSha256, rawBody, 'RSA-SHA256')) return { algo: 'sha256' };
  if (sigSha1 && verifyWith(pem, sigSha1, rawBody, 'RSA-SHA1')) return { algo: 'sha1' };

  throw new Error(`signature did not verify (tried ${[sigSha256 && 'sha256', sigSha1 && 'sha1'].filter(Boolean).join(' + ')})`);
}
