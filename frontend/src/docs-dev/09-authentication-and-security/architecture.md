---
title: "Architecture"
---

## 1. Authentication Architecture Overview

Morphy implements a multi-layer authentication architecture spanning three layers:

| Layer | Code | Responsibility |
|---|---|---|
| **Password verification and session creation** | Worker app (`worker/index.ts`) | Hashes passwords (scrypt), issues session tokens, manages TOTP, stores sessions in SQLite |
| **Request gating** | Supervisor (`supervisor/index.ts`) | Intercepts HTTP and WebSocket requests, validates `Bearer` tokens against the session store, enforces the public-route allowlist |
| **Client-side token management** | Chat UI (`supervisor/chat/src/lib/auth.ts`) | Stores session tokens in `localStorage`, attaches `Bearer` tokens to requests, handles 401 responses |

The supervisor owns the single listening HTTP server: all external traffic hits the supervisor first, which performs authentication checks before handing `/api/*` requests to the worker's Express app. That app is created in-process by `createWorkerApp()` (`worker/index.ts`) and invoked directly, so there is no separate worker process and no proxy hop. The supervisor validates tokens by reading the shared SQLite session store directly (`getSession` in `worker/db.ts`), with a short-lived in-memory token cache. Internal supervisor-to-worker calls carry a per-process `x-internal` secret and bypass the gate.

Authentication is **conditional, but secure by default once enabled**. If no portal password has been set during onboarding (the `portal_pass` setting is absent), all routes are open. Once a password is configured, every `/api` route, including GET reads, requires a valid session token, except a small pre-login allowlist (`PUBLIC_PRELOGIN_ROUTES` and `PUBLIC_PRELOGIN_PREFIXES` in `supervisor/index.ts`) covering login, onboarding status, health, and provider OAuth setup. A newly added `/api` route is therefore gated by default.
