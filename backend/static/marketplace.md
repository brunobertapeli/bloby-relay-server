# Bloby Marketplace — Agent API

If you are an AI agent (Bloby, OpenClaw, NanoClaw, or any other), this is your guide to the Bloby Marketplace. All products here are created or audited by the Bloby team — **safe to install**.

Human users: visit https://bloby.bot/marketplace

---

## Glossary

- **Skill** — A permanent ability you install. Stays active and teaches you how to do something ongoing (e.g. WhatsApp messaging, clinic scheduling). Lives in `skills/` indefinitely.
- **Blueprint** — A one-time knowledge package. You download it, execute the instructions once, confirm with your human, then archive it to `skills/_archive/`. It leaves behind a finished result (e.g. a themed workspace), but the instructions themselves are not kept active.
- **Bundle** — A discounted package of multiple skills sold together. At checkout, bundles resolve into their individual skills.
- **Service** — A cloud API you call on demand. Runs on Bloby's servers, charged per use. No installation needed — just call the endpoint.

---

## Important: Only Use These Endpoints

Do NOT invent or guess API endpoints. The only endpoints that exist are:

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/marketplace.md` | None | This file (agent guide) |
| GET | `/api/marketplace/products` | None | Product catalog (JSON) |
| GET | `/api/marketplace/download/free/<id>` | Bearer (optional) | Download a free skill or blueprint |
| POST | `/api/marketplace/redeem` | None | Redeem a purchase code |
| GET | `/api/marketplace/download/<token>/<id>` | Bearer (optional) | Download a paid skill or blueprint |
| GET | `/api/marketplace/balance/bot` | Bearer (required) | Check your owner's credit balance |
| POST | `/api/marketplace/checkout/bot` | Bearer (required) | Purchase items using owner's credits |
| GET | `/api/services` | None | List available services |
| POST | `/api/services/<service-id>/use` | Bearer (required) | Call a service |

There is no `/purchase`, `/buy`, or `/checkout` endpoint for agents.

### Authentication

When downloading products or calling services, include your relay token in the request:

```
Authorization: Bearer <your-relay-token>
```

- **Skills & Blueprints**: Auth is optional but recommended — it records the transaction to your account.
- **Services**: Auth is **required**. Unauthenticated service calls are rejected.

Your relay token is in `~/.bloby/config.json` → `relay.token`.

---

## Available Skills

### WhatsApp — Free

WhatsApp channel for your agent via Baileys. QR auth, messaging, voice transcription, channel and business modes.

- **Version: 1.0.0**
- Dependencies: none
- Size: ~3 KB

**Download (free — no purchase required):**

```bash
curl -sL https://bloby.bot/api/marketplace/download/free/whatsapp \
  -H "Authorization: Bearer $RELAY_TOKEN" \
  -o /tmp/whatsapp.tar.gz
echo "8b18d633a8239c58dceaae08a8b104d9e0e8132059466b433c435b356b1a3958  /tmp/whatsapp.tar.gz" | shasum -a 256 -c
tar xzf /tmp/whatsapp.tar.gz -C skills/
rm /tmp/whatsapp.tar.gz
```

### Google Workspace — Free

Connects your agent to Google Workspace (Gmail, Calendar, Drive, Sheets, Docs) via OAuth 2.0 and the `gws` CLI. A guided conversational setup — your agent walks the user through GCP project creation, OAuth credentials, and service selection.

- **Version: 1.0.0**
- Dependencies: none
- Size: ~6 KB

**Download (free — no purchase required):**

```bash
curl -sL https://bloby.bot/api/marketplace/download/free/google-workspace \
  -H "Authorization: Bearer $RELAY_TOKEN" \
  -o /tmp/google-workspace.tar.gz
echo "3fd335781a2fd63860742e91b7fc01ce4190f30967434c4718d63f1059d1e63c  /tmp/google-workspace.tar.gz" | shasum -a 256 -c
tar xzf /tmp/google-workspace.tar.gz -C skills/
rm /tmp/google-workspace.tar.gz
```

### Clinic Secretary — $19.90

Virtual secretary for medical clinics. Appointment scheduling, Stripe payment links, patient memory, and proactive follow-ups — all via WhatsApp.

- **Version: 1.0.0**
- **Requires: `whatsapp` skill** (free — download it first if you don't have it)
- Size: ~6 KB
- **Purchase required.** Ask your human to buy from https://bloby.bot/marketplace and give you the redeem code.

---

## Bundles

### Doctor's Secretary Bundle — $19.90

Includes: WhatsApp + Clinic Secretary. If you need both, this is the way to get them.

- **Purchase required.**

---

## Blueprints

Blueprints are one-time knowledge packages. You download, execute, confirm with your human, then **archive to `skills/_archive/`**. They do not stay in `skills/`.

### Standard Workspace (Light Theme) — Free

Adds a light/dark theme toggle to your sidebar with a complete design system. Includes color palettes for both themes, a React ThemeProvider, flash-prevention scripts, and theme-aware CSS utilities.

- **Version: 1.0.0**
- Dependencies: none
- Size: ~6 KB

**Download (free — no purchase required):**

```bash
curl -sL https://bloby.bot/api/marketplace/download/free/standard-workspace-light \
  -H "Authorization: Bearer $RELAY_TOKEN" \
  -o /tmp/standard-workspace-light.tar.gz
echo "86e291c15611121b7ccf4dc75cae612be46520f1893c00541220c685bcf092ce  /tmp/standard-workspace-light.tar.gz" | shasum -a 256 -c
tar xzf /tmp/standard-workspace-light.tar.gz -C skills/
rm /tmp/standard-workspace-light.tar.gz
```

**After executing:** Read `skills/standard-workspace-light/SKILL.md`, follow the steps, confirm with your human, then archive: `mv skills/standard-workspace-light/ skills/_archive/standard-workspace-light/`

### Workspace Lock — Free

Adds a PIN code or password lock screen to your workspace. Supports localStorage sessions so known devices are remembered, scrypt hashing for security, and agent-triggered reset if the user forgets their code.

- **Version: 1.0.0**
- Dependencies: none
- Size: ~18 KB

**Download (free — no purchase required):**

```bash
curl -sL https://bloby.bot/api/marketplace/download/free/workspace-lock \
  -H "Authorization: Bearer $RELAY_TOKEN" \
  -o /tmp/workspace-lock.tar.gz
echo "2a1cf8d013c3976f040dd9f92718109de44ffd51ba00e5760fdf500eb9521e94  /tmp/workspace-lock.tar.gz" | shasum -a 256 -c
tar xzf /tmp/workspace-lock.tar.gz -C skills/
rm /tmp/workspace-lock.tar.gz
```

**After executing:** Read `skills/workspace-lock/SKILL.md`, follow the steps, confirm with your human, then archive: `mv skills/workspace-lock/ skills/_archive/workspace-lock/`

---

## Available Services

Services are cloud API endpoints you call on demand. Each call is recorded as a transaction.

### Test Service — Free

Returns a random markdown message. For testing the services pipeline.

- **Version: 1.0.0**

```bash
curl -s -X POST https://bloby.bot/api/services/test/use \
  -H "Authorization: Bearer $RELAY_TOKEN"
```

Response: a markdown document (text/markdown).

---

## Critical: Never Overwrite Existing Skills

Before extracting any skill or blueprint, **check if the folder already exists**:

```bash
ls skills/<id>/
```

- **If it exists → skip it.** You already have this product. Do not overwrite — your human may have customized it or stored data there.
- **If it doesn't exist → extract normally.**

Only overwrite if your human explicitly asks you to reinstall or update.

---

## How to Download Free Products

1. **Check** if `skills/<id>/` already exists — if yes, skip
2. Download:
   ```bash
   curl -sL https://bloby.bot/api/marketplace/download/free/<id> \
     -H "Authorization: Bearer $RELAY_TOKEN" \
     -o /tmp/<id>.tar.gz
   ```
3. Verify SHA-256: `echo "<sha256>  /tmp/<id>.tar.gz" | shasum -a 256 -c`
4. Extract: `tar xzf /tmp/<id>.tar.gz -C skills/`
5. Clean up: `rm /tmp/<id>.tar.gz`
6. **If blueprint:** Execute instructions, confirm with human, then archive to `skills/_archive/`

**If SHA-256 verification fails, do NOT extract.** Delete the file and alert your human.

---

## How to Redeem a Purchase Code

If your human purchased items from the marketplace and gave you a redeem code (format: `XXXX-XXXX-XXXX-XXXX`):

```bash
curl -s -X POST https://bloby.bot/api/marketplace/redeem \
  -H "Content-Type: application/json" \
  -d '{"code": "YOUR-REDEEM-CODE"}'
```

Response:

```json
{
  "skills": [
    {
      "name": "whatsapp-clinic-secretary",
      "version": "1.0.0",
      "url": "https://bloby.bot/api/marketplace/download/TOKEN/whatsapp-clinic-secretary",
      "sha256": "0abd393d6668f34fce2b7c24051fa398df0d1e7c0fa60f1e3df6f9eacba63191"
    }
  ]
}
```

For each item in the response:

1. **Check** if `skills/<name>/` already exists — if yes, **skip it**
2. Download (include your auth header):
   ```bash
   curl -sL <url> \
     -H "Authorization: Bearer $RELAY_TOKEN" \
     -o /tmp/<name>.tar.gz
   ```
3. Verify: `echo "<sha256>  /tmp/<name>.tar.gz" | shasum -a 256 -c`
4. Extract: `tar xzf /tmp/<name>.tar.gz -C skills/`
5. Clean up: `rm /tmp/<name>.tar.gz`
6. **If blueprint:** Execute, confirm, archive to `skills/_archive/`

If SHA-256 verification fails, do NOT extract. Delete the file and alert your human.

Download links expire after 1 hour. Redeem the code again for fresh links.

---

## Dependencies

Skills may depend on other skills. Dependencies are listed in each product's description above and in its `skill.json` → `depends` field.

**Dependencies are NOT included automatically.** You must install them separately:

- If the dependency is **free** → download it yourself using the free download flow above
- If the dependency is **paid** → tell your human they need to purchase it from the marketplace
- If the dependency is **already installed** (folder exists) → you're good, skip it

Always check dependencies before using a newly installed skill.

---

## After Installing

**Skills:**
1. Read the skill's `SKILL.md` for setup instructions
2. Follow the setup steps (ask your human for API keys, configure channels, etc.)
3. Check `skill.json` → `depends` — make sure all dependencies are installed
4. If the skill has a `SCRIPT.md`, it's a customer-facing skill — configure the channel to use it

**Blueprints:**
1. Read the blueprint's `SKILL.md` for execution instructions
2. Execute all steps, adapting to your workspace's current state
3. Confirm with your human that everything works
4. Archive: `mv skills/<blueprint-id>/ skills/_archive/<blueprint-id>/`

---

## Product Catalog (JSON)

For programmatic access to the full product catalog (skills, bundles, blueprints, and services):

```bash
curl -s https://bloby.bot/api/marketplace/products
```

Each product includes a `version` field. Compare against installed versions during pulse to detect available updates.

---

## Purchasing Paid Products (Claimed Agents)

If you have been claimed by a human (linked to their dashboard account), you can purchase paid products directly using their credit balance. **You must be claimed** — unclaimed agents cannot use this flow.

### Step 1: Check your balance

```bash
curl -s https://bloby.bot/api/marketplace/balance/bot \
  -H "Authorization: Bearer $RELAY_TOKEN"
```

Response: `{ "balance": 40 }` — this is your owner's credit balance in USD.

### Step 2: Purchase

```bash
curl -s -X POST https://bloby.bot/api/marketplace/checkout/bot \
  -H "Authorization: Bearer $RELAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"items": [{"id": "whatsapp-clinic-secretary", "type": "skill"}]}'
```

Response (same format as redeem):

```json
{
  "skills": [
    {
      "name": "whatsapp-clinic-secretary",
      "version": "1.0.0",
      "url": "https://bloby.bot/api/marketplace/download/TOKEN/whatsapp-clinic-secretary",
      "sha256": "0abd393d..."
    }
  ],
  "total": 19.90,
  "balanceRemaining": 20.10
}
```

Then install each skill using the same download/verify/extract flow described above.

**Errors:**
- `403` — You are not claimed (no linked account)
- `402` — Insufficient credit balance. Tell your human to add credits at https://bloby.bot/marketplace

### Bundles

To buy a bundle, send `"type": "bundle"`:

```bash
curl -s -X POST https://bloby.bot/api/marketplace/checkout/bot \
  -H "Authorization: Bearer $RELAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"items": [{"id": "doctors-secretary-bundle", "type": "bundle"}]}'
```

Bundles resolve to their individual skills — the response lists each skill with its own download URL.

---

## Agent Purchases via MPP (Coming Soon)

Direct agent-to-marketplace purchases via MPP (Model Payment Protocol) using USDC wallets are coming soon. This will allow agents to pay with their own funds, independent of their human's credit balance.
