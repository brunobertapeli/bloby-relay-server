---
title: "Query Patterns"
---

### 7.1 Prepared Statements

All queries use `better-sqlite3`'s `.prepare()` method, which compiles the SQL
statement once and allows repeated execution with different parameters. However,
in the current codebase, prepared statements are created inline within each
function call rather than cached at module scope:

```typescript
export function getSetting(key: string): string | undefined {
  return (db.prepare('SELECT value FROM settings WHERE key = ?')
    .get(key) as any)?.value;
}
```

`better-sqlite3` internally caches compiled statements, so this pattern has
negligible overhead.

### 7.2 Parameterized Queries

All user-supplied values are passed as positional parameters (`?` placeholders),
never concatenated into SQL strings. This provides inherent protection against
SQL injection:

```typescript
db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
```

### 7.3 RETURNING Clause

Insert operations that need the created row use SQLite's `RETURNING *` clause
(available since SQLite 3.35.0) combined with `.get()`:

```typescript
db.prepare('INSERT INTO conversations (title, model) VALUES (?, ?) RETURNING *')
  .get(title ?? null, model ?? null);
```

This eliminates the need for a separate SELECT after INSERT to retrieve
auto-generated defaults (ID, timestamps).

### 7.4 Upsert (ON CONFLICT)

Two tables use upsert patterns with `ON CONFLICT ... DO UPDATE`:

- **settings:** Conflict on `key` (primary key), updates `value` and
  `updated_at`
- **push_subscriptions:** Conflict on `endpoint` (unique), updates encryption
  keys

```typescript
db.prepare(
  `INSERT INTO settings (key, value) VALUES (?, ?)
   ON CONFLICT(key) DO UPDATE SET
     value = excluded.value,
     updated_at = CURRENT_TIMESTAMP`
).run(key, value);
```

### 7.5 Subquery for "Last N, Ordered Ascending"

The `getRecentMessages` and `getMessagesBefore` functions use a subquery pattern
to retrieve the last N rows ordered ascending:

```sql
SELECT * FROM (
  SELECT * FROM messages WHERE conversation_id = ?
  ORDER BY created_at DESC LIMIT ?
) sub ORDER BY created_at ASC
```

The inner query selects the N most recent rows (descending), and the outer query
re-sorts them chronologically (ascending). This is a standard SQLite pattern
since window functions or complex CTEs are unnecessary for this use case.

### 7.6 Expiry Filtering at Query Time

Time-sensitive entities (sessions, trusted devices) are filtered at query time
using SQLite's `datetime('now')` function rather than relying solely on garbage
collection:

```sql
SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')
```

This means an expired token will never be considered valid, even if
`deleteExpiredSessions()` has not been called recently.

### 7.7 Implicit Transactions

The codebase does not use explicit `BEGIN`/`COMMIT` transactions. Each
statement runs in its own implicit auto-commit transaction. In the
`addMessage()` function, the INSERT and UPDATE are two separate auto-commit
operations. If the process crashes between them, the message would be persisted
but the conversation's `updated_at` would not be updated -- a benign
inconsistency.

### 7.8 Synchronous API

`better-sqlite3` is fully synchronous. All `.get()`, `.all()`, and `.run()`
calls block the Node.js event loop until the query completes. For a single-user
self-hosted application with a small dataset, this is acceptable. The WAL
journal mode mitigates most contention concerns.
