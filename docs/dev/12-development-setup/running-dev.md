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
   watching. When any `.ts` file in `supervisor/` or `shared/` changes, `tsx`
   automatically restarts the process. The supervisor in turn spawns:
   - The **worker** process (port `basePort + 1`, default `3001`) -- handles API
     routes, database, auth, onboarding.
   - The **user backend** process (port `basePort + 4`, default `3004`) -- runs
     the user's custom Express app from `workspace/backend/index.ts`.
   - An embedded **Vite dev server** for the dashboard (port `basePort + 2`,
     default `3002`) -- this is started programmatically by
     `supervisor/vite-dev.ts`, not the standalone `vite` command.

2. **`vite`** -- Starts Vite using the default `vite.config.ts` (dashboard). In
   practice, the supervisor already starts its own Vite dev server
   programmatically, so this standalone Vite process provides an additional dev
   server. The supervisor's embedded Vite is the one that handles the actual
   proxying.

### Port layout

When the base port is `3000` (the default):

| Port | Process | Purpose |
|------|---------|---------|
| `3000` | Supervisor HTTP server | Main entry point. Proxies everything. |
| `3001` | Worker (`worker/index.ts`) | API routes (`/api/*`), database, auth |
| `3002` | Vite dev server (dashboard) | Dashboard HMR, serves `workspace/client/` |
| `3004` | User backend (`workspace/backend/index.ts`) | User's custom API (`/app/api/*`) |
| `5173` | Standalone Vite (from `npm run dev`) | Second dashboard dev server (from `vite.config.ts`) |

You access everything through **`http://localhost:3000`**. The supervisor
reverse-proxies to the correct backend:

- `/api/*` --> Worker on `:3001`
- `/app/api/*` --> User backend on `:3004` (path rewritten: `/app/api/foo` --> `/foo`)
- `/fluxy/*` --> Serves pre-built static files from `dist-fluxy/`
- Everything else --> Dashboard Vite dev server on `:3002`

### Hot reloading behavior

#### Dashboard UI (Vite HMR)

The dashboard lives in `workspace/client/`. Its Vite dev server runs on port
`3002` with HMR WebSocket attached directly to the supervisor's HTTP server
(port `3000`). This means:

- Edits to `.tsx`, `.ts`, `.css` files in `workspace/client/src/` are
  reflected instantly in the browser -- no full page reload needed.
- The HMR WebSocket connection goes through port `3000` (the page's origin), so
  it works both locally and through tunnels. This is configured in
  `supervisor/vite-dev.ts`:

```typescript
hmr: { server: hmrServer },  // hmrServer = supervisor's HTTP server
```

#### Supervisor (tsx watch)

When `tsx watch` detects a change in `supervisor/*.ts` or `shared/*.ts`, it
kills and restarts the entire supervisor process. This means:

- The worker and user backend are also restarted.
- WebSocket connections are dropped and must reconnect.
- Vite dev servers are stopped and recreated.
- The restart takes 2-5 seconds.

#### Worker

The worker (`worker/index.ts`) is spawned as a child process by the supervisor.
It is **not watched independently** -- it restarts when the supervisor restarts.
If you change only `worker/*.ts` files, you need to trigger a supervisor restart
(save any `supervisor/*.ts` file, or restart manually).

#### User backend

The user backend (`workspace/backend/index.ts`) **is independently watched** by
the supervisor. A file system watcher on `workspace/backend/` detects changes to
`.ts`, `.js`, and `.json` files and restarts only the backend process (with a 1s
debounce). Changes to `workspace/.env` also trigger a backend restart.

#### Chat UI

The chat UI (`supervisor/chat/`) is served as **pre-built static files** from
`dist-fluxy/`. During normal development, changes require a rebuild:

```bash
npm run build:fluxy
```

Alternatively, you can run the chat UI in Vite dev mode using its dedicated
config:

```bash
npx vite --config vite.fluxy.config.ts
```

This starts a dev server for the chat UI with HMR. The chat UI root is
`supervisor/chat/` and it builds two HTML entry points: `fluxy.html` and
`onboard.html`.

---
