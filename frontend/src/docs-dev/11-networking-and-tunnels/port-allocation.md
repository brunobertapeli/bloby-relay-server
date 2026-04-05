---
title: "Port Allocation"
---

All ports are derived from a single configurable **base port** stored in `shared/config.ts` as `BotConfig.port`. The default is `3000`.

| Service        | Port Formula    | Default | Description                                 |
|----------------|-----------------|---------|---------------------------------------------|
| Supervisor     | `base`          | 3000    | HTTP server, reverse proxy, WebSocket host  |
| Worker         | `base + 1`      | 3001    | Database, settings, AI provider endpoints   |
| Vite Dashboard | `base + 2`      | 3002    | Vite dev server for `workspace/client/`     |
| Backend        | `base + 4`      | 3004    | User's application backend (Express/etc.)   |

Port 3003 (`base + 3`) is currently unassigned (reserved for future use).

### Port computation in code

The port offsets are computed by helper functions in the respective service modules:

- **`supervisor/worker.ts`** -- `getWorkerPort(basePort)` returns `basePort + 1`
- **`supervisor/backend.ts`** -- `getBackendPort(basePort)` returns `basePort + 4`
- **`supervisor/vite-dev.ts`** -- `startViteDevServers(supervisorPort, hmrServer)` computes `supervisorPort + 2` inline

At startup, `supervisor/index.ts` reads the config and derives the ports:

```ts
const config = loadConfig();
const workerPort = getWorkerPort(config.port);   // 3001
const backendPort = getBackendPort(config.port);  // 3004
```

### Configuring the base port

The base port is stored in `~/.bloby/config.json` (the path resolved by `shared/paths.ts`). The config file is loaded by `loadConfig()` and written by `saveConfig()` in `shared/config.ts`. The default value in the `DEFAULTS` constant is `3000`:

```ts
const DEFAULTS: BotConfig = {
  port: 3000,
  // ...
};
```

If port `3000` is already in use, the supervisor catches the `EADDRINUSE` error and exits with a message directing the user to change the port in the config file.
