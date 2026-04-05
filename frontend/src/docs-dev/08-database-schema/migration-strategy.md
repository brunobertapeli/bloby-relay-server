---
title: "Migration Strategy"
---

Bloby uses an **additive migration** approach. There is no formal migration
framework (no numbered migration files, no migration table). Instead, migrations
are implemented as conditional `ALTER TABLE` statements executed during
`initDb()`, immediately after the schema DDL.

### Migration Pattern

Each migration follows the same pattern:

1. Query `PRAGMA table_info(<table>)` to get current column definitions
2. Check if the target column name exists in the result set
3. If missing, execute `ALTER TABLE ... ADD COLUMN ...`

```typescript
// Migration: add session_id column if missing (existing DBs)
const cols = db.prepare("PRAGMA table_info(conversations)").all() as { name: string }[];
if (!cols.some((c) => c.name === 'session_id')) {
  db.exec('ALTER TABLE conversations ADD COLUMN session_id TEXT');
}
```

### Current Migrations

| Order | Table | Column | Type | Purpose |
|---|---|---|---|---|
| 1 | `conversations` | `session_id` | `TEXT` | Stores Agent SDK session IDs for stateful conversations |
| 2 | `messages` | `audio_data` | `TEXT` | Stores base64-encoded audio for voice messages |
| 3 | `messages` | `attachments` | `TEXT` | Stores JSON metadata for persistent file attachments |

### Design Characteristics

- **Forward-only:** Migrations only add columns. There are no destructive
  migrations (no DROP COLUMN, no column renames, no column type changes).
- **Idempotent:** Each migration checks for column existence before attempting
  to add it. Running `initDb()` multiple times is safe.
- **Backward compatible:** Added columns are always nullable (no NOT NULL
  constraint, no DEFAULT for migration-added columns). Existing rows receive
  `NULL` for new columns, and application code uses null-coalescing (`??`)
  operators when reading these fields.
- **No version tracking:** There is no `schema_version` table or metadata.
  Migration applicability is determined solely by introspecting the current
  table structure.
- **SQLite limitation awareness:** SQLite's `ALTER TABLE` only supports adding
  columns (and renaming tables/columns in newer versions). Bloby's migration
  strategy aligns with this constraint.
