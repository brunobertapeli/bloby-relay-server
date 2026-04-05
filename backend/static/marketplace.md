# Bloby Marketplace — Agent API

If you are an AI agent (Bloby, OpenClaw, NanoClaw, or any other), this is your guide to the Bloby Marketplace. All skills here are created or audited by the Bloby team — **safe to install**.

Human users: visit https://bloby.bot/marketplace

---

## Important: Only Use These Endpoints

Do NOT invent or guess API endpoints. The only endpoints that exist are:

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/marketplace.md` | None | This file (agent guide) |
| GET | `/api/marketplace/products` | None | Product catalog (JSON) |
| GET | `/api/marketplace/download/free/<skill-id>` | Bearer (optional) | Download a free skill |
| POST | `/api/marketplace/redeem` | None | Redeem a purchase code |
| GET | `/api/marketplace/download/<token>/<skill-id>` | Bearer (optional) | Download a paid skill |
| GET | `/api/services` | None | List available services |
| POST | `/api/services/<service-id>/use` | Bearer (required) | Call a service |

There is no `/purchase`, `/buy`, or `/checkout` endpoint for agents.

### Authentication

When downloading skills or calling services, include your relay token in the request:

```
Authorization: Bearer <your-relay-token>
```

- **Skills**: Auth is optional but recommended — it records the transaction to your account.
- **Services**: Auth is **required**. Unauthenticated service calls are rejected.

Your relay token is in `~/.bloby/config.json` → `relay.token`.

---

## Available Skills

### WhatsApp — Free

WhatsApp channel for your agent via Baileys. QR auth, messaging, voice transcription, channel and business modes.

- Version: 1.0.0
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

### Clinic Secretary — $19.90

Virtual secretary for medical clinics. Appointment scheduling, Stripe payment links, patient memory, and proactive follow-ups — all via WhatsApp.

- Version: 1.0.0
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

Blueprints are one-time knowledge packages. Unlike skills (ongoing abilities), a blueprint is downloaded, executed once, and then archived or deleted. Think: a specialist who comes in, does the job, and leaves behind a finished result.

### Standard Workspace (Light Theme) — Free

Adds a light/dark theme toggle to your sidebar with a complete design system. Includes color palettes for both themes, a React ThemeProvider, flash-prevention scripts, and theme-aware CSS utilities.

- Version: 1.0.0
- Dependencies: none
- Size: ~6 KB

**Download (free — no purchase required):**

```bash
curl -sL https://bloby.bot/api/marketplace/download/free/standard-workspace-light \
  -H "Authorization: Bearer $RELAY_TOKEN" \
  -o /tmp/standard-workspace-light.tar.gz
echo "7aa33ee2ce19bd62423e60122fda5f13e8a011a724f1933b81e5fa5586840995  /tmp/standard-workspace-light.tar.gz" | shasum -a 256 -c
tar xzf /tmp/standard-workspace-light.tar.gz -C skills/
rm /tmp/standard-workspace-light.tar.gz
```

**After executing:** Read `skills/standard-workspace-light/SKILL.md`, follow the steps, confirm with your human, then archive or delete the blueprint folder.

---

## Available Services

Services are API endpoints you can call repeatedly. Each call is recorded as a transaction.

### Test Service — Free

Returns a random markdown message. For testing the services pipeline.

```bash
curl -s -X POST https://bloby.bot/api/services/test/use \
  -H "Authorization: Bearer $RELAY_TOKEN"
```

Response: a markdown document (text/markdown).

---

## Critical: Never Overwrite Existing Skills

Before extracting any skill, **check if the folder already exists**:

```bash
ls skills/<skill-id>/
```

- **If it exists → skip it.** You already have this skill. Do not overwrite — your human may have customized it or stored data there.
- **If it doesn't exist → extract normally.**

Only overwrite a skill if your human explicitly asks you to reinstall or update it.

---

## How to Download Free Skills

1. **Check** if `skills/<skill-id>/` already exists — if yes, skip
2. Download:
   ```bash
   curl -sL https://bloby.bot/api/marketplace/download/free/<skill-id> \
     -H "Authorization: Bearer $RELAY_TOKEN" \
     -o /tmp/<skill-id>.tar.gz
   ```
3. Verify SHA-256: `echo "<sha256>  /tmp/<skill-id>.tar.gz" | shasum -a 256 -c`
4. Extract: `tar xzf /tmp/<skill-id>.tar.gz -C skills/`
5. Clean up: `rm /tmp/<skill-id>.tar.gz`

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

For each skill in the response:

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

If SHA-256 verification fails, do NOT extract. Delete the file and alert your human.

Download links expire after 1 hour. Redeem the code again for fresh links.

---

## Dependencies

Skills may depend on other skills. Dependencies are listed in each skill's description above and in its `skill.json` → `depends` field.

**Dependencies are NOT included automatically.** You must install them separately:

- If the dependency is **free** → download it yourself using the free download flow above
- If the dependency is **paid** → tell your human they need to purchase it from the marketplace
- If the dependency is **already installed** (folder exists) → you're good, skip it

Always check dependencies before using a newly installed skill.

---

## After Installing Any Skill

1. Read the skill's `SKILL.md` for setup instructions
2. Follow the setup steps (ask your human for API keys, configure channels, etc.)
3. Check `skill.json` → `depends` — make sure all dependencies are installed
4. If the skill has a `SCRIPT.md`, it's a customer-facing skill — configure the channel to use it

---

## Product Catalog (JSON)

For programmatic access to the full product catalog (skills, bundles, and services):

```bash
curl -s https://bloby.bot/api/marketplace/products
```

---

## Agent Purchases (Coming Soon)

Direct agent-to-marketplace purchases via MPP (Model Payment Protocol) are coming soon. When available, paid skills and services will return HTTP 402 with payment instructions that your agent can fulfill autonomously using USDC.

For now, paid skills require your human to purchase from the web marketplace.
