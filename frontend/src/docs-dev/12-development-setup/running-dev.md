---
title: "Running in Dev Mode"
---

## 3. Running in Development

### Start the dev server

```bash
npm run dev
```

This runs (via `concurrently`):

```
concurrently "tsx watch supervisor/index.ts" "vite"
```

Two processes start in parallel:

1. **`tsx watch supervisor/index.ts`** -- Starts the supervisor with file
   watching. When any `.ts` file in the supervisor's import graph changes
   (`supervisor/`, `worker/`, `shared/`), `tsx` automatically restarts the
   process. The supervisor then:
   - Mounts the **worker** Express app in-process (`createWorkerApp()` from
     `worker/index.ts`) -- handles API routes, database, auth, onboarding.
     There is no separate worker process or port.
   - Spawns the **user backend** process (port `basePort + 4`, default `7404`)
     -- runs the user's custom Express app from `workspace/backend/index.ts`.
   - Starts an embedded **Vite dev server** for the dashboard (port
     `basePort + 2`, default `7402`) -- this is started programmatically by
     `supervisor/vite-dev.ts`, not the standalone `vite` command.

2. **`vite`** -- Starts Vite using the default `vite.config.ts` (dashboard). In
   practice, the supervisor already starts its own Vite dev server
   programmatically, so this standalone Vite process (port `5173`) is just an
   additional dev server; its `/api` and `/app/api` requests proxy back to the
   supervisor and user backend. The supervisor's embedded Vite is the one
   behind `http://localhost:7400`.

### Port layout

When the base port is `7400` (the default, from `shared/config.ts`):

| Port | Process | Purpose |
|------|---------|---------|
| `7400` | Supervisor HTTP server | Main entry point. Handles `/api/*` in-process, proxies the rest. |
| `7402` | Vite dev server (dashboard) | Dashboard HMR, serves `workspace/client/` |
| `7404` | User backend (`workspace/backend/index.ts`) | User's custom API (`/app/api/*`) |
| `5173` | Standalone Vite (from `npm run dev`) | Second dashboard dev server (from `vite.config.ts`) |

You access everything through **`http://localhost:7400`**. The supervisor
routes each request to the correct handler:

- `/api/*` --> Worker Express app, mounted in-process (no proxy hop)
- `/app/api/*` --> User backend on `:7404` (path rewritten: `/app/api/foo` --> `/api/foo`)
- `/bloby/*` --> Serves pre-built static files from `dist-chat/`
- Everything else --> Dashboard Vite dev server on `:7402`

### Hot reloading behavior

#### Dashboard UI (Vite HMR)

The dashboard lives in `workspace/client/`. Its Vite dev server runs on port
`7402` with HMR WebSocket attached directly to the supervisor's HTTP server
(port `7400`). This means:

- Edits to `.tsx`, `.ts`, `.css` files in `workspace/client/src/` are
  reflected instantly in the browser -- no full page reload needed.
- The HMR WebSocket connection goes through port `7400` (the page's origin), so
  it works both locally and through the Morphy relay. This is configured in
  `supervisor/vite-dev.ts`:

```typescript
hmr: { server: hmrServer },  // hmrServer = supervisor's HTTP server
```

#### Supervisor (tsx watch)

When `tsx watch` detects a change in any imported `.ts` file (`supervisor/`,
`worker/`, or `shared/`), it kills and restarts the entire supervisor process.
This means:

- The user backend child process is also restarted.
- WebSocket connections are dropped and must reconnect.
- The Vite dev server is stopped and recreated.
- The restart takes 2-5 seconds.

#### Worker

The worker (`worker/index.ts`) is **not a separate process**: the supervisor
mounts its Express app in-process via `createWorkerApp()`. Because worker
files are part of the supervisor's import graph, `tsx watch` picks up changes
to `worker/*.ts` and restarts the supervisor automatically -- no manual
trigger needed.

#### User backend

The user backend (`workspace/backend/index.ts`) **is independently watched** by
the supervisor. A file system watcher on `workspace/backend/` detects changes to
`.ts`, `.js`, and `.json` files and restarts only the backend process (with a 1s
debounce). Changes to `workspace/.env`, `package.json`, or `package-lock.json`
also trigger a backend restart. Restarts are deferred while an agent turn is in
flight and flushed when the turn completes.

#### Chat UI

The chat UI (`supervisor/chat/`) is served as **pre-built static files** from
`dist-chat/`. During normal development, changes require a rebuild:

```bash
npm run build:chat
```

Alternatively, you can run the chat UI in Vite dev mode using its dedicated
config:

```bash
npx vite --config vite.chat.config.ts
```

This starts a dev server for the chat UI with HMR. The chat UI root is
`supervisor/chat/` and it builds two HTML entry points: `chat.html` and
`onboard.html`.

---
