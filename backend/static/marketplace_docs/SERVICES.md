# Services

Standard for consuming bloby.bot hosted services from the marketplace.

This document is for **agents consuming services**. Services are provided by bloby.bot — they are NOT user-submitted.

---

## What Is a Service

A service is a **hosted API endpoint** provided by bloby.bot that any bloby can call on-demand. Services are pay-per-use. No skill installation, no tarball, no workspace changes.

Services exist so blobies can access capabilities without installing skills. A bloby that rarely generates images shouldn't need an image generation skill cluttering its workspace — it can just call the service when needed.

---

## Services vs Skills

| Aspect | Skill | Service |
|--------|-------|---------|
| Provided by | Anyone (marketplace submissions) | bloby.bot only |
| Installation | Download + extract to `workspace/skills/` | None. Just call the API |
| Workspace impact | Adds files, may need env keys, dependencies | Zero footprint |
| Pricing | One-time purchase per version | Pay-per-use |
| Offline capable | Yes (instructions are local) | No (requires internet) |
| Customizable | Yes (bloby adapts instructions) | No (fixed API contract) |
| Best for | Core, frequently-used capabilities | Occasional, utility capabilities |

### When to use a service vs a skill

**Use a service when:**
- The bloby needs the capability occasionally, not constantly
- The human wants a clean workspace without dozens of installed skills
- The capability requires expensive infrastructure (GPU inference, large models) that doesn't make sense to self-host
- The bloby just needs a quick result, not deep integration

**Use a skill when:**
- The capability is central to the bloby's daily operation
- The human wants full control and customization
- Offline access matters
- The bloby needs to deeply integrate the capability with other skills

A human might choose to buy the `nano-banana-image-gen` skill for daily social media work, but use the image generation service for the occasional one-off request.

---

## How Blobies Consume Services

### Authentication

Every bloby has a bot token issued during workspace setup. Services are authenticated via this token.

```bash
curl -X POST https://bloby.bot/api/services/<service-id> \
  -H "Authorization: Bearer <bot-token>" \
  -H "Content-Type: application/json" \
  -d '{ ...request payload... }'
```

The bot token ties the request to the bloby's owner account for billing.

### Request / Response Pattern

All services follow the same pattern:

**Request:**
```json
{
  "input": { ...service-specific payload... },
  "options": { ...optional parameters... }
}
```

**Response (success):**
```json
{
  "status": "ok",
  "result": { ...service-specific result... },
  "cost": 0.12,
  "balance_remaining": 4.56
}
```

**Response (insufficient balance):**
```json
{
  "status": "error",
  "error": "insufficient_balance",
  "cost": 0.12,
  "balance_remaining": 0.03,
  "message": "This request costs $0.12 but your balance is $0.03. Ask your human to add credits."
}
```

**Response (error):**
```json
{
  "status": "error",
  "error": "processing_failed",
  "message": "Human-readable error description"
}
```

### Balance Management

Services deduct from the owner's credit balance. The bloby can check the balance before making requests:

```bash
curl https://bloby.bot/api/marketplace/balance/bot \
  -H "Authorization: Bearer <bot-token>"
```

Response:
```json
{
  "balance": 4.56,
  "currency": "USD"
}
```

If balance is insufficient, the bloby should tell its human: "I need credits to use [service]. Your current balance is $X.XX. You can add credits at bloby.bot/account."

---

## Cost Estimation

Before calling a service, blobies can check the cost without executing:

```bash
curl -X POST https://bloby.bot/api/services/<service-id>/estimate \
  -H "Authorization: Bearer <bot-token>" \
  -H "Content-Type: application/json" \
  -d '{ ...same request payload... }'
```

Response:
```json
{
  "estimated_cost": 0.12,
  "currency": "USD",
  "balance_remaining": 4.56,
  "can_afford": true
}
```

The bloby SHOULD check cost estimates for expensive operations and inform its human before proceeding.

---

## Service Discovery

### For blobies

Available services are listed in the agent-readable catalog:

```bash
curl https://bloby.bot/api/marketplace.md
```

The services section includes:
- Service ID and name
- What it does
- Cost per use
- Input/output format
- Example curl command

### For humans

Services appear on the marketplace at `bloby.bot/marketplace` under the "Services" tab. Each service page shows pricing, description, and example outputs.

### API catalog

```bash
curl https://bloby.bot/api/services
```

Returns all available services with their metadata:
```json
{
  "services": [
    {
      "id": "image-generation",
      "name": "Nano Banana Image Generation",
      "description": "Generate images from text prompts",
      "cost_per_use": 0.12,
      "cost_unit": "per image",
      "input_schema": { ... },
      "output_format": "url"
    }
  ]
}
```

---

## API Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/services` | None | List all available services with metadata |
| POST | `/api/services/:serviceId` | Bearer (bot token) | Execute a service call |
| POST | `/api/services/:serviceId/estimate` | Bearer (bot token) | Get cost estimate without executing |
| GET | `/api/marketplace/balance/bot` | Bearer (bot token) | Check owner's credit balance |

---

## Available Services

### Image Generation

| | |
|---|---|
| **Service ID** | `image-generation` |
| **Cost** | $0.12 per image |
| **Description** | Generate images from text prompts using Google's image generation API |

**Request:**
```json
{
  "input": {
    "prompt": "A friendly robot assistant waving hello",
    "style": "cartoon"
  },
  "options": {
    "size": "1024x1024"
  }
}
```

**Response:**
```json
{
  "status": "ok",
  "result": {
    "url": "https://bloby.bot/api/services/image-generation/output/abc123.png",
    "expires_in": 3600
  },
  "cost": 0.12,
  "balance_remaining": 4.44
}
```

The output URL is temporary (1 hour). The bloby should download the image to the workspace if it needs to persist.

### Video Transcription

| | |
|---|---|
| **Service ID** | `video-transcription` |
| **Cost** | Varies by duration |
| **Description** | Transcribe audio/video files to text |

**Request:**
```json
{
  "input": {
    "url": "https://example.com/video.mp4"
  },
  "options": {
    "language": "en",
    "format": "srt"
  }
}
```

**Response:**
```json
{
  "status": "ok",
  "result": {
    "text": "Full transcription text...",
    "srt": "1\n00:00:01,000 --> 00:00:04,000\nHello world\n\n...",
    "duration_seconds": 342
  },
  "cost": 0.08,
  "balance_remaining": 4.36
}
```

---

## Bloby Behavior Guidelines

When a bloby uses services, it should follow these principles:

1. **Check balance first** for expensive operations. Don't surprise the human with charges.
2. **Use cost estimates** for operations where the cost isn't fixed (e.g., video transcription varies by duration).
3. **Inform the human** before the first service call in a session: "I'll use the [service] to [do what]. It costs approximately $X. OK?"
4. **Cache results** when appropriate. Don't call the service again for the same input.
5. **Download and persist** any outputs the human will need later (images, transcriptions). Service output URLs expire.
6. **Handle insufficient balance gracefully.** Tell the human how much is needed and where to add credits.
7. **Prefer installed skills** over services for frequently-used capabilities. If the bloby finds itself calling a service repeatedly, suggest the human install the corresponding skill.

---

## Adding New Services

New services are added by the bloby.bot team only. The process:

1. Build and host the service infrastructure
2. Define the API contract (input schema, output format, cost)
3. Add the service to the catalog (`/api/services`)
4. Update the agent-readable catalog (`/api/marketplace.md`)
5. Add the service to the marketplace UI
6. If a corresponding skill exists, link them in the marketplace so humans can compare
