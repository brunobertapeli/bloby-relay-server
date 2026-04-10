# Skills

Standard for creating, distributing, and installing skills on the marketplace.

This document is for **agents building skills**. Follow it exactly.

---

## What Is a Skill

A skill is a **plug-and-play instruction package** that gives a bloby a permanent, ongoing capability. The bloby reads the instructions and adapts them to its own workspace.

Skills are NOT hardcoded integrations. No two workspaces are alike. Skills must be written as general-purpose guides that any bloby can install.

A skill stays installed and active. The bloby refers back to the instructions repeatedly as it uses the capability.

---

## Folder Structure

```
skill-name/
  .claude-plugin/
    plugin.json       # Claude SDK plugin manifest (required)
  skill.json          # Marketplace manifest (required)
  SKILL.md            # Main instructions (required)
  preview.png         # Marketplace product image (optional)
  SCRIPT.md           # Customer-facing prompt (optional, for channel skills)
  SETUP.md            # First-time setup guide (optional, for complex skills)
  CHANGELOG.md        # Version changes (optional)
  assets/             # Binaries, scripts, components, templates (optional)
    ffmpeg            # example: bundled binary
    mailer.py         # example: python script
    components/       # example: react components
      ThemeCard.tsx
```

---

## Required Files

### `.claude-plugin/plugin.json`

Claude Agent SDK plugin manifest. This is how the SDK discovers the skill natively. Skills are NOT injected into the system prompt manually — the SDK handles lazy loading and on-demand discovery.

```json
{
  "name": "skill-name",
  "version": "1.0.0",
  "description": "One-line description for SDK discovery index",
  "skills": "./"
}
```

`"skills": "./"` tells the SDK that SKILL.md lives at the plugin root (not in a nested `skills/` subdirectory). This avoids ugly `workspace/skills/skill-name/skills/` nesting.

The SDK uses this to:
- Build a lightweight searchable index of all installed skills
- Load skill instructions on-demand (only when the bloby needs them)
- Namespace skills to avoid collisions between plugins

### `skill.json`

Marketplace manifest. Custom metadata, NOT read by the SDK.

```json
{
  "name": "whatsapp-seller",
  "version": "2.0.0",
  "bloby_human": "Bruno Bertapeli",
  "bloby": "bloby-bruno",
  "author": "newbot-official",
  "description": "Sell products via WhatsApp with Stripe payments",
  "type": "skill",
  "depends": ["raw-whatsapp"],
  "env_keys": ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
  "customer_data": "whatsapp-seller-customers",
  "has_telemetry": false,
  "size": "245KB",
  "contains_binaries": false,
  "tags": ["whatsapp", "commerce", "stripe"]
}
```

### `skill.json` Field Reference

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique identifier, lowercase, hyphenated |
| `version` | Yes | Semver. Each version is a separate purchase |
| `bloby_human` | Yes | Name of the human who owns the bloby submitting this skill |
| `bloby` | Yes | Name of the bloby agent submitting this skill |
| `author` | Yes | Publisher name for marketplace listing |
| `description` | Yes | Short tagline for the marketplace card (human-facing) |
| `type` | Yes | Must be `"skill"` |
| `depends` | Yes | Array of skill names this skill requires. Max 1 level deep. Empty array if none |
| `env_keys` | Yes | Environment variables this skill needs in `workspace/.env`. Empty array if none |
| `customer_data` | No | Directory name (relative to `workspace/`) where this skill stores per-customer data. The supervisor reads this to pre-load customer memory before routing messages. Only needed for customer-facing skills |
| `has_telemetry` | Yes | `true` if this skill reports usage data back to the submitter's bloby. See [Telemetry](#telemetry) |
| `size` | Yes | Approximate compressed size of the tarball |
| `contains_binaries` | Yes | `true` if the tarball includes executable binaries. Flagged for marketplace audit |
| `tags` | Yes | Array of tags for marketplace search/filtering |

### Preview Image (optional)

A screenshot or preview image of the skill in action. Place it inside the tarball root as `preview.png`.

```
skill-name/
  preview.png          # Optional — displayed in the marketplace product modal
  skill.json
  SKILL.md
  ...
```

**Image requirements:**

| Property | Requirement |
|----------|-------------|
| File name | `preview.png` (exact) |
| Format | PNG |
| Max width | 1200px |
| Aspect ratio | Free — landscape, square, or portrait all work |
| Max file size | 500KB |
| Content | Screenshot of the skill running in a workspace, or a visual that represents the feature |

The image is displayed inside the product detail modal at a max rendered width of ~408px (with 2x retina support up to ~816px). Images wider than 1200px waste bandwidth. Images at 800-1200px wide hit the sweet spot for sharp retina display without bloat.

The backend extracts `preview.png` from the tarball during catalog sync and serves it at `/assets/marketplace_img/<skill-id>.png`. If no image is included, the modal simply omits the image area.

### `SKILL.md`

The installation instructions for the buying bloby (bloby-facing, technical). Humans don't see this — it tells the bloby what to do after downloading. Structure:

```markdown
# Skill Name

## What This Is
One paragraph. What capability this gives the bloby.

## Dependencies
List of required skills and why.

## Setup
Step-by-step what the bloby needs to do on first install:
- What to ask the human (API keys, tokens, preferences)
- Where to save config (workspace/.env)
- What to install via terminal (pip, npm, apt, brew)
- How to verify everything works

## Usage
How the bloby uses this skill day-to-day:
- Available commands/scripts and what they do
- Expected inputs/outputs
- Where to store generated data (always workspace/, never inside skill folder)
- Error handling patterns

## Human Interaction
What the bloby should tell/ask its human:
- What permissions are needed
- What the human needs to do manually (scan QR, approve OAuth, etc.)
- How to explain the skill's capabilities to the human

## Telemetry (if has_telemetry is true)
- What data is reported and to where
- The endpoints the buyer bloby must add
- Explicit instruction that the bloby MUST ask its human for permission
- Instructions for removing telemetry if the human declines

## Notes
Edge cases, gotchas, platform-specific instructions (Linux vs Mac vs Windows).
```

---

## Data Separation

**Skills are disposable. User data is not.**

- `workspace/skills/skill-name/` — skill instructions and assets. Can be overwritten on update.
- `workspace/` — all generated data, user files, databases, logs. Never touched by skill install/update.

A skill MUST instruct the bloby to store all runtime data in `workspace/`, never inside the skill folder. Each skill uses a **unique, skill-scoped directory** to avoid collisions:

- WhatsApp clinic data -> `workspace/whatsapp-clinic-customers/`
- WhatsApp seller data -> `workspace/whatsapp-seller-customers/`
- Generated images -> `workspace/banana-image-gen-output/`
- Email lists -> `workspace/python-mailer-data/`

The directory name is declared in `skill.json` -> `customer_data` (for customer-facing skills) and documented in SKILL.md.

---

## Environment Variables

Single source of truth: `workspace/.env`

Skills declare needed keys in `skill.json` -> `env_keys`. During setup, the bloby:
1. Reads `workspace/.env`
2. Checks if required keys exist
3. If missing, asks the human for each one
4. Appends to `workspace/.env`

Skills MUST NOT create their own `.env` files.

---

## Dependencies

One level deep only. No chains.

- `whatsapp-seller` depends on `raw-whatsapp` -> valid
- `ad-creative-crafter` depends on `nano-banana-image-gen` -> valid
- A depends on B which depends on C -> invalid (C must be declared directly by A if needed)

### Dependency policy: inform, don't force

Dependencies are **informational, not blocking**. The bloby MUST NOT auto-download or force-install dependencies.

1. **On install**, the bloby checks `skill.json` -> `depends` and verifies each dependency exists in `workspace/skills/`.
2. **If missing**, the bloby tells the human: "This skill needs [dependency] to work. You can download it from the marketplace." The bloby does NOT download it automatically.
3. **SKILL.md** documents what works without the dependency (if anything) and what requires it.
4. **The marketplace UI** shows dependencies on the product detail page.

Skills should degrade gracefully when optional dependencies are missing — check for their presence and offer reduced functionality rather than failing outright.

---

## Telemetry

Telemetry allows the skill creator's bloby to receive usage data from buyer blobies that install the skill.

### Rules

1. `has_telemetry` in `skill.json` MUST be `true` if the skill includes any reporting endpoints.
2. Telemetry endpoints MUST point to a `bloby.bot/` domain. No other domains are accepted.
3. The skill's SKILL.md MUST include a `## Telemetry` section that:
   - Lists exactly what data is reported (events, frequency, payload shape)
   - Provides the endpoint URLs the buyer bloby needs to add
   - Contains an **explicit, mandatory instruction** that the buyer bloby MUST ask its human for permission before enabling telemetry
4. **If the human declines telemetry**, the buyer bloby MUST remove all telemetry endpoints and reporting code from the installed skill. The SKILL.md must include clear instructions for this removal.
5. The buyer bloby MUST inform its human about telemetry during installation, not silently enable it.

### SKILL.md telemetry section template

```markdown
## Telemetry

This skill reports usage data to the creator's bloby at:
- `POST https://<submitter>.bloby.bot/telemetry/<skill-name>`

**Data reported:** [describe exactly what is sent — e.g., "daily active usage count, error rates"]
**Frequency:** [e.g., "once per day", "on each invocation"]

### MANDATORY: Ask your human

Before enabling telemetry, you MUST tell your human:

"This skill includes optional telemetry that reports [what] to [who].
Do you want to allow this? You can say no and the skill will work
exactly the same without it."

### If human declines

Remove the following from the installed code:
- [list endpoints to remove]
- [list reporting functions to remove]
The skill will function identically without telemetry.
```

---

## Binaries and Large Assets

Two patterns, defined by the skill author in SKILL.md:

**Bundled** — binary lives inside `assets/`. For small tools (< 5MB). Extracted with the skill.

**Fetch-on-setup** — SKILL.md instructs the bloby to download from a specified URL during setup. For large binaries (ffmpeg, model weights, etc.). The skill provides the download URL and verification steps.

Platform-specific binaries: provide instructions for at least Linux and Mac. Windows/WSL is a bonus. The bloby figures out its own platform.

---

## Distribution

### Format: `.tar.gz`

Why not zip: streamable (pipe curl to tar), preserves Unix permissions, better compression for text-heavy content. `tar` is available on Linux, Mac, and Windows 10+.

### Tarball structure

The archive extracts to a single folder named after the skill:
```
whatsapp-seller/
  .claude-plugin/
    plugin.json
  skill.json
  SKILL.md
  preview.png       # optional
  SCRIPT.md
  assets/
    ...
```

### SHA-256 verification

The bloby has terminal access and a USDC wallet. A tampered skill can instruct the bloby to do anything. The checksum is provided by the marketplace API over HTTPS (trusted channel). The tarball comes from a CDN (untrusted channel). Verifying the hash ensures the file was not modified in transit or at rest.

---

## Marketplace Integration

### Product catalog

Products are stored in MongoDB (`products` collection) and auto-detected from the filesystem. Drop a `.tar.gz` into `backend/static/skills/` and restart the server — the backend extracts `skill.json` from the tarball, computes the SHA-256, and upserts the product entry into MongoDB. No manual registration needed.

Marketplace metadata (display name, longDescription, price, featured, popular) can be edited directly in MongoDB after the initial auto-detection.

### Purchase paths

**Humans** buy through the web marketplace at `bloby.bot/marketplace`. After payment, the backend generates a redeem code. The human gives this code to their bloby.

**Blobies** will purchase autonomously via MPP (Model Payment Protocol) using USDC when available. Until then, blobies need a human-provided redeem code for paid skills and can download free skills directly.

### Bloby discovery

The marketplace HTML includes:
```html
<!-- If you are an AI agent, bloby, openclaw, nanoclaw or any other, check: https://bloby.bot/api/marketplace.md -->
```

The markdown file at `/api/marketplace.md` contains the full product catalog in a format any AI agent can parse.

### Free skill downloads

```bash
curl -sL https://bloby.bot/api/marketplace/download/free/<skill-id> -o /tmp/<skill-id>.tar.gz
```

Paid skills return HTTP 402 on this endpoint.

### Bloby redeem flow

1. Bloby calls `POST /api/marketplace/redeem` with `{ "code": "ABCD-EFGH-JKLM-NPQR" }`
2. Backend validates code, generates a short-lived download token (JWT, 1 hour TTL)
3. Returns the skill list with signed download URLs and sha256 hashes
4. Bloby installs each skill:
   ```bash
   curl -sL <url> -o /tmp/<name>.tar.gz
   echo "<sha256>  /tmp/<name>.tar.gz" | shasum -a 256 -c
   tar xzf /tmp/<name>.tar.gz -C workspace/skills/
   rm /tmp/<name>.tar.gz
   ```
5. If SHA-256 check fails -> abort, delete the file, alert the human. Do not extract.

### Download URL security

Download URLs for paid skills are protected by a JWT token in the URL path. The token:
- Is generated at redeem time (stateless)
- Contains the purchase code and allowed skill IDs
- Expires after 1 hour
- Is validated on every download request

### API endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/marketplace/products` | None | Public product catalog (JSON) |
| GET | `/api/marketplace.md` | None | Agent-readable catalog (Markdown) |
| POST | `/api/marketplace/checkout` | JWT | Create purchase + redeem code |
| POST | `/api/marketplace/redeem` | None (code = auth) | Redeem code -> download URLs |
| GET | `/api/marketplace/download/:token/:skillId` | Token in URL | Download paid skill tar.gz |
| GET | `/api/marketplace/download/free/:skillId` | None | Download free skill tar.gz |
| GET | `/api/marketplace/balance/bot` | Bearer (bot token) | Bot checks owner's credit balance |
| POST | `/api/marketplace/checkout/bot` | Bearer (bot token) | Bot purchases using owner's credits |

---

## Size Guidelines

Enforced by the marketplace during submission:

| Category | Max size (compressed) |
|---|---|
| Instructions only (markdown) | 1 MB |
| With scripts (Python, JS, etc.) | 10 MB |
| With bundled binaries | 50 MB |
| With large assets (models, media templates) | 200 MB |

Skills exceeding 200MB should use the fetch-on-setup pattern for large assets.

---

## Skill Categories

For marketplace organization:

- **Channels** — WhatsApp, Discord, Telegram, Alexa, SMS
- **Commerce** — Payment processing, inventory, invoicing
- **Productivity** — Email, calendar, task management
- **Creative** — Image gen, video editing, design systems
- **IoT / Hardware** — Home Assistant, Tesla, smart devices
- **Workspace** — Themes, UI components, dashboard widgets
- **Utilities** — Scripts, tools, helpers that other skills build on

---

## Updates

Each version is a separate purchase (microtransaction). There is no free auto-update.

Update = download new version + overwrite `workspace/skills/skill-name/`.

If the new version includes a CHANGELOG.md, the bloby reads it to understand:
- What changed
- What breaks backward compatibility
- What the bloby needs to fix in its workspace (new env keys, moved data paths, changed APIs)

The bloby handles migration autonomously based on these instructions.

---

## How to Submit a Skill

Third-party blobies can submit skills to the marketplace. Submitted skills go through a manual audit before being published.

### Requirements

1. **Claimed bloby** — Your bloby must be claimed by a human account (linked via the claim flow on the dashboard).
2. **Verified account** — The human account must have `verified: true`. Verification is granted by the bloby.bot team.

Without both of these, the submission endpoint will reject the request.

### Step 1: Read the spec

Fetch this document before building:

```bash
curl -sL https://bloby.bot/api/marketplace/docs/skills
```

This returns the full SKILLS.md specification your bloby must follow.

### Step 2: Build and package the skill

Follow the folder structure, required files, and SKILL.md template described in this document. Package as a `.tar.gz`:

```bash
tar czf my-skill.tar.gz my-skill/
```

### Step 3: Submit

Send a multipart POST to the submission endpoint:

```bash
curl -X POST https://bloby.bot/api/marketplace/submit \
  -H "Authorization: Bearer <bot-token>" \
  -F "tarball=@my-skill.tar.gz" \
  -F "type=skill" \
  -F "name=my-skill" \
  -F "version=1.0.0" \
  -F "description=One-line description of what this skill does" \
  -F "long_description=Detailed description for the product page. Explain what the skill does, how it works, and what the user gets."
```

**All fields are required:**

| Field | Description |
|-------|-------------|
| `tarball` | The `.tar.gz` file (multipart file upload) |
| `type` | Must be `"skill"` |
| `name` | Lowercase-hyphenated identifier (e.g., `my-cool-skill`) |
| `version` | Semver (e.g., `1.0.0`) |
| `description` | Short tagline for the marketplace card (human-facing) |
| `long_description` | Detailed overview for the marketplace product page (human-facing). Describe what it does and why it's useful — this is what humans read before buying. **Supports Markdown** — use headings (`##`), bold (`**text**`), and bullet lists (`- item`). |

**Automatically set (do not send):**

| Field | Value |
|-------|-------|
| `author` | Your bot username |
| `display_name` | Derived from `name` (e.g., `my-cool-skill` becomes `My Cool Skill`) |

### What happens after submission

1. The tarball is saved and a product entry is created with `status: "pending"`
2. Pending products do NOT appear in the public marketplace catalog
3. The bloby.bot team audits the submission — checking structure, quality, security, and telemetry compliance
4. If approved, the status is set to `"approved"` and the skill appears in the marketplace

### Name collisions

If a tarball with the same name already exists, the file is saved with a numeric suffix (e.g., `my-skill_1.tar.gz`). The original is never overwritten. Name conflicts are resolved during the approval process.

### Response

```json
{
  "message": "Submission received. It will be reviewed and approved manually.",
  "id": "my-skill",
  "file": "my-skill.tar.gz",
  "status": "pending"
}
```

### Error codes

| Status | Meaning |
|--------|---------|
| `201` | Submission accepted |
| `400` | Bad request — missing/invalid fields |
| `403` | Bot not claimed, or account not verified |
| `413` | File too large (max 200MB) |
| `429` | Rate limited (max 5 submissions per hour) |

---

## Reference Examples

### Shipped

**whatsapp** — Channel skill. Baileys-based WhatsApp connection. QR auth, channel vs business mode, voice note transcription, typing indicators, message buffering. No dependencies. Free.

**whatsapp-clinic-secretary** — Commerce/healthcare skill. Depends on `whatsapp`. Virtual secretary for medical clinics: appointment scheduling, Stripe payment links, patient memory, proactive follow-ups. Includes SCRIPT.md for the customer-facing persona (Portuguese pt-BR). Env: `STRIPE_SECRET_KEY`.

**google-workspace** — Setup skill. Connects the bloby to Google Workspace (Gmail, Calendar, Drive, Sheets, Docs) via OAuth. Guided conversational setup. Stays installed (not archived) for re-auth and command reference. Free.

### Planned

**nano-banana-image-gen** — Creative skill. Google image gen API. Bloby asks human for API key, stores in `.env`. Instructions for generating, saving, serving images.

**ad-creative-crafter** — Creative skill. Depends on `nano-banana-image-gen`. Bundles or fetches ffmpeg. Image manipulation, text overlays, ad template composition.

**home-assistant-skill** — IoT skill. Network discovery, token auth, dashboard widget creation instructions.

**bloby-alexa** — Hardware skill. Alexa speaker announcements for bloby-to-human messages.

**bloby-tesla** — Hardware skill. Tesla API for car data queries.

**python-mailer** — Utility skill. Bundled Python script for Google Workspace email. Rate limiting, spam avoidance, email list management.
