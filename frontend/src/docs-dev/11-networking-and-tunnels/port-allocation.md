---
title: "Port Allocation"
---

All ports are derived from a single configurable **base port** stored in `shared/config.ts` as `BotConfig.port`. The default is `7400`.

| Service        | Port Formula    | Default | Description                                 |
|----------------|-----------------|---------|---------------------------------------------|
| Supervisor     | `base`          | 7400    | HTTP server, reverse proxy, WebSocket host  |
| Vite Dashboard | `base + 2`      | 7402    | Vite dev server for `workspace/client/`     |
| Backend        | `base + 4`      | 7404    | User's application backend (Express/etc.)   |

The worker has no port of its own: it runs in-process inside the supervisor (`createWorkerApp()` in `worker/index.ts`, mounted by `supervisor/index.ts`), so `/api/*` requests never cross a socket. Ports `base + 1` and `base + 3` are currently unassigned.

### Port computation in code

The port offsets are computed in the respective service modules:

- **`supervisor/backend.ts`** -- `getBackendPort(basePort)` returns `basePort + 4`
- **`supervisor/vite-dev.ts`** -- `startViteDevServers(supervisorPort, hmrServer)` computes `supervisorPort + 2` inline

At startup, `supervisor/index.ts` reads the config and derives the backend port:

```ts
const config = loadConfig();
const backendPort = getBackendPort(config.port); // 7404
```

### Configuring the base port

The base port is stored in `~/.morphy/config.json` (the path resolved by `shared/paths.ts`). The config file is loaded by `loadConfig()` and written by `saveConfig()` in `shared/config.ts`. The default value in the `DEFAULTS` constant is `7400`:

```ts
const DEFAULTS: BotConfig = {
  port: 7400,
  // ...
};
```

If port `7400` is already in use, the supervisor catches the `EADDRINUSE` error and exits with a message directing the user to change the port in the config file.
