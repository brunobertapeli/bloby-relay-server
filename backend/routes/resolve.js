import { Router } from 'express';
import { getUsers } from '../db.js';
import { redirectLimiter } from '../middleware/rateLimiter.js';
import { parseTierFromSubdomain, buildSubdomainUrl, RESERVED } from '../lib/validate.js';
import proxy, { reqContext } from '../lib/proxy.js';
import { NO_CACHE, notFoundPage, errorPage, offlinePage, restartingPage } from '../lib/pages.js';

const HEARTBEAT_TIMEOUT = parseInt(process.env.HEARTBEAT_TIMEOUT_MS || '90000', 10);
// How long a Cloudflare error may persist (while the DB still thinks the bot is live) before the
// substituted page flips from the optimistic "restarting" to the calm "offline" variant. Covers an
// ungraceful hard kill / power-off, where the heartbeat hasn't gone stale yet.
const RESTART_GRACE_MS = parseInt(process.env.RESTART_GRACE_MS || '25000', 10);

// username → first-seen timestamp of a Cloudflare error while the DB still says online.
// Set by the proxy's onCfError hook, cleared on a real agent response (onLive) or when resolveBot
// serves the offline page (DB-confirmed down). Bounded: entries self-clean within the heartbeat
// timeout, since a stale bot lands in the down branch which deletes its entry.
const cfErrorSince = new Map();

const router = Router();

// Error/status pages must never be cached — a stale 502/503 page causes a "Host Error" on restart.
const NO_CACHE_HEADERS = NO_CACHE;

// ─── Core resolve logic (shared by subdomain + path handlers) ───────────────

async function resolveBot(username, tier, req, res) {
  if (username.includes('.') || username.length < 3 || username.length > 30) {
    return res.set(NO_CACHE_HEADERS).status(404).send(notFoundPage());
  }

  let user;
  try {
    const query = { username };
    if (tier) query.tier = tier;
    user = await getUsers().findOne(
      query,
      { projection: { username: 1, tier: 1, tunnelUrl: 1, isOnline: 1, lastHeartbeat: 1 } },
    );
  } catch (err) {
    // A transient DB blip must not surface as a raw 500 — treat it as a transient restart.
    console.error('[resolve] db lookup failed:', err.message);
    return res.set(NO_CACHE_HEADERS).status(503).send(restartingPage(username));
  }

  if (!user) {
    return res.set(NO_CACHE_HEADERS).status(404).send(notFoundPage(username));
  }

  // If accessed via the wrong tier subdomain, 404
  if (tier && user.tier !== tier) {
    return res.set(NO_CACHE_HEADERS).status(404).send(notFoundPage(username));
  }

  const stale =
    user.lastHeartbeat &&
    Date.now() - user.lastHeartbeat.getTime() > HEARTBEAT_TIMEOUT;

  // The relay KNOWS the bot is down → the calm, distinct "offline" page (no proxy round-trip).
  if (!user.tunnelUrl || !user.isOnline || stale) {
    if (user.isOnline && stale) {
      getUsers()
        .updateOne({ _id: user._id }, { $set: { isOnline: false } })
        .catch(() => {});
    }
    cfErrorSince.delete(username);
    return res.set(NO_CACHE_HEADERS).status(503).send(offlinePage(username));
  }

  // The DB believes the bot is live. Reverse-proxy to its tunnel; if Cloudflare answers with a
  // tunnel error (1033/530), the proxy substitutes a branded page — "restarting" during the grace
  // window, "offline" once the error has persisted past it.
  const since = cfErrorSince.get(username);
  const page = since && Date.now() - since > RESTART_GRACE_MS ? 'offline' : 'restarting';
  reqContext.set(req, {
    username,
    page,
    onCfError: () => { if (!cfErrorSince.has(username)) cfErrorSince.set(username, Date.now()); },
    onLive: () => { cfErrorSince.delete(username); },
  });

  proxy.web(req, res, { target: user.tunnelUrl, selfHandleResponse: true });
}

// ─── Lookup-only helper (for WS upgrade in server.js) ───────────────────────

export async function lookupBot(username, tier) {
  const query = { username };
  if (tier) query.tier = tier;

  const user = await getUsers().findOne(
    query,
    { projection: { tier: 1, tunnelUrl: 1, isOnline: 1, lastHeartbeat: 1 } },
  );

  if (!user) return null;
  if (tier && user.tier !== tier) return null;

  const stale =
    user.lastHeartbeat &&
    Date.now() - user.lastHeartbeat.getTime() > HEARTBEAT_TIMEOUT;

  if (!user.tunnelUrl || !user.isOnline || stale) {
    if (user.isOnline && stale) {
      getUsers()
        .updateOne({ _id: user._id }, { $set: { isOnline: false } })
        .catch(() => {});
    }
    return null;
  }

  return { tunnelUrl: user.tunnelUrl };
}

// ─── Subdomain middleware ───────────────────────────────────────────────────
// Intercepts:
//   bruno.bloby.bot/*        → premium (username from subdomain)
//   bruno.at.bloby.bot/*     → free "at" tier (username from subdomain)

export function subdomainResolver(req, res, next) {
  const domain = process.env.RELAY_DOMAIN;
  if (!domain) return next();

  const host = req.hostname;

  // Skip bare domain, www, api, and my — relay's own routes apply there
  if (host === domain || host === `www.${domain}` || host === `api.${domain}` || host === `open.${domain}`) return next();

  if (host.endsWith(`.${domain}`)) {
    const subdomain = host.slice(0, -(domain.length + 1));
    const parsed = parseTierFromSubdomain(subdomain);

    if (!parsed) return next();

    // Proxy everything (including /api/* paths) — the bot handles its own API
    return resolveBot(parsed.username, parsed.tier, req, res);
  }

  next();
}

// ─── Path-based shortcut: GET /:username ─────────────────────────────────────
// Redirects:
//   bloby.bot/bruno      →  bruno.bloby.bot       (premium)
//   open.bloby.bot/bruno   →  bruno.open.bloby.bot    (free)

router.get('/:username', redirectLimiter, async (req, res) => {
  try {
    const username = req.params.username.toLowerCase().trim();

    if (username.includes('.') || username.length < 3 || username.length > 30) {
      return res.set(NO_CACHE_HEADERS).status(404).send(notFoundPage());
    }

    // Reserved names are pages, not bots — redirect to www so the SPA handles them
    const domain = process.env.RELAY_DOMAIN;
    if (domain && RESERVED.has(username)) {
      return res.redirect(301, `https://www.${domain}/${username}`);
    }

    // Determine tier from host: open.bloby.bot → free ("at"), bloby.bot → premium
    const host = req.hostname;
    const tier = (domain && host === `open.${domain}`) ? 'at' : 'premium';

    const user = await getUsers().findOne(
      { username, tier },
      { projection: { tier: 1 } },
    );

    if (!user) {
      return res.set(NO_CACHE_HEADERS).status(404).send(notFoundPage(username));
    }

    const subdomainUrl = buildSubdomainUrl(username, user.tier);
    return res.redirect(302, subdomainUrl);
  } catch (error) {
    console.error('[resolve]', error.message);
    res.set(NO_CACHE_HEADERS).status(500).send(errorPage());
  }
});

export default router;
