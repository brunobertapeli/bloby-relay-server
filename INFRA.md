# Fluxy Hosted Infrastructure

Auto-provisioning system that spins EC2 instances with Fluxy pre-installed from a golden AMI.

---

## Architecture

```
User on www.fluxy.bot
      │
      ├─ 1. Picks plan (Starter/Pro) + region (NA/EU/BR)
      ├─ 2. Google login
      ├─ 3. Clicks "Pay" (payment not yet implemented)
      │
      ▼
Relay Backend (Railway)
      │
      ├─ 4. POST /api/instances → creates DB record (status: "launching")
      ├─ 5. Calls ec2.RunInstances() with golden AMI + user-data JSON
      ├─ 6. EC2 confirms → DB record updated (status: "booting")
      │
      ▼
EC2 Instance boots (golden AMI)
      │
      ├─ 7. cloud-init runs /home/ec2-user/provision.sh
      ├─ 8. provision.sh calls POST /api/instances/callback {status: "initializing"}
      ├─ 9. Runs: fluxy init --hosted
      ├─ 10. Fluxy starts, tunnel comes up
      ├─ 11. provision.sh calls POST /api/instances/callback {status: "ready", tunnelUrl: "..."}
      │
      ▼
Frontend polls GET /api/instances/:id/status
      │
      ├─ Shows progress: launching → booting → initializing → ready
      └─ Shows tunnel URL → user clicks → opens Fluxy onboarding wizard
```

---

## Golden AMI (v4)

Base: **Amazon Linux 2023** on **ARM64 (Graviton)**

Pre-installed:
- Node.js 22.22.0 (system-wide via nodesource)
- Fluxy v0.7.8 at `~/.fluxy/` (via `curl -fsSL https://fluxy.bot/install | sh`)
  - All npm dependencies (`node_modules/`)
  - Pre-built chat UI (`dist-fluxy/`)
  - cloudflared binary (`bin/cloudflared`)
  - Bundled Node 22 at `tools/node/`
  - Fresh workspace template (no user data)
- Tailscale v1.94.2 (installed, daemon enabled, needs `tailscale up` with auth key)
- jq v1.7.1

NOT included (created at runtime by `fluxy init`):
- `~/.fluxy/config.json`
- `~/.fluxy/memory.db`
- `~/.claude/` (user authenticates via onboarding wizard)

### AMI IDs

| Region | AMI ID | AWS Region |
|--------|--------|------------|
| North America | `ami-00e674ff92b7423f4` | us-east-1 |
| Europe | `ami-025fb44094cc763c5` | eu-central-1 |
| Brazil | `ami-0860d3b58ac5ef1ff` | sa-east-1 |

### How to re-bake the AMI

1. SSH into the base instance: `ssh aws1`
2. Make changes (update fluxy, install packages, etc.)
3. Clean user state:
   ```bash
   sudo systemctl stop fluxy
   sudo systemctl disable fluxy
   sudo rm -f /etc/systemd/system/fluxy.service
   sudo systemctl daemon-reload
   rm -rf ~/.claude ~/.codex
   rm -f ~/.fluxy/config.json ~/.fluxy/memory.db*  ~/.fluxy/VERSION
   rm -f ~/.fluxy/workspace/app.db*
   sudo cloud-init clean --logs
   rm -f ~/.bash_history
   ```
4. Create new AMI:
   ```bash
   aws ec2 create-image \
     --instance-id i-00747b6e362e3b7bc \
     --name "fluxy-golden-vX" \
     --no-reboot --region us-east-1
   ```
5. Wait for it: `aws ec2 wait image-available --image-ids ami-xxx --region us-east-1`
6. Copy to other regions:
   ```bash
   aws ec2 copy-image --source-image-id ami-xxx --source-region us-east-1 --region eu-central-1 --name "fluxy-golden-vX"
   aws ec2 copy-image --source-image-id ami-xxx --source-region us-east-1 --region sa-east-1 --name "fluxy-golden-vX"
   ```
7. Update AMI IDs in `backend/.env` and `backend/lib/aws.js`
8. Deregister old AMIs (AWS Console or `aws ec2 deregister-image`)

---

## EC2 Instance Details

### Base instance (AMI source)

- **Instance ID:** `i-00747b6e362e3b7bc`
- **Type:** t4g.small
- **Region:** us-east-1a
- **OS:** Amazon Linux 2023 (aarch64)
- **SSH:** `ssh aws1` (configured in ~/.ssh/config)

### Plans

| Plan | Instance Type | vCPU | RAM | Disk | Price |
|------|--------------|------|-----|------|-------|
| Starter | t4g.small | 2 | 2 GB | 20 GB gp3 | $29/mo |
| Pro | t4g.medium | 2 | 4 GB | 40 GB gp3 | $49/mo |

### Regions

| ID | AWS Region | Location |
|----|-----------|----------|
| na | us-east-1 | Virginia |
| eu | eu-central-1 | Frankfurt |
| br | sa-east-1 | São Paulo |

---

## Security Groups

All named `fluxy-instances-SG`. Rules: outbound all, inbound SSH (port 22) only.

| Region | Security Group ID | VPC |
|--------|-------------------|-----|
| us-east-1 | `sg-023fa7964b46feb25` | `vpc-0e83d89dd9cdf3c44` |
| eu-central-1 | `sg-0956278b8533089dc` | `vpc-05daa576963a8ec4b` |
| sa-east-1 | `sg-0ab1b5fa370b4e673` | `vpc-09e4ff7e47c6adfc1` |

No inbound HTTP needed — Cloudflare tunnel handles public access from inside the instance.

---

## IAM

**User:** `fluxy-bckend` (`arn:aws:iam::270613081471:user/fluxy-bckend`)

**Required permissions:**
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
      "ec2:DescribeSubnets"
    ],
    "Resource": "*"
  }]
}
```

---

## Provisioning Script

Located at `/home/ec2-user/provision.sh` on the AMI.

**Triggered by:** cloud-init on first boot (`/etc/cloud/cloud.cfg.d/99-fluxy.cfg`)

**Reads from EC2 user-data (JSON):**
```json
{
  "instanceId": "internal-db-id",
  "callbackUrl": "https://api.fluxy.bot/api/instances/callback"
}
```

**What it does:**
1. Fetches user-data from IMDS (v2)
2. POSTs `{status: "initializing"}` to callback
3. Updates fluxy to latest via `npm pack fluxy-bot` + extract over `~/.fluxy/`
4. Runs `fluxy init --hosted`
4. Parses `__HOSTED_READY__` JSON output
5. POSTs `{status: "ready", tunnelUrl: "..."}` to callback

**Logs:** `/var/log/fluxy-provision.log`

---

## Backend Files

| File | Purpose |
|------|---------|
| `backend/lib/aws.js` | EC2 SDK wrapper — launchInstance, terminateInstance, restartInstance, describeInstance |
| `backend/routes/instances.js` | API routes — CRUD + callback endpoint |

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/instances` | JWT | List user's instances |
| POST | `/api/instances` | JWT | Launch new instance (calls EC2) |
| GET | `/api/instances/:id/status` | JWT | Poll single instance status |
| POST | `/api/instances/:id/restart` | JWT | Restart EC2 instance |
| DELETE | `/api/instances/:id` | JWT | Terminate EC2 + remove from DB |
| POST | `/api/instances/callback` | None | Called by provision.sh on the EC2 instance |

### Instance Status Flow

```
launching → booting → initializing → ready
                                   → failed
                        ready → restarting → ready
                                           → failed
```

- **launching** — DB record created, EC2 API call in progress
- **booting** — EC2 instance launched, waiting for cloud-init
- **initializing** — provision.sh running, fluxy init in progress
- **ready** — Fluxy is up, tunnel URL available
- **restarting** — EC2 stop+start in progress (polls until running, waits 15s for services, then → ready)
- **failed** — Something went wrong

---

## Environment Variables (backend/.env)

```
# AWS credentials
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx

# AMI IDs per region
AMI_US_EAST_1=ami-00e674ff92b7423f4
AMI_EU_CENTRAL_1=ami-025fb44094cc763c5
AMI_SA_EAST_1=ami-0860d3b58ac5ef1ff

# Security groups per region
SG_US_EAST_1=sg-023fa7964b46feb25
SG_EU_CENTRAL_1=sg-0956278b8533089dc
SG_SA_EAST_1=sg-0ab1b5fa370b4e673
```

These must also be set in Railway for production.

---

## Frontend Flow

Located in `frontend/src/App.jsx` inside the `Terminal` component, under the "Hosted" tab.

Steps: **plan → region → login → payment → provisioning → ready → dashboard**

The provisioning screen polls `GET /api/instances/:id/status` every 3 seconds and maps the status to a visual step indicator:
- Step 0: Spinning up your instance... (`launching`)
- Step 1: Installing Fluxy... (`booting`)
- Step 2: Initializing Fluxy... (`initializing`)
- Step 3: Your Fluxy is ready! (`ready`)

On `ready`, displays the tunnel URL with a copy button and link.

Dashboard actions:
- **Restart** — stops + starts EC2 instance, card shows "Restarting..." with amber pulse, polls every 5s until back to ready
- **Manage Subscription** — placeholder (links to Stripe customer portal when payment is implemented)
- **+ Add new** — launches the plan selection flow for a new instance
- Terminate is handled via backend `DELETE /api/instances/:id` (no UI button — will be triggered by subscription webhook when payment is implemented)

---

## Old AMIs (deregistered / to deregister)

| Version | Region | AMI ID | Notes |
|---------|--------|--------|-------|
| v1 | us-east-1 | `ami-0a8b4c566efde948b` | Had cached Claude credentials |
| v1 | eu-central-1 | `ami-0e06958e8c301cc1a` | Had cached Claude credentials |
| v1 | sa-east-1 | `ami-0252392573b0961b1` | Had cached Claude credentials |
| v2 | us-east-1 | `ami-0679c75fea158d7ba` | Replaced by v4 |
| v2 | eu-central-1 | `ami-03f9f91d9d4261649` | Replaced by v4 |
| v2 | sa-east-1 | `ami-0f48ddb974fb8b780` | Replaced by v4 |
| v3 | us-east-1 | `ami-0df38917f2d42847d` | Broken provision.sh (curl install) |
| v3 | eu-central-1 | `ami-03a1edc96928beffa` | Broken provision.sh (curl install) |
| v3 | sa-east-1 | `ami-0530e4d5310c4220d` | Broken provision.sh (curl install) |
