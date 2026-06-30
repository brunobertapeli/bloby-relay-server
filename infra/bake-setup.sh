#!/bin/bash
# Runs as root ON the base instance to turn it into the morphy-golden-v1 image.
# Idempotent-ish; loud on critical failures.
set -uo pipefail
BAKE=/tmp/bake
log(){ echo "[bake] $*"; }
die(){ echo "[bake] FATAL: $*" >&2; exit 1; }

log "===== morphy golden v1 bake start $(date -u +%FT%TZ) ====="
log "node: $(node -v 2>&1 || echo MISSING)  npm: $(npm -v 2>&1 || echo MISSING)"
command -v node >/dev/null || die "system node missing"

# 1. Swap (headroom so npm installs don't OOM on t4g.small) ───────────────────
if ! swapon --show | grep -q /swapfile; then
  log "creating 4G swapfile..."
  fallocate -l 4G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=4096 status=none
  chmod 600 /swapfile; mkswap /swapfile >/dev/null; swapon /swapfile
  grep -q /swapfile /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
swapon --show

# 2. jq (provision.sh needs it) ───────────────────────────────────────────────
command -v jq >/dev/null || dnf install -y jq

# 3. Strip legacy bloby state ─────────────────────────────────────────────────
for svc in bloby morphy; do
  systemctl stop  "$svc" 2>/dev/null || true
  systemctl disable "$svc" 2>/dev/null || true
  rm -f "/etc/systemd/system/${svc}.service"
done
systemctl daemon-reload || true
rm -rf /home/ec2-user/.bloby /home/ec2-user/.claude /home/ec2-user/.codex
rm -f  /home/ec2-user/provision.sh
rm -f  /etc/cloud/cloud.cfg.d/99-bloby.cfg

# 4. morphyagent: global `morphy` bin + pre-baked ~/.morphy app dir ────────────
log "installing morphyagent globally..."
npm install -g morphyagent --no-audit --no-fund || die "npm i -g morphyagent failed"
command -v morphy >/dev/null || die "morphy bin not on PATH after global install"
log "morphy bin: $(command -v morphy)  version: $(morphy --version 2>&1 | head -1 || echo '?')"

log "pre-baking ~/.morphy (fallback app dir)..."
sudo -u ec2-user -H bash -lc '
  set -euo pipefail
  cd /home/ec2-user
  rm -rf .morphy && mkdir -p .morphy
  TARBALL=$(npm pack morphyagent --silent | tail -1)
  [ -f "$TARBALL" ] || { echo "npm pack produced no tarball"; exit 1; }
  tar -xzf "$TARBALL" -C .morphy --strip-components=1
  rm -f "$TARBALL"
  cd .morphy
  env -u npm_config_global -u npm_config_prefix npm install --omit=dev --no-audit --no-fund
' || die "~/.morphy pre-bake failed"
# golden image carries NO user/config state
rm -f /home/ec2-user/.morphy/config.json /home/ec2-user/.morphy/memory.db* /home/ec2-user/.morphy/VERSION
rm -f /home/ec2-user/.morphy/workspace/app.db* 2>/dev/null || true

# 5. Caddy (static binary) + user + config + certs + unit ──────────────────────
if [ ! -x /usr/bin/caddy ]; then
  log "downloading caddy (arm64)..."
  curl -fsSL "https://caddyserver.com/api/download?os=linux&arch=arm64" -o /tmp/caddy || die "caddy download failed"
  install -m 0755 /tmp/caddy /usr/bin/caddy
fi
log "caddy: $(/usr/bin/caddy version 2>&1 | head -1)"
id caddy >/dev/null 2>&1 || useradd --system --home /var/lib/caddy --create-home --shell /usr/sbin/nologin caddy
install -d -o caddy -g caddy /etc/caddy
install -m 0644 -o caddy -g caddy "$BAKE/Caddyfile"     /etc/caddy/Caddyfile
install -m 0644 -o caddy -g caddy "$BAKE/cf-origin.pem" /etc/caddy/cf-origin.pem
install -m 0600 -o caddy -g caddy "$BAKE/cf-origin.key" /etc/caddy/cf-origin.key
install -m 0644 "$BAKE/caddy.service" /etc/systemd/system/caddy.service
systemctl daemon-reload
/usr/bin/caddy validate --adapter caddyfile --config /etc/caddy/Caddyfile || die "Caddyfile invalid"
systemctl enable caddy
systemctl restart caddy
sleep 2
systemctl is-active --quiet caddy || die "caddy not active after restart"
log "caddy active; listening:"; ss -ltnp 2>/dev/null | grep ':443' || log "(no :443 yet — ok if just started)"

# 6. Bot provisioning artifacts (run on each NEW instance via cloud-init) ──────
install -m 0755 -o ec2-user -g ec2-user "$BAKE/provision.sh" /home/ec2-user/provision.sh
install -m 0644 "$BAKE/cloud-init-99-bloby.cfg" /etc/cloud/cloud.cfg.d/99-bloby.cfg

# 7. Pristine-ify for imaging ──────────────────────────────────────────────────
rm -rf /tmp/bake
rm -f /home/ec2-user/.bash_history /root/.bash_history
cloud-init clean --logs || true

log "===== BAKE_OK $(date -u +%FT%TZ) ====="
