# morphy-edge — Cloudflare data plane for bot subdomains

Replaces the Railway relay's **reverse-proxy role** on `<handle>.morphyagent.com` with a
Cloudflare Worker + one Durable Object per bot. Railway keeps everything else (auth,
register/heartbeat API, marketplace, Stripe, EC2 provisioning) and remains the fallback
origin for every host and handle this worker doesn't actively route.

Full architecture + rationale: `Bloby/SELFHOSTED-DIRECT-2026-07-01.md` (the DO-carrier
variant decided 2026-07-01).

## Status (2026-07-02) — carrier live on the dogfood bot, soaking before cloudflared removal

- **Step 1 (quick routes): DONE.** All self-hosted bots (`*.open.morphyagent.com`, orange-cloud
  wildcard) go browser → CF Worker → quick tunnel; the Railway data-plane hop is gone. Managed
  first-level bots untouched (direct EC2).
- **Step 2 (persistent carrier): BUILT + DEPLOYED, in soak.** The DO terminates the agent's two
  hibernatable WSS carriers (control + bulk), verifies an Ed25519 ticket (public key only), and
  muxes browser HTTP + WebSockets down them. Verified end-to-end on the `bloby` bot: page load,
  chat WS, **Vite HMR live-reload**, uploads, mid-session restart, Mac native app — all working,
  and noticeably faster. Agent ships in `morphyagent` **v0.3.2** (`tunnel.mode:'relay'`, opt-in;
  default stays `quick`).
  - Ed25519 keys: `EDGE_TICKET_SK` (base64 PKCS8) on Railway; `EDGE_TICKET_PK` worker secret.
    Regenerate with `scripts/gen-edge-keys.mjs` (must re-set BOTH sides).
  - **Auto-fallback:** if the carrier can't connect within 15s the agent falls back to a quick
    tunnel, so a bot is never left dark. Next restart retries the carrier.
  - **Presence:** the DO POSTs `/api/edge/presence` (EDGE_ADMIN_SECRET) on connect/drop → keeps
    `users.isOnline` accurate (relay mode has no heartbeat).
  - **Alexa** relay→bot forwarding now uses the bot's public origin (works on any transport).
- **REMAINING before "drop cloudflared fully":**
  1. Soak `relay` on the dogfood bot + a few beta testers for several days (incl. sleep/wake,
     network changes, corporate/captive-portal networks).
  2. Add a **runtime** fallback (carrier connected then drops permanently > ~60s → start quick).
     Today fallback is boot-time only; transient drops self-heal via reconnect.
  3. **Flip onboarding default** quick→relay for new installs (Bloby `OnboardWizard` + config
     default), migrate existing users' `tunnel.mode`.
  4. **Delete cloudflared** (Bloby `supervisor/tunnel.ts` downloader/spawn, trycloudflare regex,
     quick-rotation watchdog branch — KEEP the wake hook) + retire `PUT /api/tunnel` + heartbeat
     for relay bots. Only after 2–3 prove out in the field.

## The two steps

**Step 1 — "quick routes" (this code, shippable now).** Agents keep running cloudflared
quick tunnels, unchanged. The relay mirrors each bot's routing state (tunnelUrl +
liveness) into the bot's DO (`backend/lib/edge.js`), and the worker proxies
browser traffic straight from the CF PoP to the trycloudflare URL:

```
today:   browser → CF → Railway (1 region) → CF quick-tunnel edge → cloudflared → :7400
step 1:  browser → CF PoP (worker)         → CF quick-tunnel edge → cloudflared → :7400
step 2:  browser → CF PoP (worker) → bot's DO ⇄ persistent WSS carrier → supervisor :7400
```

What Step 1 buys: the Railway hop and its single-region latency are gone from the data
path; route updates are strongly consistent and instant (no 30×1s DNS warming, no 4s
micro-cache); WS proxying (chat + Vite HMR) is a transparent runtime splice.
What it does NOT fix: quick tunnels still rotate random URLs on drop/sleep — the
restart window shrinks but only Step 2 kills it.

**Step 2 — the carrier (next).** The agent replaces cloudflared with a pure-Node
persistent WSS client (`supervisor/relay-tunnel.ts` in the Bloby repo) that dials its
own DO (incoming WS → hibernatable). The DO's route becomes `{ kind: 'carrier' }` and
traffic is muxed down the agent's socket. Requires on top of this code:
- mux framing in the DO (spec: `Bloby/SELFHOSTED-DIRECT-2026-07-01-BUILD-DOC.md`)
- `POST /api/edge/ticket` on Railway (Ed25519-signed, private key ONLY on Railway)
- ticket verification in the worker (public key in a worker var)
- agent-side loopback-guard hardening (per-process nonce) — ships in the SAME Bloby
  release as the carrier, see report §5.4 (fatal #2)

## Components

| File | Role |
|------|------|
| `src/index.js` | Worker: host→tier/handle parsing, route lookup (2s isolate cache), HTTP/WS proxy with the full parity contract ported from `backend/lib/proxy.js` (CF-error classification, branded-page substitution, retry-once, NO_CACHE on 5xx), admin API |
| `src/bot-do.js` | `BotDO` — per-bot route authority (`idFromName("tier:username")`), liveness window (360s, mirrors HEARTBEAT_TIMEOUT), restarting→offline grace state (25s) |
| `src/pages.js` | Branded restarting/offline pages + JSON body, ported from `backend/lib/pages.js` (**drift hazard — re-port if the originals change**) |
| `../backend/lib/edge.js` | Relay-side mirror calls (register/rotate → PUT route, heartbeat → touch, disconnect/handle-delete → clear). Best-effort, 3s timeout, total no-op until env vars set |

**Design rule: additive, never authoritative.** No fresh route in the DO → the worker
passes the request through to origin untouched, so Railway serves exactly what it
serves today (its proxy, offline/404 pages) and managed-tier bots resolve via their own
A-records. Deploying the worker with zero registered routes is a provable no-op.

## Deploy & rollout

```sh
cd edge
npm install
npx wrangler secret put EDGE_ADMIN_SECRET   # mint something long+random
npx wrangler deploy                          # no zone routes yet → workers.dev only
curl https://morphy-edge.<account>.workers.dev/__edge/health
```

Railway env (both must be set or the relay never calls the edge):

```
EDGE_ADMIN_URL=https://morphy-edge.<account>.workers.dev
EDGE_ADMIN_SECRET=<same secret>
```

Then, in order — each stage independently revertible:

1. **Mirror only** (routes still commented out in `wrangler.toml`): relay populates DOs,
   zero traffic through the worker. Verify with
   `GET /__edge/route?username=<u>&tier=premium` (send the `x-edge-secret` header).
2. **Canary**: add `yourbot.morphyagent.com/*` to `routes`, redeploy. That one bot's
   traffic flows through the worker. Soak: chat WS, Vite HMR, uploads, restart the
   agent mid-session (should show the branded restarting page, then recover), sleep/wake.
   Rollback = remove the route.
3. **Wildcard**: order the Advanced Certificate for `*.open.morphyagent.com` first
   (Universal SSL does NOT cover second-level wildcards), then enable both wildcard
   routes. Rollback = remove the routes; Railway path is still fully intact underneath.
4. Only after Step 2 is fleet-proven does any Railway proxy code get deleted.

## Gotchas / invariants

- The worker must NEVER handle `api.`/`www.`/`open.` app traffic: `parseBotHost`
  skips them → passthrough. The catch-all `/__edge/*` admin prefix is shadowed away
  from bot paths (403 without the secret).
- `X-Bloby-Origin`, `sec-fetch-*`, `Accept` pass through untouched — the supervisor's
  shell-vs-iframe routing depends on them.
- No proxy inactivity timeouts anywhere: the agent's SSE chat stream (25s pings)
  must survive. Workers' fetch has no default idle timeout; keep it that way.
- Body sniffing reads decoded bytes (Workers fetch de-gzips transparently) — the
  agent-marker/CF-marker lists must stay in sync with `backend/lib/proxy.js`.
- DO name is `"tier:username"` (`premium:bruno` / `at:bruno`) — the same handle on
  different tiers is two different bots, exactly like the Mongo `username+tier` key.
