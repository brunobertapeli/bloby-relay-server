---
title: "Build Tools"
---

### Vite (Dual Configuration)

| Dependency | Version   |
| ---------- | --------- |
| **vite**   | ^7.3.1    |

Two independent Vite configurations:

| Config                    | Root               | Output         | Base    | Entry points              |
| ------------------------- | ------------------ | -------------- | ------- | ------------------------- |
| `vite.config.ts`          | `workspace/client` | `dist/`        | `/`     | `src/main.tsx`            |
| `vite.fluxy.config.ts`    | `supervisor/chat`  | `dist-fluxy/`  | `/fluxy/` | `fluxy.html`, `onboard.html` |

The `build` script runs both sequentially:

```
vite build && vite build --config vite.fluxy.config.ts
```

In development, only the dashboard Vite server runs as a dev server (with HMR attached to the supervisor's HTTP server). The Fluxy chat UI is pre-built and served as static files.

### Dev Server Proxy Configuration

The dashboard Vite dev server proxies API requests:

- `/app/api` -> `http://localhost:3004` (user's backend, with path rewrite).
- `/api` -> `http://localhost:3000` (worker API).

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

| Dependency         | Version   |
| ------------------ | --------- |
| **vite-plugin-pwa** | ^1.2.0   |

Listed as a dependency for Progressive Web App manifest generation. The service worker itself is embedded as a string constant in the supervisor and served directly, handling push notifications and installability.
