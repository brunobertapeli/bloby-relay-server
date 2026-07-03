---
title: "Performance"
---

### 8.1 WAL Mode

Both databases use `PRAGMA journal_mode = WAL`. Write-Ahead Logging provides:

- **Concurrent reads during writes:** Multiple readers can proceed while a
  single writer is active. In the default rollback journal mode, writers block
  readers and vice versa.
- **Faster writes:** Changes are appended to the WAL file rather than
  rewriting the main database file. The WAL is checkpointed (merged into the
  main file) automatically by SQLite.
- **Crash safety:** WAL mode provides the same ACID guarantees as the default
  journal mode.

For Morphy's use case (single-user, moderate write volume), WAL mode eliminates
the possibility of `SQLITE_BUSY` errors in nearly all scenarios.

### 8.2 Indexing Strategy

The schema defines two explicit indexes:

| Index | Table | Columns | Query Coverage |
|---|---|---|---|
| `idx_msg_conv` | `messages` | `(conversation_id, created_at)` | `getMessages` -- covers WHERE + ORDER BY; narrows the WHERE for `getRecentMessages` and `getMessagesBefore` |
| `idx_td_token` | `trusted_devices` | `(token)` | `getTrustedDevice`, `updateDeviceLastSeen` -- covers WHERE on token |

Additionally, all primary keys and UNIQUE constraints have implicit indexes:

- `conversations.id` (PK)
- `messages.id` (PK)
- `settings.key` (PK)
- `sessions.token` (PK)
- `push_subscriptions.id` (PK)
- `push_subscriptions.endpoint` (UNIQUE)
- `trusted_devices.id` (PK)
- `trusted_devices.token` (UNIQUE + explicit index)

The `idx_msg_conv` composite index is the most important performance index. It
covers the most frequent query patterns:

1. Fetching all messages for a conversation ordered by time (`getMessages`)
2. Fetching recent messages with a limit (`getRecentMessages`) and
   cursor-based pagination (`getMessagesBefore`)

The recent-messages and pagination queries order by `rowid` rather than
`created_at` (the timestamp has 1-second resolution, so rapid-fire messages
can collide), but the index still narrows the scan to a single conversation.
Without it, these queries would require a full table scan of all messages,
which would degrade as the message count grows.

### 8.3 ID Generation

Generated TEXT primary keys (`conversations.id`, `messages.id`,
`trusted_devices.id`) use `lower(hex(randomblob(8)))` as the default value.
This generates a 16-character lowercase hex string (64 bits of entropy, or
approximately 1.8 * 10^19 possible values). This is:

- **Collision-resistant:** The probability of collision is negligible for a
  single-user application.
- **Non-sequential:** Unlike AUTOINCREMENT, these IDs do not reveal insertion
  order or count.
- **URL-safe:** The hex encoding contains only `[0-9a-f]`, making IDs safe for
  use in URLs and API paths.

The remaining primary keys are application-supplied: `settings.key` and
`sessions.token` are natural keys, and `push_subscriptions` uses `INTEGER
PRIMARY KEY AUTOINCREMENT`, which is appropriate since the numeric ID is not
exposed in URLs and the endpoint URL serves as the natural key.

### 8.4 Foreign Key Enforcement

Foreign keys are enabled via `PRAGMA foreign_keys = ON` on the primary
database. This is significant because SQLite disables foreign key enforcement by
default, and the pragma must be set per-connection (it is not persisted in the
database file). The primary benefit is the `ON DELETE CASCADE` on
`messages.conversation_id`, which ensures that deleting a conversation
atomically removes all its messages without requiring application logic.

### 8.5 Data Volume Expectations

Morphy is designed as a single-user self-hosted platform. The expected data
volumes are:

- **Conversations:** Tens to low hundreds
- **Messages:** Thousands (bounded by conversation count and length)
- **Settings:** Tens of rows
- **Sessions:** Single digits (one per active login)
- **Push subscriptions:** Single digits (one per browser)
- **Trusted devices:** Single digits

At these volumes, SQLite performance is not a concern. The `idx_msg_conv`
composite index ensures that even with thousands of messages, conversation
message retrieval remains efficient.

### 8.6 No Connection Pooling

`better-sqlite3` uses a single synchronous connection. There is no connection
pool. This is by design: SQLite supports only one writer at a time, and
`better-sqlite3`'s synchronous nature means there is no concurrency within a
single Node.js process. The worker API runs in-process with the supervisor
(`createWorkerApp()` in `worker/index.ts`), so all reads and writes go through
this one connection. WAL mode ensures that any external tool reading the
database file (such as the `sqlite3` CLI) can do so concurrently without
blocking writes.
