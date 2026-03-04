---
title: "Glossary"
---

| Term             | Definition                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Supervisor**   | The master process that runs on the base port. Manages all child processes, serves the chat UI, and acts as a reverse proxy. |
| **Worker**       | Child process running an Express API server with SQLite. Owns all platform data.                                             |
| **Backend**      | Child process running the user's custom Express server from `workspace/backend/`. Agent-modifiable.                          |
| **Quick Tunnel** | Zero-config Cloudflare tunnel with a random ephemeral URL.                                                                   |
| **Named Tunnel** | Persistent Cloudflare tunnel with the user's own domain.                                                                     |
| **Relay**        | Optional cloud service (`api.fluxy.bot`) that maps stable domains to ephemeral tunnel URLs.                                  |
| **PULSE**        | Periodic agent wake-up. Fires at a configured interval, suppressed during quiet hours.                                       |
| **CRON**         | Scheduled agent task. Fires on a cron schedule. One-shot crons auto-delete after firing.                                     |
| **Agent SDK**    | `@anthropic-ai/claude-agent-sdk` -- runs Claude with full tool access (Read, Write, Edit, Bash, etc.).                       |
| **dist-fluxy/**  | Pre-built chat SPA served as static files. Survives all other crashes.                                                       |
| **Widget**       | Vanilla JS (`supervisor/widget.js`) that injects the chat bubble and slide-out panel into the dashboard.                     |
