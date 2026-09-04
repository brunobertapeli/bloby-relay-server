#!/bin/bash
#
# Morphy managed-instance provisioning script (golden AMI).
# Location on the AMI: /home/ec2-user/provision.sh
# Triggered by cloud-init on first boot (see infra/cloud-init-99-bloby.cfg).
#
# What it does (managed / "direct" mode — NO cloudflared tunnel):
#   1. Adds a swapfile BEFORE any npm install   ← fixes the t4g.small OOM
#   2. Reads EC2 user-data (IMDSv2): identity + callback
#   3. Callback {status:"initializing"}
#   4. Installs the EXACT morphyagent version the relay asked for (user-data
#      .agentVersion); no version → keeps the copy baked into the AMI. Never "latest".
#   5. Seeds MORPHY_* env so `morphy init --hosted` writes a pre-registered,
#      tunnel-OFF config (the box is reached directly via Caddy + a per-bot CF
#      DNS record — no tunnel, no relay data-plane hop)
#   6. Runs `morphy init --hosted` (daemon path, systemd)
#   7. Waits for the local supervisor to answer /api/health, ensures Caddy is up,
#      then callback {status:"ready"} — or {status:"failed", detail} if it never came up.
#      The relay reads the EC2 public IP itself and creates the A-record.
#   8. Installs morphy-ready.service: on EVERY later boot the box re-posts "ready"
#      (with retries) once healthy, so a callback lost to a relay redeploy or an IP
#      change after a stop/start self-heals without anyone touching the box.
#
# Caddy (TLS termination → 127.0.0.1:7400) is a separate systemd service baked
# into the AMI; this script does not configure it, only ensures it is up.
#
set -uo pipefail

# ── Must run as root ──────────────────────────────────────────────────────────
# Observed on golden v3 (2026-09-04): cloud-init's runcmd invoked this script WITHOUT root, so
# the log, /etc writes, the systemd unit and daemon-reload were all "Permission denied" (silently,
# because the per-user steps use `sudo -u ec2-user` and still worked). ec2-user has NOPASSWD
# sudo on AL2023, so re-exec ourselves under sudo instead of sprinkling sudo everywhere.
if [ "$(id -u)" -ne 0 ]; then
  exec sudo -n -E bash "$0" "$@"
fi

LOG=/var/log/bloby-provision.log
exec > >(tee -a "$LOG") 2>&1
echo "[provision] ===== $(date -u +%FT%TZ) starting (uid $(id -u)) ====="

RUN_USER=ec2-user
RUN_HOME=/home/$RUN_USER
SWAP_SIZE="${MORPHY_SWAP_SIZE:-4G}"
MORPHY_PORT=7400
# How long to wait for the supervisor to answer /api/health before reporting failure.
HEALTH_WAIT_SEC="${MORPHY_HEALTH_WAIT_SEC:-240}"
# Where the boot re-post service keeps what it needs (root-only; holds the provision token).
READY_ENV=/etc/morphy-ready.env

# ─── 1. Swap FIRST (the OOM fix) ─────────────────────────────────────────────
ensure_swap() {
  if swapon --show | grep -q '/swapfile'; then
    echo "[provision] swap already active"; return 0
  fi
  echo "[provision] creating ${SWAP_SIZE} swapfile..."
  if ! fallocate -l "$SWAP_SIZE" /swapfile 2>/dev/null; then
    local mb; mb=$(numfmt --from=iec "$SWAP_SIZE"); mb=$((mb/1024/1024))
    dd if=/dev/zero of=/swapfile bs=1M count="$mb" status=none
  fi
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10 >/dev/null 2>&1 || true
  echo "[provision] swap ready:"; swapon --show
}
ensure_swap

# ─── 2. Read user-data (IMDSv2) ──────────────────────────────────────────────
IMDS=http://169.254.169.254
TOKEN=$(curl -sf -X PUT "$IMDS/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" || true)
imds() { curl -sf -H "X-aws-ec2-metadata-token: $TOKEN" "$IMDS/$1"; }

USER_DATA=$(imds latest/user-data || true)
if [ -z "$USER_DATA" ]; then
  echo "[provision] FATAL: no user-data"; exit 1
fi

# user-data is JSON: { instanceId, callbackUrl, username, relayToken, relayUrl,
#                      tier, provisionToken, agentVersion?, aiProvider?, aiModel?, aiApiKey? }
jq_get() { echo "$USER_DATA" | jq -r "$1 // empty"; }
INSTANCE_ID=$(jq_get '.instanceId')
CALLBACK_URL=$(jq_get '.callbackUrl')
USERNAME=$(jq_get '.username')
RELAY_TOKEN=$(jq_get '.relayToken')
RELAY_URL=$(jq_get '.relayUrl')
RELAY_TIER=$(jq_get '.tier')
PROVISION_TOKEN=$(jq_get '.provisionToken')
AGENT_VERSION=$(jq_get '.agentVersion')
AI_PROVIDER=$(jq_get '.aiProvider')
AI_MODEL=$(jq_get '.aiModel')
AI_API_KEY=$(jq_get '.aiApiKey')

echo "[provision] instanceId=$INSTANCE_ID username=$USERNAME tier=$RELAY_TIER agentVersion=${AGENT_VERSION:-<baked>}"
if [ -z "$INSTANCE_ID" ] || [ -z "$CALLBACK_URL" ]; then
  echo "[provision] FATAL: missing instanceId/callbackUrl"; exit 1
fi

# The relay must never lose a status because it was mid-deploy for a minute: retry hard.
# $1 = status, $2 = optional detail, $3 = optional extra JSON fields (already JSON, e.g. '"boot":true')
callback() {
  local status="$1" detail="${2:-}" extra="${3:-}"
  local body
  body=$(jq -nc --arg id "$INSTANCE_ID" --arg s "$status" --arg pt "$PROVISION_TOKEN" \
              --arg d "$detail" --arg v "$(installed_version)" \
          '{instanceId:$id, status:$s, provisionToken:$pt, agentVersion:$v} + (if $d != "" then {detail:$d} else {} end)')
  if [ -n "$extra" ]; then body=$(echo "$body" | jq -c ". + {$extra}"); fi
  if curl -sf -X POST "$CALLBACK_URL" -H 'Content-Type: application/json' -d "$body" \
       --retry 15 --retry-all-errors --retry-delay 4 --max-time 60 -o /dev/null; then
    echo "[provision] callback $status ok"
  else
    echo "[provision] callback $status FAILED after retries (continuing; morphy-ready.service will re-post on next boot)"
  fi
}

installed_version() {
  jq -r '.version // "unknown"' "$RUN_HOME/.morphy/package.json" 2>/dev/null || echo unknown
}

# ─── 3. initializing ─────────────────────────────────────────────────────────
callback initializing

# ─── 4. Install the pinned morphyagent version (swap-backed) ────────────────
# The relay pins the version it has validated (AGENT_VERSION on Railway). Extract into a
# STAGING dir and swap it in only when the install fully succeeded, so a bad tarball, an
# npm outage, or an OOM mid-install never leaves a half-updated ~/.morphy — the AMI's baked
# copy stays in place instead.
if [ -n "$AGENT_VERSION" ] && [ "$AGENT_VERSION" != "$(installed_version)" ]; then
  echo "[provision] installing morphyagent@$AGENT_VERSION (baked: $(installed_version))..."
  sudo -u "$RUN_USER" -H env AGENT_VERSION="$AGENT_VERSION" bash -s <<'UPDATE'
set -uo pipefail
cd /home/ec2-user
STAGE=/home/ec2-user/.morphy.next
rm -rf "$STAGE"; mkdir -p "$STAGE"
TARBALL=$(npm pack "morphyagent@${AGENT_VERSION}" --silent 2>/dev/null | tail -1)
if [ -z "$TARBALL" ] || [ ! -f "$TARBALL" ]; then
  echo "[provision] npm pack morphyagent@${AGENT_VERSION} failed; keeping baked morphy"; rm -rf "$STAGE"; exit 0
fi
tar -xzf "$TARBALL" -C "$STAGE" --strip-components=1; rc=$?
rm -f "$TARBALL"
if [ $rc -ne 0 ]; then echo "[provision] extract failed; keeping baked morphy"; rm -rf "$STAGE"; exit 0; fi
cd "$STAGE"
# --omit=dev with the env scrubbed (postinstall-global hazard, see cli.js)
if ! env -u npm_config_global -u npm_config_prefix npm install --omit=dev --no-audit --no-fund; then
  echo "[provision] npm install failed; keeping baked morphy"; rm -rf "$STAGE"; exit 0
fi
# Carry over the baked workspace deps so the isolated backend has express/better-sqlite3
# even if the nested postinstall flaked (they're re-checked in 4b anyway).
if [ -d /home/ec2-user/.morphy/workspace/node_modules ] && [ ! -d "$STAGE/workspace/node_modules" ]; then
  cp -a /home/ec2-user/.morphy/workspace/node_modules "$STAGE/workspace/"
fi
# Atomic-ish swap: old tree kept as .morphy.prev for one boot in case of a rollback.
rm -rf /home/ec2-user/.morphy.prev
mv /home/ec2-user/.morphy /home/ec2-user/.morphy.prev
mv "$STAGE" /home/ec2-user/.morphy
echo "[provision] morphyagent@${AGENT_VERSION} installed"
UPDATE
else
  echo "[provision] using baked morphyagent $(installed_version) (no version pinned or already installed)"
fi

# ─── 4b. Ensure workspace backend deps (express + better-sqlite3) ─────────────
echo "[provision] ensuring workspace backend deps..."
sudo -u "$RUN_USER" -H bash -s <<'WSDEPS'
set -uo pipefail
cd /home/ec2-user/.morphy/workspace 2>/dev/null || { echo "[provision] no workspace dir"; exit 0; }
for try in 1 2 3; do
  env -u npm_config_global -u npm_config_prefix npm install --omit=dev --no-audit --no-fund && break
  echo "[provision] workspace install attempt $try failed; retrying..."
done
if [ -d node_modules/express ] && [ -d node_modules/better-sqlite3 ]; then
  echo "[provision] workspace deps OK"
else
  echo "[provision] WARN workspace deps still missing after retries"
fi
WSDEPS

# ─── 5 + 6. Seed identity + tunnel-OFF, then init (daemon path) ───────────────
echo "[provision] running morphy init --hosted (tunnel off)..."
sudo -u "$RUN_USER" -H \
  env MORPHY_USERNAME="$USERNAME" \
      MORPHY_RELAY_TOKEN="$RELAY_TOKEN" \
      MORPHY_RELAY_TIER="$RELAY_TIER" \
      MORPHY_RELAY_URL="$RELAY_URL" \
      MORPHY_TUNNEL_MODE=off \
      MORPHY_AI_PROVIDER="$AI_PROVIDER" \
      MORPHY_AI_MODEL="$AI_MODEL" \
      MORPHY_AI_API_KEY="$AI_API_KEY" \
      morphy init --hosted | tee /tmp/bloby-init.out

READY=$(grep -o '__HOSTED_READY__=.*' /tmp/bloby-init.out | tail -1 | cut -d= -f2-)
echo "[provision] hosted ready marker: ${READY:-<none>}"
rm -f /tmp/bloby-init.out

# ─── 7. Wait for the supervisor + Caddy, then report the TRUTH ────────────────
wait_healthy() {
  local deadline=$(( $(date +%s) + HEALTH_WAIT_SEC ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    if curl -sf -m 3 "http://127.0.0.1:${MORPHY_PORT}/api/health" -o /dev/null; then return 0; fi
    sleep 3
  done
  return 1
}

systemctl is-active --quiet caddy || systemctl restart caddy || true
systemctl status caddy --no-pager -l | head -3 || true

if wait_healthy && systemctl is-active --quiet caddy; then
  callback ready
else
  TAIL=$(journalctl -u morphy -n 15 --no-pager 2>/dev/null | tail -c 600 | tr '\n' ' ' || true)
  echo "[provision] morphy did not become healthy within ${HEALTH_WAIT_SEC}s — reporting failed"
  callback failed "supervisor unhealthy after ${HEALTH_WAIT_SEC}s; caddy=$(systemctl is-active caddy); log: ${TAIL}"
fi

# ─── 8. Boot re-post service (self-healing ready callback) ───────────────────
# Runs after every boot (NOT on first boot — this script already reported). Waits for the
# local supervisor, then posts {status:"ready", boot:true} with retries. The relay treats a
# boot post as: refresh DNS if the IP changed, mark online, no-op if we paused it on purpose.
umask 077
cat > "$READY_ENV" <<EOF
INSTANCE_ID=$INSTANCE_ID
CALLBACK_URL=$CALLBACK_URL
PROVISION_TOKEN=$PROVISION_TOKEN
MORPHY_PORT=$MORPHY_PORT
EOF
umask 022

cat > /usr/local/bin/morphy-ready.sh <<'READYSH'
#!/bin/bash
# Re-post "ready" to the relay after boot, once the local supervisor answers.
set -u
. /etc/morphy-ready.env
VERSION=$(jq -r '.version // "unknown"' /home/ec2-user/.morphy/package.json 2>/dev/null || echo unknown)
for _ in $(seq 1 100); do   # up to ~5 min
  if curl -sf -m 3 "http://127.0.0.1:${MORPHY_PORT}/api/health" -o /dev/null; then
    BODY=$(jq -nc --arg id "$INSTANCE_ID" --arg pt "$PROVISION_TOKEN" --arg v "$VERSION" \
           '{instanceId:$id, status:"ready", provisionToken:$pt, boot:true, agentVersion:$v}')
    curl -sf -X POST "$CALLBACK_URL" -H 'Content-Type: application/json' -d "$BODY" \
      --retry 20 --retry-all-errors --retry-delay 6 --max-time 60 -o /dev/null \
      && echo "morphy-ready: posted" || echo "morphy-ready: post failed after retries"
    exit 0
  fi
  sleep 3
done
echo "morphy-ready: supervisor never became healthy"
exit 0
READYSH
chmod 0755 /usr/local/bin/morphy-ready.sh

cat > /etc/systemd/system/morphy-ready.service <<'UNIT'
[Unit]
Description=Morphy managed box: re-post readiness to the relay after boot
After=network-online.target morphy.service caddy.service
Wants=network-online.target
# First boot is handled by provision.sh (cloud-init); this unit covers every later boot.
ConditionPathExists=/etc/morphy-ready.env

[Service]
Type=oneshot
ExecStart=/usr/local/bin/morphy-ready.sh
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable morphy-ready.service >/dev/null 2>&1 || true

echo "[provision] ===== $(date -u +%FT%TZ) done ====="
