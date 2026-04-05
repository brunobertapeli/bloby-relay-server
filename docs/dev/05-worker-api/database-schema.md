---
title: "Database Schema"
---

The SQLite database lives at `~/.bloby/memory.db` and uses WAL journal mode
with foreign keys enabled.

### Tables

#### `conversations`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | `lower(hex(randomblob(8)))` -- 16 hex chars |
| `title` | TEXT | User-provided or null |
| `model` | TEXT | AI model used |
| `session_id` | TEXT | Agent SDK session ID (migration-added) |
| `created_at` | DATETIME | Auto |
| `updated_at` | DATETIME | Updated on each new message |

#### `messages`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | 16 hex chars |
| `conversation_id` | TEXT FK | Cascading delete on parent |
| `role` | TEXT | Constrained to `user`, `assistant`, `system` |
| `content` | TEXT | |
| `tokens_in` | INTEGER | Nullable |
| `tokens_out` | INTEGER | Nullable |
| `model` | TEXT | Nullable |
| `audio_data` | TEXT | Base64 audio (migration-added) |
| `attachments` | TEXT | JSON string of file attachments (migration-added) |
| `created_at` | DATETIME | |

Index: `idx_msg_conv` on `(conversation_id, created_at)`.

#### `settings`

| Column | Type | Notes |
|---|---|---|
| `key` | TEXT PK | |
| `value` | TEXT | |
| `updated_at` | DATETIME | |

#### `sessions`

| Column | Type | Notes |
|---|---|---|
| `token` | TEXT PK | 128 hex chars |
| `created_at` | DATETIME | |
| `expires_at` | DATETIME | Checked with `> datetime('now')` |

#### `push_subscriptions`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | AUTOINCREMENT |
| `endpoint` | TEXT UNIQUE | Web Push endpoint URL |
| `keys_p256dh` | TEXT | |
| `keys_auth` | TEXT | |
| `created_at` | DATETIME | |

#### `trusted_devices`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | 16 hex chars |
| `token` | TEXT UNIQUE | 64 hex chars, stored in `bloby_device` cookie |
| `label` | TEXT | e.g. `"Browser"` |
| `created_at` | DATETIME | |
| `expires_at` | DATETIME | 90-day window |
| `last_seen` | DATETIME | Updated on each validated login |

Index: `idx_td_token` on `(token)`.
