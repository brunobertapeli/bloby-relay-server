---
title: "System Overview"
---

Morphy is a **self-hosted, self-evolving AI agent platform**. It runs on the user's own machine (Linux, macOS, Windows, Raspberry Pi), exposes itself to the internet through the built-in Morphy carrier (a single persistent outbound WebSocket from `supervisor/relay-tunnel.ts` to the Morphy edge), and provides a chat interface through which the user can talk to an AI agent that has full read/write access to a workspace it manages.

The core design philosophy:

- **Self-hosted**: The user owns their data. The database, memory files, and workspace live on their machine at `~/.morphy/`. No cloud dependency is required for core functionality.
- **Self-evolving**: The AI agent (Claude via the Agent SDK, Codex, or Pi, selected by a pluggable harness layer) can modify its own workspace -- frontend code, backend code, configuration, memory files. The platform watches for changes and hot-reloads everything.
- **Crash-resilient**: The chat UI survives crashes in every other subsystem. If the dashboard or the workspace backend dies, the user can still talk to the agent and ask it to fix things.
- **Remote-first**: The primary use case is controlling the agent from a phone over the internet while the host machine runs unattended.

The platform is composed of three independent codebases:

| Component        | Location                                    | Role                                                                                                                                          |
| ---------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Morphy Bot**   | This repository                             | Supervisor (with the in-process worker), workspace, chat UI                                                                                    |
| **Morphy Relay** | `api.morphyagent.com` (separate)            | Control plane: accounts, handles, premium domains, and the Ed25519 tickets that authenticate the carrier                                       |
| **Morphy Edge**  | Cloudflare Worker + Durable Objects (separate) | Terminates `<handle>.open.morphyagent.com` (free) and `<handle>.morphyagent.com` (premium) and pipes traffic down the bot's carrier socket to the local supervisor (default port 7400) |

There is no per-request lookup of a stored tunnel URL and no URL rotation: each bot's edge Durable Object is derived from its handle, the bot dials it with one long-lived outbound connection, and "online" simply means the carrier socket is live.

---
