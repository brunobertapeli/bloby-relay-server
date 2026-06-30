#!/bin/bash
# Open inbound 443 from Cloudflare's IP ranges on the 3 Morphy managed-instance SGs.
#
# Run this with ADMIN AWS creds — the relay user (fluxy-bckend) intentionally lacks
# ec2:AuthorizeSecurityGroupIngress, so it cannot do this itself.
#
#   AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... bash open-443-cloudflare.sh
#
# Idempotent: re-running just skips rules that already exist.
set -uo pipefail

SGS=( "us-east-1:sg-023fa7964b46feb25" "eu-central-1:sg-0956278b8533089dc" "sa-east-1:sg-0ab1b5fa370b4e673" )

echo "Fetching current Cloudflare IP ranges..."
V4=$(curl -fsSL https://www.cloudflare.com/ips-v4) || { echo "failed to fetch ips-v4"; exit 1; }
V6=$(curl -fsSL https://www.cloudflare.com/ips-v6) || { echo "failed to fetch ips-v6"; exit 1; }

for entry in "${SGS[@]}"; do
  R=${entry%%:*}; SG=${entry##*:}
  echo "=== $R  $SG ==="
  for cidr in $V4; do
    aws ec2 authorize-security-group-ingress --region "$R" --group-id "$SG" \
      --ip-permissions "IpProtocol=tcp,FromPort=443,ToPort=443,IpRanges=[{CidrIp=$cidr,Description=cloudflare}]" \
      >/dev/null 2>&1 && echo "  + $cidr" || echo "  . $cidr (exists/skip)"
  done
  for cidr in $V6; do
    aws ec2 authorize-security-group-ingress --region "$R" --group-id "$SG" \
      --ip-permissions "IpProtocol=tcp,FromPort=443,ToPort=443,Ipv6Ranges=[{CidrIpv6=$cidr,Description=cloudflare}]" \
      >/dev/null 2>&1 && echo "  + $cidr" || echo "  . $cidr (exists/skip)"
  done
done
echo "Done. Verify e.g.:  aws ec2 describe-security-groups --region us-east-1 --group-ids sg-023fa7964b46feb25 --query 'SecurityGroups[].IpPermissions[?FromPort==\`443\`]'"
