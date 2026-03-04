---
title: "Backend Stack"
---

### Express v5

| Dependency   | Version   |
| ------------ | --------- |
| **express**  | ^5.2.1    |

Express v5 is used in the **worker** process, not in the supervisor. Key v5 features leveraged:

- Native `async` route handler support (rejected promises auto-forward to error middleware).
- Improved `req.query` parsing.
- `res.json()` and other response methods return proper types.

### SQLite (better-sqlite3)

| Dependency         | Version   |
| ------------------ | --------- |
| **better-sqlite3** | ^12.6.2   |

Database file: `~/.fluxy/memory.db`

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

The database layer is **synchronous** by design -- `better-sqlite3` runs queries on the calling thread with no async overhead, which is ideal for the single-process worker model.

Automatic **migrations** run at startup: the `initDb()` function checks for missing columns (`session_id`, `audio_data`, `attachments`) and adds them via `ALTER TABLE`, ensuring backward compatibility with older databases.

### Web Push

| Dependency   | Version   |
| ------------ | --------- |
| **web-push** | ^3.6.7    |

VAPID key-pair based push notifications. Subscriptions are stored in the `push_subscriptions` table. Push is used by the scheduler to notify users when the agent completes autonomous tasks (pulse/cron).

### WebSocket

| Dependency | Version   |
| ---------- | --------- |
| **ws**     | ^8.19.0   |

Used in `noServer` mode -- the supervisor's `http.Server` handles the `upgrade` event and routes `/fluxy/ws` connections to the `WebSocketServer`. All other upgrade requests pass through to Vite's HMR WebSocket handler.

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

Auth-exempt routes are explicitly listed in `AUTH_EXEMPT_ROUTES` and checked by the supervisor before proxying to the worker.

### Scheduling

| Dependency      | Version   |
| --------------- | --------- |
| **cron-parser** | ^5.5.0    |

The scheduler runs inside the supervisor (not the worker), checking every 60 seconds. Two scheduling systems:

1. **Pulse** -- periodic autonomous agent activation with configurable interval and quiet hours. Config in `workspace/PULSE.json`.
2. **Crons** -- standard cron expressions with support for one-shot tasks. Config in `workspace/CRONS.json`. Task details can be stored in `workspace/tasks/{id}.md`.
