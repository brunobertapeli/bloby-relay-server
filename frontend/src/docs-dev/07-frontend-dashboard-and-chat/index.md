---
title: "Frontend"
---

# Frontend Architecture

Morphy ships two completely separate frontend applications that run side by side in the browser. They are built, deployed, and served independently, communicating through a combination of `postMessage`, a shared supervisor HTTP proxy, and WebSocket connections.

## The Two Apps

| | Dashboard | Chat UI |
|---|---|---|
| **Location** | `workspace/client/` | `supervisor/chat/` |
| **Purpose** | Main app shell, navigation, user content | AI chat, onboarding wizard, settings |
| **Vite config** | `vite.config.ts` (root) | `vite.chat.config.ts` (root) |
| **Serving** | Vite dev server (port `supervisor + 2`, `7402` by default) | Pre-built static files from `dist-chat/` |
| **Entry points** | `src/main.tsx` | `chat-main.tsx`, `onboard-main.tsx` |
| **Rendered as** | Full page | Embedded in an iframe via `widget.js` |

## Why Two Separate Apps?

The separation is a deliberate **crash-isolation** design. The dashboard is the user-facing app that the AI agent actively modifies -- it writes code to `workspace/client/`, and the Vite dev server picks the changes up as HMR updates or full reloads. This means the dashboard is inherently fragile: a syntax error from the agent can crash the entire React tree.

The chat UI, on the other hand, must remain operational at all times. It is the user's primary way to communicate with the AI agent, especially to ask it to *fix* a crashed dashboard. By running in a separate iframe backed by pre-built static files (not a dev server), the chat survives dashboard crashes, HMR errors, and full-page reloads.

## How They Communicate

- **`postMessage`** -- The chat iframe sends events (`bloby:rebuilding`, `bloby:rebuilt`, `bloby:build-error`, `bloby:hmr-update`, `bloby:onboard-complete`, `bloby:close`) to the parent dashboard window. The parent side reacts selectively: `widget.js` closes the panel on `bloby:close`, and the dashboard's `App.tsx` dismisses the onboarding overlay on `bloby:onboard-complete` (it deliberately ignores `bloby:hmr-update`, since Vite HMR already handles hot updates).

- **Supervisor proxy** -- Both apps share the same origin (the supervisor port, `7400` by default). The supervisor serves `/bloby/*` from `dist-chat/` static files, answers `/api/*` with the in-process worker app (`createWorkerApp()` from `worker/index.ts`), and proxies everything else to the dashboard Vite dev server.

- **WebSocket** -- The chat connects to `/bloby/ws` for real-time AI streaming. The dashboard does not open its own app WebSocket; its live updates come from Vite's HMR socket (attached directly to the supervisor's HTTP server) plus `postMessage` from the chat iframe, which itself listens for `app:rebuilding`, `app:rebuilt`, `app:build-error`, and `app:hmr-update` events on the WebSocket.

## Shared Design Tokens

Both apps define their Tailwind v4 theme variables inline via `@theme` in their respective `globals.css` files. The brand tokens match -- `#0069FE` primary blue, the signature blue gradient (`#0166FF` -> `#009AFE` -> `#4AEEFF`), and the same custom utilities (`.text-gradient`, `.bg-gradient-brand`, `.glow-border`, `.animated-border`, `.input-glow`). Surfaces differ slightly by design: the dashboard sits on a near-black `#0A0A0A` background with a dot-grid pattern, the chat on `#1A1A1A`. This keeps the dashboard and the chat panel visually consistent.

## PWA Support

Both apps contribute to PWA functionality. The dashboard's `index.html` registers `sw.js` and links to `manifest.json` (standalone display, `#0A0A0A` theme). The chat's `chat.html` registers `/bloby/sw.js`. The service worker is embedded in the supervisor source (the `SW_JS` constant, kept in sync with `workspace/client/public/sw.js`) and served directly -- it handles app-shell caching, push notifications, and click-to-focus behavior.
