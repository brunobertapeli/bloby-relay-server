---
title: "Workspace Database"
---

The workspace backend (`workspace/backend/index.ts`) maintains a separate
SQLite database at `<pkg>/workspace/app.db`.

```typescript
const db = Database(path.join(WORKSPACE, 'app.db'));
db.pragma('journal_mode = WAL');
```

### Current State

- **Schema:** No tables are defined. The database file is created and opened
  with WAL mode, but no `CREATE TABLE` or schema DDL is executed.
- **Purpose:** Reserved for workspace-scoped data that is local to the deployed
  package rather than the user's home directory. The workspace backend currently
  serves only a health check endpoint (`/health`).
- **Separation rationale:** The primary `memory.db` lives in `~/.bloby/` and
  persists across package updates/reinstalls. The workspace `app.db` lives
  inside the package directory and may be recreated on redeploy.

### Configuration Differences from Primary Database

| Aspect | Primary (memory.db) | Workspace (app.db) |
|---|---|---|
| Path | `~/.bloby/memory.db` | `<pkg>/workspace/app.db` |
| Journal mode | WAL | WAL |
| Foreign keys | ON | Not explicitly set (SQLite default: OFF) |
| Schema | 6 tables + indexes | None (empty) |
| Lifecycle | Singleton, opened by `initDb()`, closed by `closeDb()` | Module-level, opened on import |
