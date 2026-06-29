# Managed tier — "direct" mode (no cloudflared tunnel)

The managed/hosted tier now reaches each bot **directly** through Cloudflare,
removing the cloudflared quick-tunnel and the relay reverse-proxy hop.

```
OLD:  browser → CF (mybot.morphyagent.com) → Railway relay → CF (trycloudflare) → cloudflared → morphy :7400
NEW:  browser → CF (mybot.morphyagent.com, A→EC2 IP, orange) → Caddy :443 on EC2 → morphy :7400
      morphyagent.com/mybot → CF 302 → mybot.morphyagent.com
```

One hop instead of three; the EC2 public IP is hidden behind CF's proxy (same
"it just works, address bar shows mybot.morphyagent.com" UX as before).

**This is additive.** Self-hosted bots still use cloudflared tunnels + the relay
reverse-proxy via the `*.morphyagent.com → relay` wildcard. A managed bot gets a
*more-specific* A-record (`mybot.morphyagent.com → <EC2 IP>`) that overrides the
wildcard for just that name, so self-hosted is untouched.

---

## What changed in code (already done)

**Agent (`Morphy` repo)**
- `bin/cli.js` — `morphy init --hosted` now honors `MORPHY_TUNNEL_MODE` (managed
  AMI sets `off`), seeds `MORPHY_USERNAME/RELAY_TOKEN/TIER/URL` into config, and
  emits `__HOSTED_READY__` with `status:"ok"` on health (no tunnel needed).
  The supervisor already no-ops cleanly on `tunnel.mode==='off'`.

**Relay (`fluxy-5318` repo)**
- `backend/lib/cloudflare.js` (new) — create/update/delete the per-bot CF A-record.
- `backend/lib/provision.js` (new) — `provisionManagedInstance()`: pre-register the
  handle, mint a `provisionToken`, create the instance, launch EC2 with identity.
- `backend/routes/instances.js` — callback now (a) authenticates via `provisionToken`,
  (b) on `ready` reads the EC2 public IP and creates `mybot.morphyagent.com → IP`,
  (c) refreshes DNS after a restart (stop/start changes the IP), (d) deletes the
  record on terminate. Plus a secret-gated `POST /api/instances/dev-launch`.
- `backend/lib/aws.js` — `launchInstance` passes identity via user-data.
- `backend/routes/stripe.js` — checkout collects a handle; webhook uses
  `provisionManagedInstance` when a handle is present; cancellation frees the DNS.
- `infra/provision.sh`, `infra/Caddyfile` (new) — AMI artifacts (below).

---

## One-time Cloudflare setup

1. **API token** — My Profile → API Tokens → Create → *Edit zone DNS* template,
   scoped to **Zone:DNS:Edit** on the **morphyagent.com** zone only. Save as Railway env
   `CF_API_TOKEN`.
2. **Zone ID** — morphyagent.com overview page → "Zone ID". Save as `CF_ZONE_ID`.
3. **SSL/TLS mode** — set the morphyagent.com zone to **Full (strict)**.
4. **Origin certificate** — SSL/TLS → Origin Server → Create Certificate, hostnames
   `*.morphyagent.com, morphyagent.com`, 15-year. Save the cert → `cf-origin.pem` and key →
   `cf-origin.key` (these get baked into the AMI at `/etc/caddy/`).
5. **Authenticated Origin Pulls CA** — download Cloudflare's origin-pull CA
   (`https://developers.cloudflare.com/.../origin-pull-ca.pem`) → bake as
   `/etc/caddy/cloudflare-aop.pem`.
6. **Redirect rule** (`morphyagent.com/mybot` → `mybot.morphyagent.com`) — Rules → Redirect Rules:
   - When incoming requests match: `Hostname equals morphyagent.com AND URI Path matches regex ^/([a-z0-9][a-z0-9-]{1,28}[a-z0-9])$`
   - Then: Dynamic redirect → `concat("https://", http.request.uri.path.0... )` →
     simplest is expression `concat("https://", regex_replace(http.request.uri.path, "^/", ""), ".morphyagent.com/")`, status **302**.
   - (The relay's existing `GET /:username` 302 also covers this; the edge rule just
     avoids a relay round-trip.)

> Per-bot A-records are free and **uncapped** on Enterprise (1M-record pool). The
> 1,000-tunnel cap does **not** apply — these are DNS records, not tunnels.

## One-time AWS setup

7. **Security group** (`bloby-instances-SG`, all 3 regions) — add inbound **443**
   from **Cloudflare IP ranges only** (https://www.cloudflare.com/ips/). Keep SSH
   (22) for ops. Optionally inbound 80 from CF if you want HTTP→HTTPS at the box.
   *Do not* open 443 to `0.0.0.0/0` — AOP already blocks non-CF, but defense in depth.
8. **Public IP stability (recommended for prod)** — a relay-initiated restart does
   stop/start which assigns a *new* public IP; the callback/restart code refreshes
   the DNS automatically. For zero-flap, allocate an **Elastic IP per instance**
   instead (then DNS never changes). v1 testing is fine without it.

## Railway env vars

```
CF_API_TOKEN=<scoped token>
CF_ZONE_ID=<morphyagent.com zone id>
DEV_PROVISION_SECRET=<random>          # enables /api/instances/dev-launch for testing
# already present: CALLBACK_BASE_URL=https://api.morphyagent.com, RELAY_DOMAIN=morphyagent.com, AWS creds, AMI/SG ids
```

---

## Re-bake the golden AMI (v5 — "direct")

SSH the base instance (`ssh aws1`), then:

```bash
# 1. Caddy
sudo dnf install -y caddy        # or the official Caddy repo build
sudo cp Caddyfile /etc/caddy/Caddyfile
sudo cp cf-origin.pem cf-origin.key cloudflare-aop.pem /etc/caddy/
sudo chmod 600 /etc/caddy/cf-origin.key
sudo systemctl enable caddy      # starts on boot; provision.sh also ensures it

# 2. Provisioning script + cloud-init trigger
sudo cp provision.sh /home/ec2-user/provision.sh
sudo chmod +x /home/ec2-user/provision.sh
sudo cp cloud-init-99-morphy.cfg /etc/cloud/cloud.cfg.d/99-morphy.cfg

# 3. jq must be present (provision.sh uses it) — already on v4
which jq || sudo dnf install -y jq

# 4. Clean user state (same as INFRA.md), then create-image v5 + copy to regions,
#    update AMI IDs in backend/.env + backend/lib/aws.js.
```

`provision.sh` adds a **4 GB swapfile before** the `npm` install (the t4g.small
2 GB OOM fix), seeds the config (tunnel OFF, pre-registered identity), runs
`morphy init --hosted`, and calls back `ready`. Caddy is already running, so the bot
is reachable the moment DNS is created.

---

## End-to-end test (no Stripe)

With `DEV_PROVISION_SECRET` set and a known `accountId` (from a Google login row in
`accounts`):

```bash
curl -X POST https://api.morphyagent.com/api/instances/dev-launch \
  -H "x-dev-secret: $DEV_PROVISION_SECRET" \
  -H 'content-type: application/json' \
  -d '{"accountId":"<ACCOUNT_ID>","username":"mytest","plan":"starter","region":"na"}'
```

Watch it progress: `launching → booting → initializing → ready`
(`GET /api/instances/:id/status`, or the dashboard). On `ready`:

1. `dig +short mytest.morphyagent.com` → a Cloudflare anycast IP (orange-cloud).
2. `https://mytest.morphyagent.com` → the bot's chat UI (TLS valid, WebSocket chat works).
3. `https://morphyagent.com/mytest` → 302 → `https://mytest.morphyagent.com`.
4. On the box: `journalctl -u caddy` clean; `cat /var/log/bloby-provision.log` shows
   swap created + `callback ready ok`; `swapon --show` lists `/swapfile`.

To disconnect (production), `DELETE /api/instances/:id` removes the EC2 **and** the
DNS record.

## "Disconnect Stripe for now"

`dev-launch` lets you provision with **no payment**. To make the website's *Pay*
button skip Stripe during testing, point the frontend's hosted "pay" action at
`POST /api/instances/dev-launch` (with the secret) instead of `POST /api/stripe/checkout`.
The Stripe code is left intact and re-enables by switching the button back — nothing
was removed.

---

## Rollback

- Per bot: set that bot's AMI/launch back to a tunnel AMI, or just leave it — the
  legacy tunnel path still works (callback falls back to `tunnelUrl` linking).
- Globally: unset `CF_API_TOKEN` → `cfConfigured()` is false → the webhook/callback
  fall back to the legacy launch + tunnel linking. Delete any per-bot A-records to
  let the `*.morphyagent.com → relay` wildcard take over again.
