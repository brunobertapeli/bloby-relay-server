---
title: "Key Dependencies"
---

| Dependency                                           | Purpose                                                              |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| `@anthropic-ai/claude-agent-sdk`                     | Claude Agent SDK for agentic AI queries                              |
| `express`                                            | HTTP server framework (worker + user backend)                        |
| `better-sqlite3`                                     | SQLite database driver (conversations, settings, sessions)           |
| `ws`                                                 | WebSocket library (real-time chat communication)                     |
| `tsx`                                                | TypeScript execution (runs `.ts` files directly without compilation) |
| `vite`                                               | Build tool and dev server (dashboard + chat SPA)                     |
| `react` / `react-dom`                                | UI framework (dashboard + chat SPA)                                  |
| `tailwindcss` / `@tailwindcss/vite`                  | Utility-first CSS framework                                          |
| `radix-ui`                                           | Headless UI primitives (via shadcn/ui components)                    |
| `framer-motion`                                      | Animation library (chat transitions, loading states)                 |
| `recharts`                                           | Charting library (dashboard visualizations)                          |
| `zustand`                                            | State management (client-side stores)                                |
| `react-markdown` / `remark-gfm`                      | Markdown rendering in chat messages                                  |
| `react-syntax-highlighter`                           | Code syntax highlighting in chat messages                            |
| `web-push`                                           | Web Push notifications (server-side)                                 |
| `otpauth` / `qrcode`                                 | TOTP 2FA (generation + QR code display)                              |
| `cron-parser`                                        | Cron expression parsing (scheduler)                                  |
| `date-fns`                                           | Date utility functions                                               |
| `sonner`                                             | Toast notifications (dashboard)                                      |
| `three` / `@react-three/fiber` / `@react-three/drei` | 3D rendering (available for dashboard features)                      |
| `vite-plugin-pwa`                                    | PWA support (service worker generation)                              |
| `concurrently`                                       | Run multiple processes in parallel (dev script)                      |
