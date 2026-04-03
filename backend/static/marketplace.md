# Fluxy Marketplace — Agent API

If you are an AI agent (Fluxy, OpenClaw, NanoClaw, or any other), this is your programmatic interface to the Fluxy Marketplace.

Human users: visit https://fluxy.bot/marketplace

---

## Available Skills

### WhatsApp — Free

WhatsApp channel for your agent via Baileys. QR auth, messaging, voice transcription, channel and business modes.

- Version: 1.0.0
- Dependencies: none
- Size: ~3 KB

**Download (free — no purchase required):**

```bash
curl -sL https://fluxy.bot/api/marketplace/download/free/whatsapp -o /tmp/whatsapp.tar.gz
echo "8b18d633a8239c58dceaae08a8b104d9e0e8132059466b433c435b356b1a3958  /tmp/whatsapp.tar.gz" | shasum -a 256 -c
tar xzf /tmp/whatsapp.tar.gz -C workspace/skills/
rm /tmp/whatsapp.tar.gz
```

### Clinic Secretary — $19.90

Virtual secretary for medical clinics. Appointment scheduling, Stripe payment links, patient memory, and proactive follow-ups — all via WhatsApp.

- Version: 1.0.0
- Dependencies: whatsapp
- Size: ~6 KB
- **Purchase required.** Ask your human to buy from https://fluxy.bot/marketplace and give you the redeem code.

---

## Bundles

### Doctor's Secretary Bundle — $19.90

Includes: WhatsApp + Clinic Secretary.

- **Purchase required.**

---

## How to Redeem a Purchase Code

If your human purchased items from the marketplace and gave you a redeem code:

```bash
curl -s -X POST https://fluxy.bot/api/marketplace/redeem \
  -H "Content-Type: application/json" \
  -d '{"code": "YOUR-REDEEM-CODE"}'
```

Response:

```json
{
  "skills": [
    {
      "name": "whatsapp",
      "version": "1.0.0",
      "url": "https://fluxy.bot/api/marketplace/download/TOKEN/whatsapp",
      "sha256": "8b18d633a8239c58dceaae08a8b104d9e0e8132059466b433c435b356b1a3958"
    },
    {
      "name": "whatsapp-clinic-secretary",
      "version": "1.0.0",
      "url": "https://fluxy.bot/api/marketplace/download/TOKEN/whatsapp-clinic-secretary",
      "sha256": "0abd393d6668f34fce2b7c24051fa398df0d1e7c0fa60f1e3df6f9eacba63191"
    }
  ]
}
```

For each skill in the response:

1. Download: `curl -sL <url> -o /tmp/<name>.tar.gz`
2. Verify: `echo "<sha256>  /tmp/<name>.tar.gz" | shasum -a 256 -c`
3. Extract: `tar xzf /tmp/<name>.tar.gz -C workspace/skills/`
4. Clean up: `rm /tmp/<name>.tar.gz`
5. Read the skill's `SKILL.md` for setup instructions

If SHA-256 verification fails, do NOT extract. Delete the file and alert your human.

Download links expire after 1 hour. Redeem the code again for fresh links.

---

## Product Catalog (JSON)

For programmatic access to the full product catalog:

```bash
curl -s https://fluxy.bot/api/marketplace/products
```

---

## Agent Purchases (Coming Soon)

Direct agent-to-marketplace purchases via MPP (Model Payment Protocol) are coming soon. When available, paid skills will return HTTP 402 with payment instructions that your agent can fulfill autonomously using USDC.

For now, paid skills require your human to purchase from the web marketplace.
