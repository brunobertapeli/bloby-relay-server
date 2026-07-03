---
title: "Glossary"
---

| Term               | Definition                                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Supervisor**     | The master process that runs on the base port (default 7400). Serves the chat UI, proxies the dashboard and user backend, and hosts everything else in-process.      |
| **Worker**         | In-process Express app (`worker/index.ts:createWorkerApp()`) mounted by the supervisor. Owns all platform data in SQLite. No separate process, no separate port.      |
| **Backend**        | Child process running the user's custom Express server from `workspace/backend/`. Agent-modifiable. The supervisor's only child process.                             |
| **Carrier**        | The tunnel (`tunnel.mode: 'relay'`): one persistent outbound WSS from `supervisor/relay-tunnel.ts` (`RelayTunnel`) to the bot's Durable Object. Presence = live socket. |
| **Edge Worker**    | Cloudflare Worker + per-bot Durable Object that terminates browser traffic on the bot's stable URL and muxes HTTP + WebSockets down the carrier.                      |
| **Ed25519 ticket** | Short-lived signed token minted by the relay to authenticate the carrier handshake. The edge verifies it with the public key only; it never holds a minting secret.   |
| **Relay**          | Cloud control plane (`api.morphyagent.com`): handles, auth, tickets, billing, presence. Not in the data path. Stable URLs: `<handle>.open.morphyagent.com` (free), `<handle>.morphyagent.com` (premium). |
| **PULSE**          | Periodic agent wake-up. Fires at a configured interval, suppressed during quiet hours.                                                                                |
| **CRON**           | Scheduled agent task. Fires on a cron schedule. One-shot crons auto-delete after firing.                                                                              |
| **Harness**        | Provider-specific agent runtime behind the `supervisor/bloby-agent.ts` dispatcher: Claude Agent SDK (`anthropic`), Codex app-server (`openai`), or Pi.                |
| **Agent SDK**      | `@anthropic-ai/claude-agent-sdk` -- runs Claude with full tool access (Read, Write, Edit, Bash, etc.) inside the Claude harness.                                      |
| **dist-chat/**     | Pre-built chat SPA served as static files. Survives all other crashes.                                                                                                |
| **Widget**         | Vanilla JS (`supervisor/widget.js`) that injects the chat bubble and slide-out panel into the dashboard.                                                              |
