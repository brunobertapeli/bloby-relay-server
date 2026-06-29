// Cloudflare DNS client for the MANAGED ("hosted") tier.
//
// Each managed bot gets its own proxied A-record  mybot.morphyagent.com → <EC2 public IP>
// on the operator's Cloudflare zone, so the browser reaches the box DIRECTLY through
// Cloudflare's edge (TLS + DDoS) with no relay hop and no cloudflared tunnel.
//
// A more-specific A-record overrides the existing wildcard  *.morphyagent.com → relay,
// so SELF-HOSTED bots (which fall through the wildcard to the relay's reverse-proxy)
// are completely unaffected. This is purely additive.
//
// Needs two env vars (set in Railway):
//   CF_API_TOKEN  — a scoped token with  Zone → DNS → Edit  on the morphyagent.com zone
//   CF_ZONE_ID    — the morphyagent.com zone id
//
// Records are tagged with comment "bloby-managed" so they're easy to audit/sweep.

const CF_API = 'https://api.cloudflare.com/client/v4';

function cfConfigured() {
  return !!(process.env.CF_API_TOKEN && process.env.CF_ZONE_ID);
}

async function cf(path, { method = 'GET', body } = {}) {
  if (!cfConfigured()) {
    throw new Error('Cloudflare DNS not configured (CF_API_TOKEN / CF_ZONE_ID missing)');
  }
  const res = await fetch(`${CF_API}/zones/${process.env.CF_ZONE_ID}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const msg = data.errors?.map((e) => `${e.code}:${e.message}`).join('; ') || res.statusText;
    throw new Error(`Cloudflare API ${method} ${path} failed: ${msg}`);
  }
  return data.result;
}

/** Build the DNS record name for a managed bot from its username + tier. */
export function managedHostname(username, tier) {
  const domain = process.env.RELAY_DOMAIN || 'morphyagent.com';
  // Free tier lives under open.<domain>; premium is a bare subdomain.
  return tier === 'at' ? `${username}.open.${domain}` : `${username}.${domain}`;
}

/** Find the A-record for a hostname, or null. */
export async function findDnsRecord(name) {
  const records = await cf(`/dns_records?type=A&name=${encodeURIComponent(name)}`);
  return records?.[0] || null;
}

/**
 * Point  name → ip  as a PROXIED (orange-cloud) A-record. Idempotent: updates the
 * existing record if one exists, otherwise creates it. Returns the record id.
 */
export async function upsertDnsRecord(name, ip) {
  const payload = {
    type: 'A',
    name,
    content: ip,
    proxied: true,
    ttl: 1, // 1 = "automatic" (required when proxied)
    comment: 'bloby-managed',
  };
  const existing = await findDnsRecord(name);
  if (existing) {
    if (existing.content === ip && existing.proxied) return existing.id;
    const updated = await cf(`/dns_records/${existing.id}`, { method: 'PUT', body: payload });
    return updated.id;
  }
  const created = await cf('/dns_records', { method: 'POST', body: payload });
  return created.id;
}

/** Delete a managed A-record by id (best-effort; tolerates already-deleted). */
export async function deleteDnsRecord(recordId) {
  if (!recordId) return;
  try {
    await cf(`/dns_records/${recordId}`, { method: 'DELETE' });
  } catch (err) {
    // A 404 (already gone) is fine; re-throw anything else for the caller to log.
    if (!/81044|Record does not exist|not found/i.test(err.message)) throw err;
  }
}

/** Delete a managed A-record by hostname (when the id wasn't stored). */
export async function deleteDnsRecordByName(name) {
  const existing = await findDnsRecord(name);
  if (existing) await deleteDnsRecord(existing.id);
}

export { cfConfigured };
