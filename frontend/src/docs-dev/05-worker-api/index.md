---
title: "Worker API"
---

The Worker is the data and settings layer of Morphy. It is an Express.js
application created by `createWorkerApp()` in `worker/index.ts` and mounted
in-process by the supervisor: there is no separate worker process, no
dedicated port, and no proxy hop. Every piece of persistent state --
conversations, messages, settings, sessions, push subscriptions, trusted
devices, and OAuth credentials -- flows through the Worker. The supervisor
(default port `7400`, from `shared/config.ts`) dispatches `/api/*` requests
directly to the Worker app, so the dashboard and external clients interact
with a single origin.

Source files covered by this document:

| File | Role |
|---|---|
| `worker/index.ts` | Express application (`createWorkerApp()`), route definitions, helpers |
| `worker/db.ts` | SQLite database layer (better-sqlite3) |
| `worker/claude-auth.ts` | Anthropic / Claude OAuth PKCE flow |
| `worker/codex-auth.ts` | OpenAI / Codex OAuth (PKCE paste-back and device-code flows) |
