---
title: "Worker API"
---

The Worker is the data and settings layer of Bloby. It is an Express.js HTTP
server that listens on port `3001` (configurable via the `WORKER_PORT`
environment variable). Every piece of persistent state -- conversations,
messages, settings, sessions, push subscriptions, trusted devices, and OAuth
credentials -- flows through the Worker. The supervisor process on port 3000
proxies `/api/*` requests to the Worker so that the dashboard and external
clients interact with a single origin.

Source files covered by this document:

| File | Role |
|---|---|
| `worker/index.ts` | Express application, route definitions, helpers |
| `worker/db.ts` | SQLite database layer (better-sqlite3) |
| `worker/claude-auth.ts` | Anthropic / Claude OAuth PKCE flow |
| `worker/codex-auth.ts` | OpenAI / Codex OAuth PKCE flow |
