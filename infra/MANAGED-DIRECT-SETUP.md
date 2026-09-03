# Managed tier — "direct" mode (no cloudflared tunnel)

The managed/hosted tier reaches each bot **directly** through Cloudflare, with no cloudflared
quick-tunnel and no relay reverse-proxy hop.

```
browser → CF (mybot.morphyagent.com, proxied A-record → EC2 public IP) → Caddy :443 → morphy :7400
morphyagent.com/mybot → relay 302 → mybot.morphyagent.com
```

One hop instead of three; the EC2 public IP is hidden behind Cloudflare's proxy. This is
**additive**: self-hosted bots still use cloudflared + the relay's `*.morphyagent.com` wildcard,
and a managed bot's *more-specific* A-record overrides that wildcard for just its name.

This doc is the operational source of truth (companion to the top-level `INFRA.md`). It records
how the live system was built so a future change is mechanical.

---

## Current golden AMI — `morphy-golden-v3` (2026-09-03, agent 0.5.0)

| Region | AMI ID | snapshot |
|--------|--------|----------|
| us-east-1 | `ami-0aa5eb0bc5c015bd0` | `snap-0c0a4c0a7ce4743e0` |
| eu-central-1 | `ami-082d0b4f75f505f29` | `snap-0dc945db83e9555ea` |
| sa-east-1 | `ami-02f6b2b7a3e441cf2` | `snap-07662794d36dc99dc` |

Previous `morphy-golden-v2` (`ami-0ce59f56351efd54a` / `ami-01eb42c7c21a53b5d` /
`ami-0e78338c9d50be5ed`) is still registered as a rollback until v3 has provisioned a real box.

Set in `backend/.env` (`AMI_*`), `backend/lib/aws.js` (fallback defaults), and **Railway**.

---

## Files in this folder

| File | What it is |
|------|-----------|
| `bake-setup.sh` | Runs **on a base instance** to turn it into the golden AMI (swap, morphyagent global + `~/.morphy` + workspace deps, Caddy + cert + unit, provision.sh + cloud-init, clean). |
| `provision.sh` | Baked to `/home/ec2-user/provision.sh`; runs on each **new bot's** first boot (cloud-init). Tunnel-OFF, explicit workspace-deps install, callback. |
| `Caddyfile` | The hardened target (TLS via Origin cert **+** Authenticated Origin Pulls). |
| `Caddyfile.v1-noaop` | What is **actually baked** in v1/v2 (TLS via Origin cert, **AOP off** — SG-443-from-CF is the access control). |
| `caddy.service` | systemd unit for the Caddy static binary. |
| `cloud-init-99-bloby.cfg` | Baked to `/etc/cloud/cloud.cfg.d/99-bloby.cfg`; runs provision.sh once per instance. |
| `open-443-cloudflare.sh` | Opens/refreshes inbound 443 from Cloudflare's current IP ranges on all 3 SGs (idempotent). |

> The Cloudflare **Origin cert + key are secret** and are **never committed** (`infra/.gitignore`
> ignores `cf-origin.*`). They live only baked into the AMI (`/etc/caddy/`) and wherever you stage
> them for a re-bake. If they leak, reissue in the CF dashboard and re-bake.

---

## One-time Cloudflare setup

1. **Origin certificate** — CF dashboard → SSL/TLS → **Origin Server → Create Certificate**,
   hostnames **`*.morphyagent.com, morphyagent.com`** (both — the wildcard alone won't cover the
   apex), 15-year. Save the cert → `cf-origin.pem` and key → `cf-origin.key` (these get baked into
   the AMI at `/etc/caddy/`). Verify the pair matches:
   `openssl x509 -in cf-origin.pem -noout -modulus | openssl md5` == `openssl rsa -in cf-origin.key -noout -modulus | openssl md5`.
2. **SSL/TLS mode** — set the morphyagent.com zone to **Full (strict)**.
3. **API token** — My Profile → API Tokens → **Create Token** → *Edit zone DNS* template →
   **Zone : DNS : Edit** on **morphyagent.com only**. This is a **user API token** — it looks like
   `cfut_...`. Verify it before trusting it:
   `curl -s -H "Authorization: Bearer $TOKEN" https://api.cloudflare.com/client/v4/user/tokens/verify`
   → expect `"status":"active"`. Save as Railway `CF_API_TOKEN`.
   - **Gotcha:** a `cfat_...` string is **not** a valid API token (verify returns `1000 Invalid API
     Token`). The Global API Key also won't work (it needs different headers; our client sends Bearer).
4. **Zone ID** — the morphyagent.com **Overview** page → right "API" panel → **Zone ID**. Save as
   `CF_ZONE_ID`.
   - **Gotcha:** the **Account ID** sits right next to it and is also 32-hex — copying it instead
     gives `9109 Invalid zone identifier`. Use the one labeled **Zone ID**.
5. **(Optional) Edge redirect** `morphyagent.com/:user → :user.morphyagent.com` — the relay's
   `GET /:username` 302 already covers it.

Per-bot A-records are free and uncapped on the zone — the 1,000-tunnel cap does **not** apply
(these are DNS records, not tunnels).

---

## AWS one-time setup

- **Security groups** (all 3 regions): inbound **443 from Cloudflare IPs** (`bash open-443-cloudflare.sh`)
  + **22** for ops. The relay IAM user can run the 443 script directly now (it has
  `AuthorizeSecurityGroupIngress`). eu-central-1 has no inbound 22 yet — add it if you ever need to
  shell into an EU bot.
- **IAM** — the relay user `fluxy-bckend` was widened with `AuthorizeSecurityGroupIngress`,
  `RevokeSecurityGroupIngress`, `DeleteSnapshot`, `DescribeSnapshots`, `DescribeKeyPairs`,
  `GetConsoleOutput`, `ec2-instance-connect:SendSSHPublicKey` (see `INFRA.md`).
- **Public IP on restart** — a relay-initiated restart does stop/start, which assigns a **new**
  public IP; the restart handler refreshes the A-record automatically. For zero-flap in prod,
  allocate an **Elastic IP per instance** (then DNS never changes).

## Railway env vars

```
RELAY_DOMAIN=morphyagent.com
CALLBACK_BASE_URL=https://api.morphyagent.com
CF_API_TOKEN=cfut_...            # verified active, Zone:DNS:Edit on morphyagent.com
CF_ZONE_ID=...                   # morphyagent.com ZONE id (not Account id)
DEV_PROVISION_SECRET=...         # enables POST /api/instances/dev-launch — UNSET in production
BILLING_DISABLED=1               # TESTING ONLY — provision + reserve handles free (no Stripe) — UNSET in production
AGENT_VERSION=0.4.7              # exact morphyagent version new boxes install (unset = keep the AMI's baked copy)
SUSPEND_GRACE_DAYS=14            # stopped-box retention after a subscription ends, before termination
PROVISION_TIMEOUT_MS=1500000     # sweeper: stuck provisioning → failed after this (default 25 min)
AMI_US_EAST_1=ami-0aa5eb0bc5c015bd0
AMI_EU_CENTRAL_1=ami-082d0b4f75f505f29
AMI_SA_EAST_1=ami-02f6b2b7a3e441cf2
SG_US_EAST_1=sg-023fa7964b46feb25
SG_EU_CENTRAL_1=sg-0956278b8533089dc
SG_SA_EAST_1=sg-0ab1b5fa370b4e673
```

---

## Re-bake the golden AMI

There is **no persistent base instance** — each re-bake launches a fresh box, provisions it,
images it, and is then terminated. This is exactly how v2 was built. Run with the relay creds
(`AWS_ACCESS_KEY_ID/SECRET` from `backend/.env`) — they're sufficient.

```bash
cd backend && export AWS_ACCESS_KEY_ID=$(grep '^AWS_ACCESS_KEY_ID=' .env | cut -d= -f2-) \
                     AWS_SECRET_ACCESS_KEY=$(grep '^AWS_SECRET_ACCESS_KEY=' .env | cut -d= -f2-); cd ..

# 1. Launch a base FROM the current golden AMI (already has Caddy/morphy/cert — fast path),
#    with the ops key so you can SSH in directly.
aws ec2 run-instances --region us-east-1 --image-id <CURRENT_GOLDEN_AMI> \
  --instance-type t4g.medium --key-name fluxy-instances \
  --security-group-ids sg-023fa7964b46feb25 --subnet-id <a-subnet-in-that-vpc> \
  --associate-public-ip-address \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=morphy-golden-build}]' \
  --count 1 --query 'Instances[0].InstanceId' --output text
aws ec2 wait instance-status-ok --region us-east-1 --instance-ids <IID>
IP=$(aws ec2 describe-instances --region us-east-1 --instance-ids <IID> \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)

# 2. Apply changes. Fast path (changing provision.sh / refreshing workspace deps): scp the new
#    provision.sh and `cd ~/.morphy/workspace && npm install --omit=dev`. Full bake (fresh base,
#    or changing Caddy/cert/morphyagent): scp ALL of infra/* + cf-origin.{pem,key} to /tmp/bake
#    and run `sudo bash /tmp/bake/bake-setup.sh` (it does swap, morphyagent global, ~/.morphy +
#    workspace deps, Caddy + cert + unit, provision.sh + cloud-init).
ssh -i ~/.ssh/fluxy-instances.pem ec2-user@$IP   # interactive, or scp + ssh 'bash -s'

# 3. Clean + stop for a clean image.
ssh ... ec2-user@$IP 'rm -f ~/.bash_history; sudo cloud-init clean --logs; sync'
aws ec2 stop-instances --region us-east-1 --instance-ids <IID>
aws ec2 wait instance-stopped --region us-east-1 --instance-ids <IID>

# 4. Image + copy to regions (ASCII-only --description; non-ASCII is rejected).
AMI=$(aws ec2 create-image --region us-east-1 --instance-id <IID> --name morphy-golden-vN \
  --description "Morphy golden vN direct-mode" --query ImageId --output text)
aws ec2 wait image-available --region us-east-1 --image-ids $AMI
aws ec2 copy-image --region eu-central-1 --source-region us-east-1 --source-image-id $AMI --name morphy-golden-vN ...
aws ec2 copy-image --region sa-east-1   --source-region us-east-1 --source-image-id $AMI --name morphy-golden-vN ...
# wait image-available in each region.

# 5. Update AMI ids in backend/.env, backend/lib/aws.js defaults, and Railway.
# 6. Terminate the base; deregister old AMIs + delete their snapshots (capture the snapshot ids
#    from describe-images BlockDeviceMappings BEFORE deregistering).
```

`bake-setup.sh` reuses an existing `/swapfile` if present — if you want the intended 4 GB and the
base only has 2 GB, `swapoff /swapfile && rm` then recreate at 4 GB (or let provision.sh's
ensure_swap handle a fresh box). The build host should be `t4g.medium` for headroom; production
bots run `t4g.small` (Starter) / `t4g.medium` (Pro).

---

## Debugging a managed box

The relay launches bots **without a KeyName** and they have no SSM role, so the only way in is
**EC2 Instance Connect** (push an ephemeral key, SSH within ~60 s). The SG must allow 22.

```bash
KEY=/tmp/eic; ssh-keygen -t ed25519 -N '' -f $KEY -q
AZ=$(aws ec2 describe-instances --region <r> --instance-ids <iid> \
  --query 'Reservations[0].Instances[0].Placement.AvailabilityZone' --output text)
aws ec2-instance-connect send-ssh-public-key --region <r> --instance-id <iid> \
  --availability-zone $AZ --instance-os-user ec2-user --ssh-public-key file://$KEY.pub
ssh -i $KEY -o StrictHostKeyChecking=no ec2-user@<public-ip>
```

Useful checks on the box:
- `systemctl is-active caddy morphy` — both should be `active`
- `sudo ss -ltnp | grep -E ':443|:7400|:7404'` — Caddy :443, supervisor :7400, **workspace backend :7404**
- `cat ~/.morphy/workspace/.backend.log` — if it loops `[workspace-isolate] "express" resolved
  outside workspace`, the workspace `node_modules` is missing → `cd ~/.morphy/workspace &&
  npm install --omit=dev` then `sudo systemctl restart morphy`
- `cat ~/.morphy/config.json` — `username`, `tunnel.mode:"off"`, `relay.token`, `wallet.address`
- `cat /var/log/bloby-provision.log` — provision output
- `aws ec2 get-console-output --instance-id <iid>` — boot log (relay creds can read this)

---

## End-to-end test (no Stripe)

With `BILLING_DISABLED=1` set on Railway, the whole loop is free: reserve a handle → it appears in
"My Handles" → pick it in the purchase funnel → Pay (provisions directly) → it shows on the
**Dashboard**. Or headless via `dev-launch`:

```bash
curl -X POST https://api.morphyagent.com/api/instances/dev-launch \
  -H "x-dev-secret: $DEV_PROVISION_SECRET" -H 'content-type: application/json' \
  -d '{"accountId":"<ACCOUNT_ID>","username":"mytest","plan":"starter","region":"na"}'
```

On `ready`: `dig +short mytest.morphyagent.com` → Cloudflare anycast IPs; `https://mytest.morphyagent.com`
→ the bot (HTTP 200, `<title>Morphy</title>` — **not** the relay "offline" page).

---

## Gotchas (learned the hard way)

- **Workspace backend deps.** The workspace app is dependency-isolated and needs its **own**
  `~/.morphy/workspace/node_modules` (`express` + `better-sqlite3`). The package postinstall installs
  them via a nested npm install that can flake under first-boot load, leaving the backend crash-looping
  (`[workspace-isolate] "express" resolved outside workspace` → "Your app's backend is down").
  `provision.sh` now installs them as an explicit retried step, and they're baked into the AMI.
  `better-sqlite3` ships a prebuilt arm64 binary, so no compiler is needed.
- **Managed bots never heartbeat** (tunnel.mode=off). The relay sets `isOnline:true` in the `ready`
  callback (keeping `lastHeartbeat:null` so no staleness check flips it), and from then on the
  **sweeper** (`backend/lib/sweeper.js`, every 5 min) mirrors the real EC2 state into `isOnline`.
  `accountId` is linked at provision time (auto-claim), and the box reports its wallet via
  `POST /api/wallet` at boot (`reportWallet`). A managed handle that backs an instance is flagged
  `managed`/`used` so the dashboard shows "In Use" instead of an activation code.
- **Elastic IP per box** (2026-09-03): `publishDns` allocates + associates an EIP at first `ready`,
  so stop/start, pause/resume and AWS retirements never change the address. Needs the EIP actions
  in the IAM policy (`INFRA.md`); without them it logs a warning and uses the ephemeral IP, and the
  sweeper re-publishes DNS whenever the IP drifts. `terminateManaged` releases the EIP.
- **`ready` is written only AFTER the A-record exists.** If Cloudflare rejects the write the
  instance goes to `dns_failed` with the error on it (visible on the dashboard); the sweeper
  retries the publish on its next pass, and a boot re-post from the box (`morphy-ready.service`)
  also re-triggers it.
- **CF token must be a real zone-DNS user token** (`cfut_`, verified active) and **`CF_ZONE_ID` must
  be the Zone id, not the Account id** — both were live failures during the first test.
- **`cfConfigured()` gates ALL DNS + account linking** in the `ready` callback. If `CF_API_TOKEN`/
  `CF_ZONE_ID` are unset/wrong, the box reports ready but no DNS is created and the handle is never
  linked → the bot is unreachable.
- **`sudo npm install -g morphyagent` runs the package postinstall as root**, which copies the
  app into `/root/.morphy` and leaves `/usr/local/bin/morphy → /root/.morphy/bin/cli.js`. Because
  sudo's `secure_path` lists `/usr/local/bin` before `/usr/bin`, that unexecutable link shadows
  the real `/usr/bin/morphy` for `provision.sh` (it only works because `env` falls through on
  EACCES). The v3 bake removed both; **every re-bake must** `sudo rm -f /usr/local/bin/morphy;
  sudo rm -rf /root/.morphy` after the global install, then check
  `sudo -u ec2-user -H env morphy --version` (this is exactly how provision.sh calls it).
- **Fast re-bake helper.** The v3 fast path (refresh global bin + `~/.morphy` + workspace deps to
  a pinned version, install `provision.sh`, verify) is a single script run over ssh; it lives in
  the 2026-09-03 session's scratchpad as `rebake-fast.sh` — worth committing to `infra/` next time.
- **AOP is off in v1/v2/v3.** Access control is the SG (443 from CF only). To harden, swap the baked
  Caddyfile for `infra/Caddyfile` (the AOP version) + bake Cloudflare's origin-pull CA as
  `/etc/caddy/cloudflare-aop.pem`, then re-bake.

---

## Rollback

- Per bot: terminate it (`DELETE /api/instances/:id` frees EC2 + DNS + the relay handle).
- Globally: unset `CF_API_TOKEN` → `cfConfigured()` false → the webhook/callback fall back to the
  legacy tunnel launch + tunnelUrl linking. Delete any per-bot A-records to let the
  `*.morphyagent.com → relay` wildcard take over again.
