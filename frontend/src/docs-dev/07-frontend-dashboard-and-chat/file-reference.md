---
title: "File Reference"
---

# File Reference

Comprehensive listing of all frontend-related files across both applications.

## Root-Level Configuration

| File | Description |
|---|---|
| `vite.config.ts` | Dashboard Vite configuration. Root is `workspace/client`, builds to `dist/`, proxies `/api` to supervisor and `/app/api` to user backend. Includes `@tailwindcss/vite` plugin. |
| `vite.chat.config.ts` | Chat UI Vite configuration. Root is `supervisor/chat`, base path `/bloby/`, builds to `dist-chat/`. Multi-entry: `chat.html` and `onboard.html`. |
| `components.json` | shadcn/ui configuration. Style: `new-york`, base color: `neutral`, icon library: `lucide`. Points CSS to `workspace/client/src/styles/globals.css`. |
| `package.json` | Shared dependencies for both frontends. Includes React 19, Vite 8, Tailwind v4, Zustand, framer-motion, recharts, Streamdown, shadcn primitives, and more. |

---

## Dashboard (`workspace/client/`)

### Root Files

| File | Description |
|---|---|
| `index.html` | HTML shell. Sets up PWA meta tags, a dark splash overlay (shown until the widget's canvas animation takes over), global error handler (catches crashes before React mounts), loads `main.tsx`, registers the service worker, and includes `widget.js`. |

### Source (`workspace/client/src/`)

| File | Description |
|---|---|
| `main.tsx` | React entry point. Renders `<App />` inside `React.StrictMode` and `BrowserRouter` into `#root`, then signals `bloby:app-ready` after first paint (consumed by the `widget.js` splash animation). |
| `App.tsx` | Root component. Wraps layout in `ErrorBoundary` (crash screen fallback), defines routes, detects incomplete onboarding via `/api/settings` (shows an iframe overlay of `/bloby/onboard.html`, dismissed on the `bloby:onboard-complete` `postMessage`), and re-shows the HTML splash before Vite full-reloads. |

### Styles (`workspace/client/src/styles/`)

| File | Description |
|---|---|
| `globals.css` | Tailwind v4 entry with `@import "tailwindcss"`. Defines all theme tokens inline via `@theme` (colors, radius, sidebar tokens). Custom utilities: `.text-gradient`, `.bg-gradient-brand`, `.glow-border`, `.animated-border`, `.input-glow`. Scrollbar styling, selection color, and `overscroll-behavior: none`. |

### Lib (`workspace/client/src/lib/`)

| File | Description |
|---|---|
| `utils.ts` | Exports `cn()` -- merges `clsx()` and `twMerge()` for conditional Tailwind class composition. Used by all shadcn and custom components. |

### Layout Components (`workspace/client/src/components/Layout/`)

| File | Description |
|---|---|
| `DashboardLayout.tsx` | App shell with responsive layout. Desktop: floating sidebar card + main content. Mobile: hamburger header + sheet nav. Polls `/app/api/health` (the user backend) every 10s and passes a `healthy`/`restarting` status down to `Sidebar` and `MobileNav`. Uses `h-dvh` for proper mobile viewport. |
| `Sidebar.tsx` | 256px (`w-64`) sidebar with Morphy branding, time-aware greeting with gradient name, and navigation (Dashboard, App 1, Research, What Else?) using `react-router` NavLinks with a framer-motion sliding active indicator. Shows a workspace status pill (Live/Restarting) at the bottom. Uses `lucide-react` icons. |
| `MobileNav.tsx` | Hamburger menu button that opens a shadcn `Sheet` from the left containing the `Sidebar` component. Hidden on `md:` breakpoint and above. |
| `Footer.tsx` | Status bar with green/orange indicator dot and "Backend (Healthy/Restarting)" text, driven by a `status` prop. Currently not mounted by `DashboardLayout` (the Sidebar's status pill took its place). |

### Dashboard Components (`workspace/client/src/components/Dashboard/`)

| File | Description |
|---|---|
| `DashboardPage.tsx` | Landing page with a gradient "Let's get started" heading and the example placeholder widgets. Intentionally thin so the agent can replace it with the user's real dashboard. |
| `deleteme_placeholders.tsx` | Self-contained demo widgets (own data, icons, styles, dismissible "these are examples" banner) rendered by `DashboardPage`. Designed for one-file deletion when real widgets replace them. |

### Error Handling (`workspace/client/src/components/`)

| File | Description |
|---|---|
| `ErrorBoundary.tsx` | React class component error boundary. Catches render errors in descendants and displays the provided `fallback` prop. Used in `App.tsx` to show a crash recovery screen. |

### Onboarding Tour (`workspace/client/src/components/deleteme_onboarding/`)

| File | Description |
|---|---|
| `WorkspaceTour.tsx` | First-run workspace tour built on `driver.js`. Highlights key dashboard areas, runs once (`localStorage` flag), and stays disabled while the onboarding overlay is up. Like the placeholders, the folder is demo scaffolding designed for easy deletion. |

### UI Components (`workspace/client/src/components/ui/`)

All shadcn/ui components (new-york style, Radix UI primitives):

| File | Description |
|---|---|
| `avatar.tsx` | Avatar with image and fallback. |
| `badge.tsx` | Inline badge with variant support (default, secondary, destructive, outline). |
| `button.tsx` | Button with size and variant props. Supports `asChild` via Radix Slot. |
| `card.tsx` | Card container with header, title, description, content, and footer subcomponents. |
| `dialog.tsx` | Modal dialog with overlay, close button, title, and description. |
| `dropdown-menu.tsx` | Dropdown menu with items, checkboxes, radio groups, submenus, separators, and labels. |
| `input.tsx` | Styled native input with consistent sizing and focus ring. |
| `scroll-area.tsx` | Custom scrollable area with styled scrollbar (Radix ScrollArea). |
| `select.tsx` | Select dropdown with trigger, content, items, groups, separators, and labels. |
| `separator.tsx` | Horizontal or vertical divider line. |
| `sheet.tsx` | Slide-in panel (dialog variant) from top, bottom, left, or right. Used by `MobileNav`. |
| `skeleton.tsx` | Loading placeholder with pulse animation. |
| `switch.tsx` | Toggle switch. |
| `tabs.tsx` | Tab navigation with tab list, triggers, and content panels. |
| `textarea.tsx` | Styled native textarea with consistent sizing and focus ring. |
| `tooltip.tsx` | Hover tooltip with configurable content and placement. |

### Public Assets (`workspace/client/public/`)

| File | Description |
|---|---|
| `manifest.json` | PWA manifest. Display: standalone, start URL: `/`, theme color: `#0A0A0A`. Declares app icons (any + maskable). |
| `sw.js` | Service worker for PWA installability, app-shell caching (cache-first for hashed assets, network-first for HTML and modules, network-only for API/WebSocket), and push notifications. Handles `push` events (shows notification with icon, badge, vibration) and `notificationclick` (focus existing window or open new). Mirror of the supervisor's embedded `SW_JS` constant. |

---

## Chat UI (`supervisor/chat/`)

### Root Files

| File | Description |
|---|---|
| `chat.html` | Chat app HTML shell. Minimal: `#root` div, module script loading `chat-main.tsx`, service worker registration at `/bloby/sw.js`. |
| `onboard.html` | Onboarding wizard HTML shell. Same structure as `chat.html` (minus the service worker registration) but loads `onboard-main.tsx`. |
| `chat-main.tsx` | Chat app entry point. Large root component (`BlobyApp`) handling auth gate, WebSocket connection, chat UI composition, push notifications, PWA install flow, rebuild event forwarding, and setup wizard overlay. |
| `onboard-main.tsx` | Onboarding entry point. Renders `<OnboardWizard isInitialSetup />`, notifies parent (`bloby:onboard-complete`) on completion. |
| `OnboardWizard.tsx` | Multi-step setup wizard. Provider selection (Claude/Anthropic, Codex/OpenAI, Pi bring-your-own-model), OAuth flows (Anthropic code paste-back; Codex device-code by default with a paste-back fallback), model selection, agent/user name, whisper toggle, portal password + TOTP setup, tunnel mode (`relay`/`off`), handle registration, scheduled-task management. Access method detection (Tailscale, LAN, localhost, tunnel, relay, custom domain). |

### Chat Components (`supervisor/chat/src/components/Chat/`)

| File | Description |
|---|---|
| `ChatView.tsx` | Wrapper wiring `useChat` hook to `MessageList` + `InputBar`. Used for dashboard-embedded variant. Exposes `clearContext` via ref for parent control. |
| `MessageList.tsx` | Scrollable message container. Auto-scroll to bottom, infinite scroll up via `IntersectionObserver`, loading spinner for older messages, empty state placeholder. Manages `ImageLightbox` state. |
| `MessageBubble.tsx` | Single message renderer. User: right-aligned blue bubble with text, image thumbnails, document indicators, voice audio, channel tag (Chat/Mac/etc.). Assistant: left-aligned muted bubble with markdown and syntax-highlighted code via `streamdown` + `@streamdown/code`, plus special embedded cards (`EnvForm`, `BlobyImageCard`, `BlobyTextCard`, `NotchCard`, `MorphyActionCard`). Both have copy button and timestamp. |
| `InputBar.tsx` | Message composer. Auto-resizing textarea (4 lines max), file/camera attachments, clipboard paste, image compression (1600px max, JPEG), draft persistence (`localStorage`), hold-to-record voice with slide-to-cancel, three button states (mic/send/stop). |
| `AudioBubble.tsx` | Inline audio player. Play/pause toggle, seekable progress bar, duration display. WebM `duration=Infinity` workaround. |
| `ImageLightbox.tsx` | Full-screen image viewer with navigation arrows, keyboard support (arrows + Escape), image counter. |
| `TypingIndicator.tsx` | Streaming indicator. Shows streamed text with cursor, or bouncing dots when waiting. Displays active tool name with friendly labels (e.g., "Reading file...", "Searching code..."). |
| `AuthedImage.tsx` | `<img>` for `/api/files/*` attachments. Fetches the file with the Bearer token via `useAuthedFileUrl` and renders a blob URL (native `img src` cannot carry auth headers), with loading placeholder and broken-image fallback. |
| `BlobyImageCard.tsx` | Card for agent-sent images (`<bloby_image>`), with download affordance and auth-aware loading. |
| `BlobyTextCard.tsx` | Collapsible card for long agent-sent text documents (`<bloby_text>`), rendered as markdown with size indicator. |
| `EnvForm.tsx` | Inline secrets form the agent can emit in chat: grouped labeled fields submitted to the backend so users never paste API keys as plain messages. |
| `HeadphonesAnimation.tsx` | Sprite-sheet headphones animation for voice mode, config-driven from `/morphy/headphones.json` (idle/activating/recording/deactivating clips). |
| `MorphyActionCard.tsx` | Compact card for Mac actions (`<morphy_action>`), e.g. spotlight/point, with friendly label + icon and graceful fallback for unknown verbs. |
| `NotchCard.tsx` | Preview card for Mac notch content: `<notch_html>` rendered live in a sandboxed iframe, `<notch_card>` presets shown as formatted JSON. |

### Login (`supervisor/chat/src/components/`)

| File | Description |
|---|---|
| `LoginScreen.tsx` | Two-phase login: password (Basic auth) then optional TOTP (6-digit code or recovery code). "Trust device 90 days" option. Framer-motion animated transitions. Persists TOTP phase to `sessionStorage` for mobile PWA suspension recovery. |

### Hooks (`supervisor/chat/src/hooks/`)

| File | Description |
|---|---|
| `useChat.ts` | Simple chat hook. Manages messages, streaming state, tool activity, conversation ID. WebSocket event handlers for `bot:*` events. Optimistic message sending. Conversation persistence via `/api/context/*`. Exports types: `ChatMessage`, `ToolActivity`, `Attachment`, `StoredAttachment`. |
| `useBlobyChat.ts` | Full-featured chat hook for standalone app. Extends `useChat` semantics with authenticated fetching, cursor-based pagination (initial load of 200 messages, older pages of 100), cross-device sync (`chat:sync`), server conversation creation (`chat:conversation-created`), reconnect state recovery (`chat:state`), multi-client clearing (`chat:cleared`), and periodic DB re-sync during streams. |
| `useSpeechRecognition.ts` | Browser speech-to-text hook wrapping the (vendor-prefixed) `SpeechRecognition` API for live voice transcription. |

### Libraries (`supervisor/chat/src/lib/`)

| File | Description |
|---|---|
| `ws-client.ts` | `WsClient` class. WebSocket wrapper with auto-reconnect (exponential backoff, 1s-8s), message queuing (flushed on reconnect), heartbeat (ping every 25s), auth token injection (?token= query param), event-based API (`on(type, handler)` returns unsubscribe), connection status callbacks. |
| `auth.ts` | JWT token management. `getAuthToken()`/`setAuthToken()`/`clearAuthToken()` for `localStorage`. `authFetch()` -- fetch wrapper that injects `Authorization: Bearer` headers and handles 401 (clears token, triggers callback). `onAuthFailure()` callback registration. |
| `authedFile.ts` | `useAuthedFileUrl` hook: resolves a `/api/files/*` path into a blob object URL fetched with the Bearer token (native `img`/`audio` elements cannot attach auth headers). Returns `{ url, status }` and revokes object URLs on cleanup. |

### Styles (`supervisor/chat/src/styles/`)

| File | Description |
|---|---|
| `globals.css` | Tailwind v4 theme matching the dashboard's brand tokens (same `#0069FE` primary, same custom utilities: `.text-gradient`, `.bg-gradient-brand`, `.glow-border`, `.animated-border`, `.input-glow`) with its own surface palette (`#1A1A1A` background). Adds `@source` directives for the Streamdown packages so their classes get compiled. |

---

## Supervisor Frontend Files (`supervisor/`)

| File | Description |
|---|---|
| `widget.js` | Chat bubble injector. Creates backdrop, slide-in panel (480px, lazy-loaded iframe to `/bloby/`), and a canvas-drawn animated blob that plays the boot splash then morphs into the chat bubble (splash-seen flag in `localStorage`). Toggle on click/Escape, `postMessage` handling for close/Escape-forwarding/install/unread badge/onboarding visibility, open-state restore across reloads via `sessionStorage`. |
| `app-ws.js` | Injected helper that overrides `window.fetch` for `/app/api/*` calls and routes them over the supervisor WebSocket (`app:api` frames) with reconnect and heartbeat, exposed as `window.__appWs`. |
| `workspace-guard.js` | Supervisor-injected guard for the dashboard only: backend-down auto-detect and reload, suppression of Vite's reload-on-reconnect (staleness-checked against `/__bloby/fe-stamp`), and a friendly replacement for Vite's raw error overlay. |
| `vite-dev.ts` | Vite dev server launcher. Creates dashboard Vite server on `port+2`, attaches HMR WebSocket to supervisor's HTTP server (so HMR works through the relay). Sweeps stale per-version dep-prebundle caches and pre-warms module transforms. Exports `reloadDashboard()` for programmatic full-reload. |
| `index.ts` | Supervisor main. HTTP reverse proxy, WebSocket server, auth middleware, `/bloby/*` static file serving, chat message routing, agent query orchestration, and mounting of the in-process worker app (`createWorkerApp()`). Contains embedded service worker constant (`SW_JS`) and recovering HTML. |

---

## Build Output (`dist-chat/`)

Pre-built static files shipped in the npm package. Not checked into source control but generated by `npm run build:chat`. Contains:

| Path | Description |
|---|---|
| `chat.html` | Chat app HTML entry point (references hashed JS/CSS). |
| `onboard.html` | Onboarding wizard HTML entry point (references hashed JS/CSS). |
| `assets/*.js` | Bundled and minified JavaScript chunks with content hashes. |
| `assets/*.css` | Bundled and minified CSS with content hashes. |

The supervisor serves these files for any request matching `/bloby/*`, with appropriate cache headers (no-cache for HTML, immutable for hashed assets).
