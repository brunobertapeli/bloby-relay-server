---
title: "Connection Management"
---

### 2.1 Primary Database (memory.db)

Connection is established by `initDb()`, called once at the top of
`createWorkerApp()` in `worker/index.ts`. The worker runs in-process: the
supervisor mounts the returned Express app, so the connection opens during
supervisor startup:

```typescript
export function initDb(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(paths.db);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  // ... migrations ...
}
```

Key connection details:

| Setting | Value | Purpose |
|---|---|---|
| **File path** | `path.join(os.homedir(), '.morphy', 'memory.db')` | User-home directory, platform-independent |
| **Journal mode** | `WAL` (Write-Ahead Logging) | Enables concurrent reads during writes |
| **Foreign keys** | `ON` | Enforces referential integrity (e.g., message -> conversation cascade deletes) |
| **Busy timeout** | Not explicitly set (better-sqlite3 default: 5000ms) | Time to wait when the database is locked |

The `DATA_DIR` (`~/.morphy/`) is created recursively if it does not exist before
opening the database. The `better-sqlite3` driver creates the database file
automatically on first open.

Connection teardown is handled by `closeDb()`:

```typescript
export function closeDb(): void { db?.close(); }
```

The supervisor owns process shutdown. It imports `closeDb` from `worker/db.js`
and calls it from its `shutdown()` handler in `supervisor/index.ts`, which runs
on both `SIGINT` and `SIGTERM` alongside the rest of the teardown (stopping the
user backend, closing the carrier socket, closing the HTTP server).

### 2.2 Workspace Database (app.db)

The workspace backend opens its own separate SQLite connection:

```typescript
const db = Database(path.join(WORKSPACE, 'app.db'));
db.pragma('journal_mode = WAL');
```

This database lives in the workspace directory (`<pkg>/workspace/app.db`). It
uses WAL mode but does not enable foreign keys. At present, no schema is defined
-- the database file is created and opened, but no tables are created in code.
It is reserved for future workspace-scoped data.
