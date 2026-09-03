# Morphy Hosted (Managed) Infrastructure

Auto-provisioning system that spins up one EC2 instance per purchased bot from a golden AMI.
Each box serves exactly **one** managed Morphy.

> **Architecture = "direct mode" (no tunnel).** A managed bot is reached **directly**
> through Cloudflare — a proxied A-record `mybot.morphyagent.com → <EC2 public IP>`
> (orange-cloud) → **Caddy :443** on the box (Cloudflare Origin cert, Full-strict) →
> **morphy :7400**. There is **no cloudflared tunnel** and **no relay reverse-proxy hop**.
> Self-hosted bots are unchanged (cloudflared quick-tunnel + the relay's `*.morphyagent.com`
> wildcard). A more-specific A-record for a managed handle overrides that wildcard, so the
> two tiers coexist.
>
> Full setup + the exact AMI re-bake runbook + gotchas: **`infra/MANAGED-DIRECT-SETUP.md`**.

---

## Architecture

```
Buyer on www.morphyagent.com
  ├─ picks an UNUSED reserved handle + plan (Starter/Pro) + region (NA/EU/BR), Google login, Pay
  ▼
Relay backend (Railway)
  ├─ Stripe webhook checkout.session.completed (or POST /api/instances/dev-launch when testing)
  ├─ provisionManagedInstance(): pre-registers the relay user (kind:'managed', tier:'premium',
  │   accountId, token), mints a per-box provisionToken, creates the instance row (status:launching)
  ├─ ec2.RunInstances() from the golden AMI with an identity user-data JSON
  ▼
EC2 box boots (golden AMI)
  ├─ cloud-init runs /home/ec2-user/provision.sh (once per instance)
  ├─ 4 GB swap, reads user-data (IMDSv2), callback {status:"initializing"}
  ├─ npm pack morphyagent + refresh ~/.morphy (+ workspace deps), morphy init --hosted (tunnel OFF)
  ├─ ensures Caddy is up, callback {status:"ready"}  (NO tunnelUrl — direct mode)
  ▼
Relay /api/instances/callback (provisionToken-authenticated)
  ├─ describeInstance → public IP → upsertDnsRecord  mybot.morphyagent.com (proxied) → IP
  ├─ link users.accountId, set isOnline:true (managed bots never heartbeat)
  ▼
Browser opens  mybot.morphyagent.com  → CF → Caddy → morphy onboarding wizard
  (morphyagent.com/mybot → relay 302 → mybot.morphyagent.com)
```

The frontend polls `GET /api/instances/:id/status` and maps `launching → booting →
initializing → ready`. Instance management lives on the **Dashboard** (per-bot card →
"Manage Instance"), not the landing page.

---

## Golden AMI — `morphy-golden-v3`

Base: **Amazon Linux 2023, ARM64 (Graviton)**. v3 (2026-09-03) was built from v2 with the fast
path (`morphyagent` refreshed to **0.5.0**, new `provision.sh`, stale root-home `morphy` symlink
removed). v2 ids are kept below until v3 has provisioned a real box; then deregister v2 + its
snapshots (`snap-095a362fb04ed1ee0` / `snap-0ddefa0f13019bc31` / `snap-03c420f130e322993`).

| Region | AMI ID (v3) | AWS Region | previous (v2) |
|--------|-------------|------------|---------------|
| North America | `ami-0aa5eb0bc5c015bd0` | us-east-1 | `ami-0ce59f56351efd54a` |
| Europe | `ami-082d0b4f75f505f29` | eu-central-1 | `ami-01eb42c7c21a53b5d` |
| Brazil | `ami-02f6b2b7a3e441cf2` | sa-east-1 | `ami-0e78338c9d50be5ed` |

Baked in (see `infra/bake-setup.sh` for the exact build):
- Node.js 22 (system, nodesource) + `jq`
- **4 GB swap** (`/swapfile` + `/etc/fstab`) — fixes the t4g.small npm-install OOM
- `morphyagent` installed globally → `/usr/local/bin/morphy`
- Pre-baked `~/.morphy/` app dir **and `~/.morphy/workspace/node_modules`** (`express` +
  `better-sqlite3`, the workspace backend deps — without these the backend crash-loops)
- **Caddy v2.11.4** (static binary) + `/etc/systemd/system/caddy.service` (enabled) +
  `/etc/caddy/Caddyfile` (the no-AOP v1 config) + `/etc/caddy/cf-origin.pem` + `cf-origin.key`
  (the Cloudflare Origin cert, baked — same on every box)
- `/home/ec2-user/provision.sh` + `/etc/cloud/cloud.cfg.d/99-bloby.cfg`
- Tailscale is present from the v4 base but unused/inactive (harmless)

NOT baked (created at boot / onboarding): `~/.morphy/config.json`, `memory.db`, `~/.claude/`.

**Re-baking the AMI:** there is no longer a persistent base instance — each re-bake launches
a fresh box from the current golden AMI, runs the bake, images it, copies to regions, and
deregisters the old. The full step-by-step (the exact commands used to build v2) is in
**`infra/MANAGED-DIRECT-SETUP.md` → "Re-bake the golden AMI"**.

---

## Plans & Regions

| Plan | Instance Type | vCPU | RAM | Disk | Price |
|------|--------------|------|-----|------|-------|
| Starter | t4g.small | 2 | 2 GB | 20 GB gp3 | $29/mo |
| Pro | t4g.medium | 2 | 4 GB | 40 GB gp3 | $49/mo |

| ID | AWS Region | Location |
|----|-----------|----------|
| na | us-east-1 | Virginia |
| eu | eu-central-1 | Frankfurt |
| br | sa-east-1 | São Paulo |

EC2 key pair for ops: **`fluxy-instances`** (`~/.ssh/fluxy-instances.pem`). Note: the relay
launches *bots* **without** a KeyName — to shell into a running bot use **EC2 Instance Connect**
(see the runbook's "Debugging a managed box").

---

## Security Groups

Named `bloby-instances-SG`. Required inbound: **443 from Cloudflare IP ranges** (the public
data path) + **22** for ops/Instance-Connect. Outbound all.

| Region | Security Group ID | VPC | 443 from CF | 22 |
|--------|-------------------|-----|-------------|----|
| us-east-1 | `sg-023fa7964b46feb25` | `vpc-0e83d89dd9cdf3c44` | yes | yes |
| eu-central-1 | `sg-0956278b8533089dc` | `vpc-05daa576963a8ec4b` | yes | (add when needed) |
| sa-east-1 | `sg-0ab1b5fa370b4e673` | `vpc-09e4ff7e47c6adfc1` | yes | yes |

Open/refresh 443 from Cloudflare's current ranges with **`infra/open-443-cloudflare.sh`**
(idempotent). The relay IAM user can now run it directly (it has `AuthorizeSecurityGroupIngress`).
Do **not** open 443 to `0.0.0.0/0`.

---

## IAM — relay user `fluxy-bckend` (`arn:aws:iam::270613081471:user/fluxy-bckend`)

The user is scoped to exactly what the relay + AMI ops need. Current policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "ec2:RunInstances",
      "ec2:DescribeInstances",
      "ec2:DescribeInstanceStatus",
      "ec2:TerminateInstances",
      "ec2:StartInstances",
      "ec2:StopInstances",
      "ec2:CreateTags",
      "ec2:CreateImage",
      "ec2:CopyImage",
      "ec2:DescribeImages",
      "ec2:DeregisterImage",
      "ec2:DescribeSecurityGroups",
      "ec2:DescribeSubnets",

      "ec2:AuthorizeSecurityGroupIngress",
      "ec2:RevokeSecurityGroupIngress",
      "ec2:DeleteSnapshot",
      "ec2:DescribeSnapshots",
      "ec2:DescribeKeyPairs",
      "ec2:GetConsoleOutput",
      "ec2-instance-connect:SendSSHPublicKey",

      "ec2:AllocateAddress",
      "ec2:AssociateAddress",
      "ec2:DisassociateAddress",
      "ec2:ReleaseAddress",
      "ec2:DescribeAddresses"
    ],
    "Resource": "*"
  }]
}
```

The third block (2026-09-03) is for **Elastic IPs**: every managed box gets one at first `ready`
(`lib/lifecycle.js publishDns`) so its public IP — and the CF A-record — survive stop/start,
pause/resume and AWS retirements. If the policy lacks these, `attachElasticIp` logs a warning and
the box falls back to its ephemeral IP (the sweeper then refreshes DNS whenever it drifts).
`ec2:CreateTags` (already present) is needed for the EIP tag. EBS volumes are launched with
`Encrypted: true` (account default KMS key — no extra IAM).

The second block was added (2026-06-30) so ops can open the 443 SG rule, delete old snapshots,
read console output, and shell into bots via Instance Connect without separate admin creds. They
are one-time/ops powers, not used in normal request handling — tighten later if desired.

---

## provision.sh (on the AMI, `/home/ec2-user/provision.sh`)

Triggered by cloud-init on first boot (`/etc/cloud/cloud.cfg.d/99-bloby.cfg`). Reads its
identity from EC2 user-data (JSON, set by `backend/lib/aws.js`):

```json
{ "instanceId":"<db id>", "callbackUrl":"https://api.morphyagent.com/api/instances/callback",
  "username":"mybot", "tier":"premium", "relayToken":"...", "relayUrl":"https://morphyagent.com/mybot",
  "provisionToken":"...", "aiProvider":"...", "aiModel":"...", "aiApiKey":"..." }
```

What it does (direct / tunnel-OFF mode):
1. Adds a 4 GB swapfile **before** any npm install (OOM fix)
2. Callback `{status:"initializing"}`
3. `npm pack morphyagent` → extract over `~/.morphy` → `npm install --omit=dev`
4. **Explicitly installs the workspace backend deps** in `~/.morphy/workspace` (retried) — the
   package postinstall does this too but can flake under first-boot load, which is what left
   early test bots with a crash-looping backend
5. Seeds `MORPHY_USERNAME / MORPHY_RELAY_TOKEN / MORPHY_RELAY_TIER / MORPHY_RELAY_URL /
   MORPHY_TUNNEL_MODE=off / MORPHY_AI_*` and runs `morphy init --hosted` (daemon/systemd path)
6. Ensures `caddy` is active, callback `{status:"ready"}` (no tunnelUrl)

Logs: `/var/log/bloby-provision.log`.

---

## Backend files & API

| File | Purpose |
|------|---------|
| `backend/lib/aws.js` | EC2 SDK wrapper — launchInstance (+ identity user-data), describe/terminate/restart; AMI/SG ids per region |
| `backend/lib/provision.js` | `provisionManagedInstance()` — pre-register handle+token, mint provisionToken, create row, launch |
| `backend/lib/cloudflare.js` | CF DNS client — `managedHostname`, `upsertDnsRecord`, delete; `cfConfigured()` gates all DNS work |
| `backend/routes/instances.js` | instances CRUD + `dev-launch` + the provisionToken-authed `callback` (creates DNS, links account, isOnline) |
| `backend/routes/stripe.js` | checkout (reserved-handle gated) + webhook (managed branch) + `BILLING_DISABLED` bypass + portal |

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/instances` | JWT | List the account's instances |
| GET | `/api/instances/:id/status` | JWT | Poll one instance |
| POST | `/api/instances/:id/restart` | JWT | Stop/start the box (409 unless `ready`/`dns_failed`; DNS re-published before `ready`) |
| DELETE | `/api/instances/:id` | JWT | Cancel the Stripe subscription, then terminate EC2 + release EIP + delete DNS + free the handle |
| POST | `/api/instances/dev-launch` | `x-dev-secret` | Provision with no Stripe (testing) |
| POST | `/api/instances/callback` | provisionToken | Called by the box's provision.sh (`initializing` / `ready` / `failed`), and re-posted with `boot:true` by `morphy-ready.service` on every later boot |
| POST | `/api/wallet` | bot token | Box reports its agent wallet (managed bots don't heartbeat) |

Status flow: `launching → booting → initializing → ready` (`→ failed`, `→ dns_failed`);
`ready → restarting → ready`; `ready → canceling → ready`;
`ready → paused → resuming → ready` (failed payment / trial); `ready → suspended` (subscription ended,
box **stopped** and kept for `SUSPEND_GRACE_DAYS`, default 14) `→ terminated` (sweeper) or `→ resuming → ready`
(re-subscribe with the same handle). `failed` frees the handle and cancels the subscription.

**Lifecycle + sweeper (2026-09-03).** `backend/lib/lifecycle.js` is the single owner of
publish-DNS / pause / resume / fail / terminate. `backend/lib/sweeper.js` runs in-process on the
relay: every 60 s instances stuck in `launching/booting/initializing` for > `PROVISION_TIMEOUT_MS`
(25 min) are failed + refunded-by-cancel; every 5 min EC2 state is mirrored into `users.isOnline`,
IP drift re-publishes the A-record, and `suspended` boxes past `terminateAt` are terminated.
Set `SWEEPER_DISABLED=1` to turn it off (e.g. a second replica).

**Stripe webhook** must be subscribed to: `checkout.session.completed`,
`customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`,
`invoice.paid`. Deliveries are deduped by event id (`stripe_events`, 30-day TTL). Paid handles are
locked in `handle_reservations` (unique) at webhook time; a duplicate purchase is auto-refunded.

---

## Environment variables (backend/.env and Railway)

```
# AWS
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AMI_US_EAST_1=ami-0aa5eb0bc5c015bd0
AMI_EU_CENTRAL_1=ami-082d0b4f75f505f29
AMI_SA_EAST_1=ami-02f6b2b7a3e441cf2
SG_US_EAST_1=sg-023fa7964b46feb25
SG_EU_CENTRAL_1=sg-0956278b8533089dc
SG_SA_EAST_1=sg-0ab1b5fa370b4e673

# Relay / Cloudflare (direct mode)
RELAY_DOMAIN=morphyagent.com
CALLBACK_BASE_URL=https://api.morphyagent.com
CF_API_TOKEN=cfut_...          # a USER API token (prefix cfut_), Zone:DNS:Edit on morphyagent.com
CF_ZONE_ID=...                 # the morphyagent.com ZONE id (NOT the Account id)
DEV_PROVISION_SECRET=...       # enables /api/instances/dev-launch  — UNSET in production
BILLING_DISABLED=1             # testing only: skip Stripe (checkout + handle reservation provision/reserve free) — UNSET in production

# Managed lifecycle (all optional)
AGENT_VERSION=0.4.7            # exact morphyagent version new boxes install at first boot; unset = keep the AMI's baked copy (never "latest")
PROVISION_TIMEOUT_MS=1500000   # sweeper: provisioning stuck longer than this → failed + subscription cancelled (default 25 min)
SUSPEND_GRACE_DAYS=14          # how long a box is kept (stopped) after its subscription ends before termination
SWEEPER_DISABLED=1             # only if you ever run >1 relay replica
```

> **provision.sh changed (2026-09-03)** — callbacks now retry, `ready` is gated on a real
> `/api/health` probe (else `failed` with the journal tail), the install is pinned to
> `AGENT_VERSION` (staged, never a half-written tree), and a `morphy-ready.service` oneshot
> re-posts `ready` on every later boot. **Re-bake the golden AMI** to ship it
> (`infra/MANAGED-DIRECT-SETUP.md` → "Re-bake the golden AMI", fast path).

`aws.js` falls back to the v3 AMI ids if the env vars are unset, but Railway should set them
explicitly (and they must be the v3 ids).

---

## Old AMIs

All historical images (`fluxy-golden` v1/v2/v3/v4 and `morphy-golden-v1`) have been
**deregistered and their snapshots deleted**. `morphy-golden-v3` (×3 regions) is current;
`morphy-golden-v2` (×3) is still registered as a rollback and should be deregistered (plus its
three snapshots) once v3 has provisioned a real box end-to-end.
