#!/bin/bash
#
# Morphy managed-instance provisioning script (golden AMI).
# Location on the AMI: /home/ec2-user/provision.sh
# Triggered by cloud-init on first boot (see infra/cloud-init-99-morphy.cfg).
#
# What it does (managed / "direct" mode — NO cloudflared tunnel):
#   1. Adds a swapfile BEFORE any npm install   ← fixes the t4g.small OOM
#   2. Reads EC2 user-data (IMDSv2): identity + callback
#   3. Callback {status:"initializing"}
#   4. Updates morphyagent to latest (npm pack + extract)  [swap-backed]
#   5. Seeds MORPHY_* env so `morphy init --hosted` writes a pre-registered,
#      tunnel-OFF config (the box is reached directly via Caddy + a per-bot CF
#      DNS record — no tunnel, no relay data-plane hop)
#   6. Runs `morphy init --hosted` (daemon path, systemd)
#   7. Callback {status:"ready"}  — the relay then reads the EC2 public IP itself
#      (describeInstance) and creates the mybot.morphyagent.com A-record.
#
# Caddy (TLS termination → 127.0.0.1:7400) is a separate systemd service baked
# into the AMI; this script does not configure it, only ensures it is up.
#
set -uo pipefail

LOG=/var/log/bloby-provision.log
exec > >(tee -a "$LOG") 2>&1
echo "[provision] ===== $(date -u +%FT%TZ) starting ====="

RUN_USER=ec2-user
RUN_HOME=/home/$RUN_USER
SWAP_SIZE="${MORPHY_SWAP_SIZE:-4G}"

# ─── 1. Swap FIRST (the OOM fix) ─────────────────────────────────────────────
# The morphy package + its dependency install peaks well above the 2 GB on a
# t4g.small (Starter). A swapfile gives the npm install enough headroom; it is
# slow EBS-backed memory but this is a one-time install burst. Persisted to
# /etc/fstab so it survives reboots (harmless on the larger Pro box too).
ensure_swap() {
  if swapon --show | grep -q '/swapfile'; then
    echo "[provision] swap already active"; return 0
  fi
  echo "[provision] creating ${SWAP_SIZE} swapfile..."
  if ! fallocate -l "$SWAP_SIZE" /swapfile 2>/dev/null; then
    # fallocate can fail on some filesystems — fall back to dd
    local mb; mb=$(numfmt --from=iec "$SWAP_SIZE"); mb=$((mb/1024/1024))
    dd if=/dev/zero of=/swapfile bs=1M count="$mb" status=none
  fi
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  # Favor RAM, use swap only under real pressure (good for an install burst).
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
#                      tier, provisionToken, aiProvider?, aiModel?, aiApiKey? }
jq_get() { echo "$USER_DATA" | jq -r "$1 // empty"; }
INSTANCE_ID=$(jq_get '.instanceId')
CALLBACK_URL=$(jq_get '.callbackUrl')
USERNAME=$(jq_get '.username')
RELAY_TOKEN=$(jq_get '.relayToken')
RELAY_URL=$(jq_get '.relayUrl')
RELAY_TIER=$(jq_get '.tier')
PROVISION_TOKEN=$(jq_get '.provisionToken')
AI_PROVIDER=$(jq_get '.aiProvider')
AI_MODEL=$(jq_get '.aiModel')
AI_API_KEY=$(jq_get '.aiApiKey')

echo "[provision] instanceId=$INSTANCE_ID username=$USERNAME tier=$RELAY_TIER"
if [ -z "$INSTANCE_ID" ] || [ -z "$CALLBACK_URL" ]; then
  echo "[provision] FATAL: missing instanceId/callbackUrl"; exit 1
fi

callback() {
  # $1 = status. Best-effort; the relay reads the public IP itself, so no
  # tunnelUrl is sent. provisionToken authenticates the callback.
  local status="$1"
  curl -sf -X POST "$CALLBACK_URL" \
    -H 'Content-Type: application/json' \
    -d "$(jq -nc --arg id "$INSTANCE_ID" --arg s "$status" --arg pt "$PROVISION_TOKEN" \
          '{instanceId:$id, status:$s, provisionToken:$pt}')" \
    && echo "[provision] callback $status ok" \
    || echo "[provision] callback $status FAILED (continuing)"
}

# ─── 3. initializing ─────────────────────────────────────────────────────────
callback initializing

# ─── 4. Update morphyagent to latest (swap-backed) ─────────────────────────────
# Pull the latest published tarball and extract over ~/.morphy, then install deps.
# Done as ec2-user so file ownership/HOME are correct.
echo "[provision] updating morphyagent..."
sudo -u "$RUN_USER" -H bash -s <<'UPDATE'
set -uo pipefail
cd /home/ec2-user
TARBALL=$(npm pack morphyagent --silent 2>/dev/null | tail -1)
if [ -z "$TARBALL" ] || [ ! -f "$TARBALL" ]; then
  echo "[provision] npm pack failed; keeping pre-baked morphy"
else
  mkdir -p /home/ec2-user/.morphy
  tar -xzf "$TARBALL" -C /home/ec2-user/.morphy --strip-components=1
  rm -f "$TARBALL"
  cd /home/ec2-user/.morphy
  # --omit=dev with the env scrubbed (postinstall-global hazard, see cli.js)
  env -u npm_config_global -u npm_config_prefix npm install --omit=dev --no-audit --no-fund
fi
UPDATE

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

# (Optional) sanity: pull the machine-readable readiness marker out of the log.
READY=$(grep -o '__HOSTED_READY__=.*' /tmp/bloby-init.out | tail -1 | cut -d= -f2-)
echo "[provision] hosted ready marker: ${READY:-<none>}"

# ─── 7. Ensure Caddy (TLS → :7400) is up, then report ready ──────────────────
systemctl is-active --quiet caddy || systemctl restart caddy || true
systemctl status caddy --no-pager -l | head -5 || true

callback ready
echo "[provision] ===== $(date -u +%FT%TZ) done ====="
