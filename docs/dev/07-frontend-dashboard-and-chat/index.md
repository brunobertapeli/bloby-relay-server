---
title: "Frontend"
---

# Frontend Architecture

Bloby ships two completely separate frontend applications that run side by side in the browser. They are built, deployed, and served independently, communicating through a combination of `postMessage`, a shared supervisor HTTP proxy, and WebSocket connections.

## The Two Apps

| | Dashboard | Chat UI |
|---|---|---|
| **Location** | `workspace/client/` | `supervisor/chat/` |
| **Purpose** | Main app shell, navigation, user content | AI chat, onboarding wizard, settings |
| **Vite config** | `vite.config.ts` (root) | `vite.bloby.config.ts` (root) |
| **Serving** | Vite dev server (port `supervisor + 2`) | Pre-built static files from `dist-bloby/` |
| **Entry points** | `src/main.tsx` | `bloby-main.tsx`, `onboard-main.tsx` |
| **Rendered as** | Full page | Embedded in an iframe via `widget.js` |

## Why Two Separate Apps?

The separation is a deliberate **crash-isolation** design. The dashboard is the user-facing app that the AI agent actively modifies -- it writes code to `workspace/client/`, rebuilds via `vite build`, and triggers HMR reloads. This means the dashboard is inherently fragile: a syntax error from the agent can crash the entire React tree.

The chat UI, on the other hand, must remain operational at all times. It is the user's primary way to communicate with the AI agent, especially to ask it to *fix* a crashed dashboard. By running in a separate iframe backed by pre-built static files (not a dev server), the chat survives dashboard crashes, HMR errors, and full-page reloads.

## How They Communicate

- **`postMessage`** -- The chat iframe sends events (`bloby:rebuilding`, `bloby:rebuilt`, `bloby:build-error`, `bloby:hmr-update`, `bloby:onboard-complete`, `bloby:close`) to the parent dashboard window. The dashboard listens for these to show rebuild overlays, reload on build completion, or dismiss the onboarding overlay.

- **Supervisor proxy** -- Both apps share the same origin (port 3000). The supervisor routes `/bloby/*` to `dist-bloby/` static files, `/api/*` to the worker process, and everything else to the dashboard Vite dev server.

- **WebSocket** -- The chat connects to `/bloby/ws` for real-time AI streaming. The dashboard does not use WebSocket directly; it receives rebuild notifications through `postMessage` from the chat iframe, which itself listens for `app:rebuilding`, `app:rebuilt`, `app:build-error`, and `app:hmr-update` events on the WebSocket.

## Shared Design Tokens

Both apps import the same Tailwind v4 theme variables (defined inline via `@theme` in their respective `globals.css` files). The design tokens are identical -- dark theme with `#212121` background, `#3C8FFF` primary blue, `#FD486B` destructive red, and the signature gradient (`#04D1FE` -> `#AF27E3` -> `#FB4072`). This ensures visual consistency between the dashboard and the chat panel.

## PWA Support

Both apps contribute to PWA functionality. The dashboard's `index.html` registers `sw.js` and links to `manifest.json` (standalone display, `#212121` theme). The chat's `bloby.html` registers `/bloby/sw.js`. The service worker is embedded in the supervisor source and served directly -- it handles push notifications and click-to-focus behavior.
