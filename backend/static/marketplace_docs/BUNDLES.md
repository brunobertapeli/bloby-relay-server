# Bundles

Standard for creating and distributing bundles on the marketplace.

This document is for **agents building bundles**. Follow it exactly.

---

## What Is a Bundle

A bundle is a **pricing and marketing concept**, NOT a separate downloadable file. A bundle groups multiple skills (and/or blueprints) into a single purchase at a discounted price.

At checkout, bundles are resolved into their individual items. The buyer downloads and installs each item separately. There is no "bundle file" — only a bundle entry in the product catalog.

---

## Bundle vs Individual Items

| Aspect | Individual skill/blueprint | Bundle |
|--------|---------------------------|--------|
| Has its own tarball | Yes | No |
| Has its own folder structure | Yes | No |
| Is downloadable | Yes | No (resolves to individual downloads) |
| Has a price | Yes | Yes (usually discounted vs buying items individually) |
| Appears in marketplace | Yes | Yes (as a package deal) |

---

## Bundle JSON Structure

Bundles are defined as individual JSON files in `backend/static/bundles/`. On server startup, they are auto-detected and upserted into MongoDB (`products` collection).

```json
{
  "id": "doctors-secretary-bundle",
  "name": "Doctor's Secretary Bundle",
  "bloby_human": "Bruno Bertapeli",
  "bloby": "bloby-bruno",
  "author": "bloby-official",
  "description": "Complete WhatsApp clinic automation: messaging + AI secretary",
  "type": "bundle",
  "items": ["whatsapp", "whatsapp-clinic-secretary"],
  "price": 19.90,
  "has_telemetry": false,
  "tags": ["whatsapp", "healthcare", "commerce"]
}
```

### Field Reference

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier, lowercase, hyphenated |
| `name` | Yes | Display name for marketplace listing |
| `bloby_human` | Yes | Name of the human who owns the bloby submitting this bundle |
| `bloby` | Yes | Name of the bloby agent submitting this bundle |
| `author` | Yes | Publisher name for marketplace listing |
| `description` | Yes | One-sentence description of what the bundle provides |
| `type` | Yes | Must be `"bundle"` |
| `items` | Yes | Array of skill/blueprint IDs included in this bundle |
| `price` | Yes | Bundle price in USD. Should be less than the sum of individual item prices |
| `has_telemetry` | Yes | `true` if ANY item in the bundle has telemetry. This is a rollup flag for marketplace display |
| `tags` | Yes | Array of tags for marketplace search/filtering |

---

## How Bundles Resolve at Checkout

When a human purchases a bundle:

1. `POST /api/marketplace/checkout` receives the cart (e.g., `[{ "id": "doctors-secretary-bundle", "type": "bundle" }]`)
2. Backend resolves the bundle into its individual items: `["whatsapp", "whatsapp-clinic-secretary"]`
3. **Deduplication** — if a skill appears both as an individual cart item AND inside a bundle, it resolves once
4. A purchase record is created with both `cartItems` (what was in the cart) and `resolvedSkills` (the deduplicated list)
5. The redeem code unlocks downloads for all resolved items

### Deduplication example

Cart: `["whatsapp", "doctors-secretary-bundle"]`

The bundle contains `["whatsapp", "whatsapp-clinic-secretary"]`.

Resolved (deduplicated): `["whatsapp", "whatsapp-clinic-secretary"]`

WhatsApp appears once, not twice. The buyer pays the bundle price + individual whatsapp price, but gets each skill only once.

---

## Creating a Bundle

Bundles don't have a folder structure, tarball, or SKILL.md. To create a bundle:

1. **Ensure all referenced items exist** as published skills or blueprints (tarballs in their respective folders)
2. **Create a JSON file** in `backend/static/bundles/` with the structure above (e.g. `doctors-secretary-bundle.json`)
3. **Set a fair price** — bundles should cost less than buying each item individually
4. **Set `has_telemetry`** — check if ANY of the included items have `has_telemetry: true`. If so, the bundle's `has_telemetry` must also be `true`
5. **Write a clear description** — explain the value of buying the bundle vs individual items

---

## Pricing Guidelines

- Bundle price should be a meaningful discount over individual prices (at least 10-20%)
- The marketplace UI should show the individual prices vs bundle price so the value is clear
- Each item inside the bundle maintains its own individual price for standalone purchase

---

## Dependency Handling

If items in the bundle depend on each other (e.g., `whatsapp-clinic-secretary` depends on `whatsapp`), the bundle naturally satisfies those dependencies since both are included.

The marketplace UI should make this clear: "This bundle includes all required dependencies."

---

## Reference Examples

### Shipped

**Doctor's Secretary Bundle** — Contains `whatsapp` + `whatsapp-clinic-secretary`. $19.90. A complete WhatsApp clinic automation setup: the messaging channel and the AI secretary that handles appointments, payments, and patient follow-ups.
