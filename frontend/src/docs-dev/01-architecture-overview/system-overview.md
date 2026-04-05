---
title: "System Overview"
---

Bloby is a **self-hosted, self-evolving AI agent platform**. It runs on the user's own machine (Linux, macOS, Windows, Raspberry Pi), exposes itself to the internet via Cloudflare Tunnel, and provides a chat interface through which the user can talk to an AI agent that has full read/write access to a workspace it manages.

The core design philosophy:

- **Self-hosted**: The user owns their data. The database, memory files, and workspace live on their machine at `~/.bloby/`. No cloud dependency is required for core functionality.
- **Self-evolving**: The AI agent (Claude via the Agent SDK) can modify its own workspace -- frontend code, backend code, configuration, memory files. The platform watches for changes and hot-reloads everything.
- **Crash-resilient**: The chat UI survives crashes in every other subsystem. If the dashboard, backend, or worker dies, the user can still talk to Claude and ask it to fix things.
- **Remote-first**: The primary use case is controlling the agent from a phone over the internet while the host machine runs unattended.

The platform is composed of three independent codebases:

| Component             | Location                   | Role                                                                         |
| --------------------- | -------------------------- | ---------------------------------------------------------------------------- |
| **Bloby Bot**         | This repository            | Supervisor, worker, workspace, chat UI                                       |
| **Bloby Relay**       | `api.bloby.bot` (separate) | Optional cloud proxy that maps `username.bloby.bot` to the user's tunnel URL |
| **Cloudflare Tunnel** | `cloudflared` binary       | Exposes `localhost:3000` to the internet                                     |

---
