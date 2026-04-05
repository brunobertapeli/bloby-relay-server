---
title: "Architecture Rules"
---

These rules exist to maintain process isolation, crash safety, and deployment consistency. Violating them will break the system in subtle ways.

### Do NOT put database logic in the supervisor

The supervisor does not import `better-sqlite3`. It does not open any database file. All database access goes through HTTP requests to the worker at `localhost:{basePort+1}`. This ensures the worker is the single source of truth and can be restarted independently.

```typescript
// WRONG -- in supervisor code
import Database from 'better-sqlite3';
const db = new Database('~/.bloby/memory.db');

// RIGHT -- in supervisor code
const res = await fetch(`http://127.0.0.1:${workerPort}/api/conversations`);
const data = await res.json();
```

### Do NOT make the chat UI depend on the Vite dev server

The chat SPA is served from `dist-bloby/` (pre-built static files). It must work without a running Vite dev server. This is why the chat has its own Vite config (`vite.bloby.config.ts`) and builds to a separate output directory.

If you reference a dependency that is only available during `npm run dev`, the chat will break in production.

### Do NOT break the process isolation model

Each process (supervisor, worker, backend, tunnel) runs as a separate OS process. They communicate via HTTP and WebSocket. Do not:

- Share in-memory state between processes (use the API)
- Import worker modules into the supervisor (use HTTP calls)
- Import supervisor modules into the worker (they are separate processes)

`shared/` modules are the only exception -- they are stateless utilities used by both.

### Do NOT hardcode ports

Every port is derived from the base port (default 3000) or read from an environment variable:

```typescript
// WRONG
const WORKER_URL = 'http://localhost:3001';

// RIGHT
const workerPort = getWorkerPort(config.port);  // config.port + 1
const WORKER_URL = `http://127.0.0.1:${workerPort}`;
```

This allows multiple Bloby instances on the same machine with different base ports.

### Do NOT modify `dist-bloby/` directly

The `dist-bloby/` directory contains build artifacts generated from `supervisor/chat/`. Any manual edits will be overwritten on the next build.

To change the chat UI:

1. Edit source files in `supervisor/chat/`
2. Run `npm run build:bloby`
3. Commit both the source changes and the updated `dist-bloby/`

### Do NOT add process-specific code to `shared/`

The `shared/` directory is for truly cross-cutting utilities: configuration loading, path resolution, logging, and provider abstractions. If your code only runs in one process, put it in that process's directory.

```typescript
// WRONG -- shared/websocket-handler.ts (only the supervisor has a WS server)
// WRONG -- shared/express-middleware.ts (only the worker uses Express middleware)

// RIGHT -- supervisor/ws-handler.ts
// RIGHT -- worker/auth-middleware.ts
```
