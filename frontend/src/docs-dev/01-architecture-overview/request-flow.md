---
title: "Request Flow"
---

The supervisor is a raw `http.createServer` (no Express) that acts as a reverse proxy. Every HTTP request entering the supervisor port (default 7400, see `shared/config.ts`) is routed based on URL path prefix. The routing logic lives in the request handler in `supervisor/index.ts`.

```plain
                        Incoming HTTP Request
                      (supervisor port, :7400)
                              |
                              v
               +-----------------------------+
               | /bloby/widget.js,           |--YES--> Serve file directly from disk
               | /bloby/app-ws.js, or        |         (supervisor/ directory, no-cache)
               | /bloby/workspace-guard.js ? |
               +-----------------------------+
                              |
                             NO
                              v
               +-----------------------------+
               | /sw.js or /bloby/sw.js ?    |--YES--> Serve embedded SW_JS constant
               +-----------------------------+         (PWA service worker, no-cache)
                              |
                             NO
                              v
               +-----------------------------+
               | /app/api/* ?                |--YES--> Proxy to user BACKEND (:7404)
               +-----------------------------+         Strip /app prefix
                              |                        e.g. /app/api/health -> /health
                             NO
                              v
               +-----------------------------+
               | /api/* ?                    |--YES--> Auth gate (Bearer token unless the
               +-----------------------------+         route is on the pre-login allowlist)
                              |                        Then handled in-process by the
                             NO                        worker Express app (createWorkerApp)
                              v
               +-----------------------------+
               | /bloby or /bloby/* ?        |--YES--> Serve pre-built static files
               +-----------------------------+         from dist-chat/ directory
                              |                        HTML: no-cache
                             NO                        Hashed assets: immutable, 1yr
                              v
               +-----------------------------+
               | Everything else             |-------> Proxy to VITE DEV (:7402)
               +-----------------------------+         Dashboard with HMR
```

Port math: Vite runs on the supervisor port + 2 (7402 by default, `supervisor/vite-dev.ts`) and the user's workspace backend on the supervisor port + 4 (7404, `getBackendPort` in `supervisor/backend.ts`). The worker has no port of its own: `worker/index.ts` exports `createWorkerApp()`, and the supervisor invokes it in-process for `/api/*` requests -- there is no proxy hop.

Two carve-outs worth knowing:

- Some `/api` namespaces are intercepted by the supervisor itself before the worker app sees them: `/api/channels/*` (WhatsApp, Telegram, Alexa), `/api/env`, the scheduler routes (`/api/schedule`, `/api/pulse`, `/api/crons/*`), and `/api/agent/*` (authenticated by a per-process agent secret).
- Top-level document navigations do not go straight to Vite: the supervisor serves an "immortal shell" page (chat bubble + a same-origin iframe), and the iframe re-requests the same URL, which falls through to the Vite proxy. Rebuilds and crash interstitials happen inside the iframe while the chat chrome survives.

### WebSocket Upgrade Routing

WebSocket upgrades are handled separately via the `server.on('upgrade')` handler in `supervisor/index.ts`:

```plain
                     WebSocket Upgrade Request
                              |
                              v
               +-----------------------------+
               | URL starts with /app/ws ?   |--YES--> appWss.handleUpgrade()
               +-----------------------------+         (app API over WebSocket, no auth --
                              |                         the user's backend handles its own)
                             NO
                              v
               +-----------------------------+
               | URL starts with /bloby/ws ? |--YES--> Auth check (token in query param)
               +-----------------------------+         Then blobyWss.handleUpgrade()
                              |                        --> Morphy chat WebSocket handler
                             NO
                              v
               +-----------------------------+
               | Anything else               |-------> Let Vite handle it
               +-----------------------------+         (HMR WebSocket, attached to
                                                        supervisor's server via
                                                        hmr.server option)
```

The Vite HMR WebSocket is special: Vite attaches its own upgrade handler directly to the supervisor's HTTP server via the `hmr: { server }` option in `supervisor/vite-dev.ts`. This means the supervisor does not need to manually proxy HMR upgrades -- Vite's internal handler picks them up automatically when the URL matches neither `/app/ws` nor `/bloby/ws`.

### Auth Middleware

API auth is secure by default: once a portal password is set, **every** `/api/*` route requires a valid Bearer token, regardless of HTTP method. GET data reads (conversations, context, wallet, devices) are gated exactly like mutations.

Auth flow (in `supervisor/index.ts`):

```plain
1. Check if auth is required:   isAuthRequired() -> is a portal password set?
                                 (settings lookup, cached for 30 seconds)
2. If required, extract token:   Authorization: Bearer <token>
3. Validate token:               validateToken() -> session lookup in the local DB
                                 (valid tokens cached for 60 seconds each)
4. If invalid:                   Return 401 { error: 'Unauthorized' }
```

The only exceptions are the pre-login surface, hardcoded in `PUBLIC_PRELOGIN_ROUTES` (plus a few method-specific prefixes in `PUBLIC_PRELOGIN_PREFIXES`): health, onboarding status, portal login and token validation, TOTP, the VAPID public key, channel onboarding, provider OAuth (`POST /api/auth/*`), and handle availability (`GET /api/handle/*`). A new `/api` route is therefore gated by default unless it is explicitly added to the allowlist. Internal supervisor calls into the worker app bypass the gate by carrying a per-process `x-internal` secret.

The `/app/api/*` route has **no auth** -- the user's workspace backend is expected to handle its own authentication if needed.

---
