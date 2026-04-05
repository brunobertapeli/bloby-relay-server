---
title: "Overview"
---

Bloby uses **SQLite** as its embedded relational database, accessed through the
[`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) driver for
Node.js. SQLite was chosen for its zero-configuration, single-file nature, which
aligns with Bloby's self-hosted philosophy -- there is no external database
server to install or manage.

There are two separate SQLite databases in the system:

| Database | File Location | Purpose |
|---|---|---|
| **Primary (memory.db)** | `~/.bloby/memory.db` | Conversations, messages, settings, auth sessions, push subscriptions, trusted devices |
| **Workspace (app.db)** | `<pkg>/workspace/app.db` | Reserved for workspace-scoped backend data (currently schema-less) |

The primary database is the authoritative store for all application state.
The workspace database exists as a secondary, workspace-local SQLite instance
used by the workspace backend Express server.

Source files:

- `worker/db.ts` -- Primary database module (schema, migrations, all CRUD
  functions)
- `workspace/backend/index.ts` -- Workspace database initialization
- `shared/paths.ts` -- Path constants including `paths.db`
