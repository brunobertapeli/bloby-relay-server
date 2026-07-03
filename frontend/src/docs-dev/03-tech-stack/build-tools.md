---
title: "Build Tools"
---

### Vite (Dual Configuration)

| Dependency | Version   |
| ---------- | --------- |
| **vite**   | ^8.0.3    |

Two independent Vite configurations:

| Config                    | Root               | Output         | Base    | Entry points              |
| ------------------------- | ------------------ | -------------- | ------- | ------------------------- |
| `vite.config.ts`          | `workspace/client` | `dist/`        | `/`     | `src/main.tsx`            |
| `vite.chat.config.ts`    | `supervisor/chat`  | `dist-chat/`  | `/bloby/` | `chat.html`, `onboard.html` |

The `build` script runs both sequentially:

```
vite build && vite build --config vite.chat.config.ts
```

In development, only the dashboard Vite server runs as a dev server. The supervisor starts it (`supervisor/vite-dev.ts`) on supervisor port + 2 (7402 with the default base port 7400), with the HMR WebSocket attached directly to the supervisor's HTTP server so the browser connects on the same origin, locally or through Morphy Relay. The Morphy chat UI is pre-built and served as static files from `dist-chat/`.

### Dev Server Proxy Configuration

The dashboard Vite dev server proxies API requests:

- `/app/api` -> `http://localhost:7404` (user's backend, with path rewrite).
- `/api` -> `http://localhost:7400` (the supervisor, which serves the API app in-process).

File watcher ignores are configured to prevent Vite from triggering unnecessary rebuilds on database, log, and environment file changes.

### TSX

| Dependency | Version   |
| ---------- | --------- |
| **tsx**    | ^4.21.0   |

TypeScript execution without a build step. Used in two modes:

- **`tsx watch`** -- file-watching mode for development (`dev` script).
- **`node --import tsx/esm`** -- ESM loader registration for production (`start` script).

### Concurrently

| Dependency       | Version   |
| ---------------- | --------- |
| **concurrently** | ^9.2.1    |

Runs the supervisor (via `tsx watch`) and the Vite dev server in parallel during development:

```
concurrently "tsx watch supervisor/index.ts" "vite"
```

### PWA Support

No build-time PWA plugin is used. The web app manifest is a static file (`supervisor/public/manifest.json`) served by the supervisor, and the service worker is embedded as a string constant (`SW_JS` in `supervisor/index.ts`) served at `/sw.js` and `/bloby/sw.js`. It handles app-shell caching (cache-first for hashed assets, network-first for navigations and modules), push notifications, and installability. Embedding it in the supervisor means it always ships in sync with the server code, with no separate build artifact to update.
