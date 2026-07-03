---
title: "Backend Stack"
---

### Express v5

| Dependency   | Version   |
| ------------ | --------- |
| **express**  | ^5.2.1    |

Express v5 powers the API layer. `worker/index.ts` exports `createWorkerApp()`, an Express app the supervisor mounts **in-process** and dispatches `/api/*` requests to directly (there is no separate worker process, port, or proxy hop). Key v5 features leveraged:

- Native `async` route handler support (rejected promises auto-forward to error middleware).
- Improved `req.query` parsing.
- `res.json()` and other response methods return proper types.

### SQLite (better-sqlite3)

| Dependency         | Version   |
| ------------------ | --------- |
| **better-sqlite3** | ^12.6.2   |

Database file: `~/.morphy/memory.db`

**Pragmas set at initialization:**

- `journal_mode = WAL` -- Write-Ahead Logging for concurrent reads during writes.
- `foreign_keys = ON` -- Enforced referential integrity.

**Schema (6 tables):**

| Table                | Purpose                                     |
| -------------------- | ------------------------------------------- |
| `conversations`      | Chat conversation metadata + session_id     |
| `messages`           | Chat messages with token counts + audio     |
| `settings`           | Key-value application settings              |
| `sessions`           | Auth session tokens with expiry             |
| `push_subscriptions` | Web Push subscription endpoints             |
| `trusted_devices`    | 2FA trusted device tokens                   |

The database layer is **synchronous** by design -- `better-sqlite3` runs queries on the calling thread with no async overhead, which is ideal for the single-process model (supervisor and API app share one process).

Automatic **migrations** run at startup: the `initDb()` function checks for missing columns (`session_id`, `audio_data`, `attachments`) and adds them via `ALTER TABLE`, ensuring backward compatibility with older databases.

### Web Push

| Dependency   | Version   |
| ------------ | --------- |
| **web-push** | ^3.6.7    |

VAPID key-pair based push notifications. Subscriptions are stored in the `push_subscriptions` table. Push is used to notify users of proactive agent messages, including output from autonomous pulse/cron turns (delivered through `supervisor/outbound.ts`).

### WebSocket

| Dependency | Version   |
| ---------- | --------- |
| **ws**     | ^8.19.0   |

Used in `noServer` mode -- the supervisor's `http.Server` handles the `upgrade` event and routes connections by path: `/bloby/ws` goes to the Morphy chat `WebSocketServer` (`blobyWss`, token-authenticated once a portal password is set), and `/app/ws` goes to a second `WebSocketServer` (`appWss`) for the user's app backend, which handles its own auth. Vite's HMR WebSocket is attached directly to the same HTTP server, so HMR upgrades are handled by Vite itself.

The WebSocket protocol supports:

- `user:message` -- user sends a chat message.
- `user:stop` -- abort an in-flight agent query.
- `user:clear-context` -- clear conversation context.
- `bot:typing`, `bot:token`, `bot:response`, `bot:done`, `bot:error` -- server-to-client streaming.
- `chat:sync` -- broadcast messages to all connected clients (multi-device sync).
- `chat:state` -- reconnection state recovery (current stream buffer).
- `whisper:transcribe` / `whisper:result` -- voice transcription relay.
- `settings:save` / `settings:saved` -- settings persistence over WS.
- `ping` / `pong` -- heartbeat keepalive.

### Authentication

| Dependency   | Version   | Purpose                        |
| ------------ | --------- | ------------------------------ |
| **otpauth**  | ^9.3.6    | TOTP generation and validation |
| **qrcode**   | ^1.5.4    | QR code generation for 2FA    |

Password hashing uses Node's built-in `crypto.scryptSync` (no external dependency). Sessions are stored in SQLite with expiry timestamps. TOTP uses SHA1 algorithm with 6-digit codes and a 30-second period. Recovery codes are generated as 8 random hex strings, stored as SHA-256 hashes.

API auth is **secure by default**: once a portal password is set, every `/api/*` route requires a valid Bearer token. The only exceptions are the pre-login routes explicitly listed in the `PUBLIC_PRELOGIN_ROUTES` allowlist in `supervisor/index.ts` (login, onboarding status, health, non-secret settings). A new `/api` route is therefore gated automatically unless deliberately added to the allowlist.

### Scheduling

| Dependency      | Version   |
| --------------- | --------- |
| **cron-parser** | ^5.5.0    |

The scheduler (`supervisor/scheduler.ts`) runs inside the supervisor, checking every 60 seconds. Two scheduling systems:

1. **Pulse** -- periodic autonomous agent activation with configurable interval and quiet hours. Config in `workspace/PULSE.json`.
2. **Crons** -- standard cron expressions with support for one-shot tasks. Config in `workspace/CRONS.json`. Task details can be stored in `workspace/tasks/{id}.md`.
