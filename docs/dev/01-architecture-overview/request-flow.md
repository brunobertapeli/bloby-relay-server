---
title: "Request Flow"
---

The supervisor is a raw `http.createServer` (no Express) that acts as a reverse proxy. Every HTTP request entering port 3000 is routed based on URL path prefix. The routing logic lives in `supervisor/index.ts`, starting at line 218.

```plain
                        Incoming HTTP Request
                         (port 3000)
                              |
                              v
               +-----------------------------+
               | /fluxy/widget.js ?          |--YES--> Serve file directly from disk
               +-----------------------------+         (supervisor/widget.js, no-cache)
                              |
                             NO
                              v
               +-----------------------------+
               | /sw.js or /fluxy/sw.js ?    |--YES--> Serve embedded SW_JS constant
               +-----------------------------+         (PWA service worker, no-cache)
                              |
                             NO
                              v
               +-----------------------------+
               | /app/api/* ?                |--YES--> Proxy to BACKEND (:3004)
               +-----------------------------+         Strip /app/api prefix
                              |                        e.g. /app/api/health -> /health
                             NO
                              v
               +-----------------------------+
               | /api/* ?                    |--YES--> Auth check (Bearer token on mutations)
               +-----------------------------+         Then proxy to WORKER (:3001)
                              |                        Path forwarded as-is
                             NO
                              v
               +-----------------------------+
               | /fluxy or /fluxy/* ?        |--YES--> Serve pre-built static files
               +-----------------------------+         from dist-fluxy/ directory
                              |                        HTML: no-cache
                             NO                        Hashed assets: immutable, 1yr
                              v
               +-----------------------------+
               | Everything else             |-------> Proxy to VITE DEV (:3002)
               +-----------------------------+         Dashboard with HMR
```

### WebSocket Upgrade Routing

WebSocket upgrades are handled separately via the `server.on('upgrade')` event (line 634):

```plain
                     WebSocket Upgrade Request
                              |
                              v
               +-----------------------------+
               | URL starts with /fluxy/ws ? |--YES--> Auth check (token in query param)
               +-----------------------------+         Then fluxyWss.handleUpgrade()
                              |                        --> Fluxy chat WebSocket handler
                             NO
                              v
               +-----------------------------+
               | Anything else               |-------> Let Vite handle it
               +-----------------------------+         (HMR WebSocket, attached to
                                                        supervisor's server via
                                                        hmr.server option)
```

The Vite HMR WebSocket is special: Vite attaches its own upgrade handler directly to the supervisor's HTTP server via the `hmr: { server: hmrServer }` option in `supervisor/vite-dev.ts:29`. This means the supervisor does not need to manually proxy HMR upgrades -- Vite's internal handler picks them up automatically when the URL does not match `/fluxy/ws`.

### Auth Middleware

The supervisor enforces authentication on `/api/*` routes for mutation methods (POST, PUT, DELETE). Read-only methods (GET, HEAD) pass through without auth.

Auth flow (line 271-284 of `supervisor/index.ts`):

```plain
1. Check if auth is required:   GET /api/onboard/status -> { portalConfigured: bool }
                                 (cached for 30 seconds)
2. If required, extract token:   Authorization: Bearer <token>
3. Validate token:               POST /api/portal/validate-token -> { valid: bool }
                                 (cached for 60 seconds per token)
4. If invalid:                   Return 401 { error: 'Unauthorized' }
```

Exempt routes are hardcoded in `AUTH_EXEMPT_ROUTES` (line 185-207): login, onboard, health, push, OAuth endpoints, TOTP, and device management.

The `/app/api/*` route has **no auth** -- the user's workspace backend is expected to handle its own authentication if needed.

---
