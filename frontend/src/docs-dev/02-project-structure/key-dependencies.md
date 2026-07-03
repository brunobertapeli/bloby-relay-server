---
title: "Key Dependencies"
---

| Dependency                                           | Purpose                                                              |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| `@anthropic-ai/claude-agent-sdk`                     | Claude Agent SDK for agentic AI queries (Anthropic harness)          |
| `@anthropic-ai/sdk` / `@modelcontextprotocol/sdk`    | Peer dependencies of the Agent SDK, declared directly for stable npm resolution |
| `@openai/codex`                                      | Codex app-server binary (OpenAI harness)                             |
| `express`                                            | HTTP server framework (in-process worker API + user backend)         |
| `better-sqlite3`                                     | SQLite database driver (conversations, settings, sessions)           |
| `ws`                                                 | WebSocket library (chat sockets + the persistent Morphy Relay carrier connection) |
| `tsx`                                                | TypeScript execution (runs `.ts` files directly without compilation) |
| `vite`                                               | Build tool and dev server (dashboard + chat SPA)                     |
| `react` / `react-dom`                                | UI framework (dashboard + chat SPA)                                  |
| `react-router`                                       | Client-side routing (dashboard)                                      |
| `tailwindcss` / `@tailwindcss/vite`                  | Utility-first CSS framework                                          |
| `radix-ui`                                           | Headless UI primitives (via shadcn/ui components)                    |
| `lucide-react`                                       | Icon set (dashboard + chat SPA)                                      |
| `framer-motion`                                      | Animation library (chat transitions, loading states)                 |
| `recharts`                                           | Charting library (dashboard visualizations)                          |
| `zustand`                                            | State management (available to workspace client apps)                |
| `streamdown` / `@streamdown/code`                    | Markdown rendering + code highlighting in chat messages              |
| `@whiskeysockets/baileys`                            | WhatsApp channel integration                                         |
| `web-push`                                           | Web Push notifications (server-side)                                 |
| `otpauth` / `qrcode`                                 | TOTP 2FA (generation + QR code display)                              |
| `cron-parser`                                        | Cron expression parsing (scheduler)                                  |
| `date-fns`                                           | Date utility functions                                               |
| `sonner`                                             | Toast notifications (dashboard)                                      |
| `viem`                                               | Onchain wallet client (USDC balance checks, x402 payments)           |
| `concurrently`                                       | Run multiple processes in parallel (dev script)                      |
