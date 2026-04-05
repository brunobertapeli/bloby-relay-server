---
title: "Architecture"
---

## 1. Authentication Architecture Overview

Bloby implements a multi-layer authentication architecture spanning three processes:

| Layer | Process | Responsibility |
|---|---|---|
| **Password verification and session creation** | Worker (`worker/index.ts`) | Hashes passwords, issues session tokens, manages TOTP, stores sessions in SQLite |
| **Request gating and proxy auth** | Supervisor (`supervisor/index.ts`) | Intercepts HTTP and WebSocket requests, validates tokens against the worker, enforces auth on protected routes |
| **Client-side token management** | Chat UI (`supervisor/chat/src/lib/auth.ts`) | Stores session tokens in `localStorage`, attaches `Bearer` tokens to requests, handles 401 responses |

The supervisor acts as a reverse proxy: all external traffic hits the supervisor first, which performs authentication checks before proxying requests to the internal worker process on `127.0.0.1`. The worker never receives unauthenticated mutation requests in a properly configured deployment.

Authentication is **conditional**. If no portal password has been set during onboarding (the `portal_pass` setting is absent), all routes are open. Once a password is configured, mutation routes require a valid session token.
