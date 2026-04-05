---
title: "File Reference"
---

# File Reference

Comprehensive listing of all frontend-related files across both applications.

## Root-Level Configuration

| File | Description |
|---|---|
| `vite.config.ts` | Dashboard Vite configuration. Root is `workspace/client`, builds to `dist/`, proxies `/api` to supervisor and `/app/api` to user backend. Includes `@tailwindcss/vite` plugin. |
| `vite.bloby.config.ts` | Chat UI Vite configuration. Root is `supervisor/chat`, base path `/bloby/`, builds to `dist-bloby/`. Multi-entry: `bloby.html` and `onboard.html`. |
| `components.json` | shadcn/ui configuration. Style: `new-york`, base color: `neutral`, icon library: `lucide`. Points CSS to `workspace/client/src/styles/globals.css`. |
| `package.json` | Shared dependencies for both frontends. Includes React 19, Vite 7, Tailwind v4, Zustand, framer-motion, recharts, shadcn primitives, and more. |

---

## Dashboard (`workspace/client/`)

### Root Files

| File | Description |
|---|---|
| `index.html` | HTML shell. Sets up PWA meta tags, global error handler (catches crashes before React mounts), loads `main.tsx`, registers service worker, and includes `widget.js`. |

### Source (`workspace/client/src/`)

| File | Description |
|---|---|
| `main.tsx` | React entry point. Renders `<App />` inside `React.StrictMode` into `#root`. |
| `App.tsx` | Root component. Wraps layout in `ErrorBoundary`, handles onboarding detection (shows iframe overlay), listens for rebuild/HMR `postMessage` events from chat iframe, shows rebuild overlay during agent-triggered builds. |

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
| `DashboardLayout.tsx` | App shell with responsive layout. Desktop: sidebar + main content. Mobile: hamburger header + sheet nav. Polls `/api/health` every 15s for connection status. Uses `h-dvh` for proper mobile viewport. |
| `Sidebar.tsx` | 256px sidebar with Bloby branding, time-aware greeting, and navigation (Dashboard, My Apps dropdown, Reports, Research, What Else). Uses `lucide-react` icons and sidebar-specific color tokens. |
| `MobileNav.tsx` | Hamburger menu button that opens a shadcn `Sheet` from the left containing the `Sidebar` component. Hidden on `md:` breakpoint and above. |
| `Footer.tsx` | Status bar with green/red connection indicator dot and "Connected"/"Disconnected" text. Receives `connected` prop from `DashboardLayout`. |

### Dashboard Components (`workspace/client/src/components/Dashboard/`)

| File | Description |
|---|---|
| `DashboardPage.tsx` | Landing page with welcome message and starter suggestion chips. Tapping a chip opens the chat widget and pre-fills the input textarea using native property setter + synthetic event dispatch. Shows arrow images pointing to the chat bubble. |

### Error Handling (`workspace/client/src/components/`)

| File | Description |
|---|---|
| `ErrorBoundary.tsx` | React class component error boundary. Catches render errors in descendants and displays the provided `fallback` prop. Used in `App.tsx` to show a crash recovery screen. |

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
| `manifest.json` | PWA manifest. Display: standalone, start URL: `/`, theme color: `#212121`. Declares app icons. |
| `sw.js` | Service worker for PWA installability and push notifications. Handles `push` events (shows notification with icon, badge, vibration) and `notificationclick` (focus existing window or open new). |

---

## Chat UI (`supervisor/chat/`)

### Root Files

| File | Description |
|---|---|
| `bloby.html` | Chat app HTML shell. Minimal: `#root` div, module script loading `bloby-main.tsx`, service worker registration at `/bloby/sw.js`. |
| `onboard.html` | Onboarding wizard HTML shell. Same structure as `bloby.html` but loads `onboard-main.tsx`. |
| `bloby-main.tsx` | Chat app entry point. Large root component (`BlobyApp`) handling auth gate, WebSocket connection, chat UI composition, push notifications, PWA install flow, rebuild event forwarding, and setup wizard overlay. |
| `onboard-main.tsx` | Onboarding entry point. Renders `<OnboardWizard isInitialSetup />`, notifies parent (`bloby:onboard-complete`) on completion. |
| `OnboardWizard.tsx` | Multi-step setup wizard. Provider selection (Anthropic/OpenAI), OAuth device flow, model selection, agent/user name, whisper toggle, portal password, tunnel config, handle registration. Access method detection (Tailscale, LAN, localhost, tunnel, relay, custom domain). |

### Chat Components (`supervisor/chat/src/components/Chat/`)

| File | Description |
|---|---|
| `ChatView.tsx` | Wrapper wiring `useChat` hook to `MessageList` + `InputBar`. Used for dashboard-embedded variant. Exposes `clearContext` via ref for parent control. |
| `MessageList.tsx` | Scrollable message container. Auto-scroll to bottom, infinite scroll up via `IntersectionObserver`, loading spinner for older messages, empty state placeholder. Manages `ImageLightbox` state. |
| `MessageBubble.tsx` | Single message renderer. User: right-aligned blue bubble with text, image thumbnails, document indicators, voice audio. Assistant: left-aligned muted bubble with markdown (`react-markdown` + `remark-gfm`), syntax-highlighted code (`react-syntax-highlighter` + `oneDark`), custom table/list renderers. Both have copy button and timestamp. |
| `InputBar.tsx` | Message composer. Auto-resizing textarea (4 lines max), file/camera attachments, clipboard paste, image compression (1600px max, JPEG), draft persistence (`localStorage`), hold-to-record voice with slide-to-cancel, three button states (mic/send/stop). |
| `AudioBubble.tsx` | Inline audio player. Play/pause toggle, seekable progress bar, duration display. WebM `duration=Infinity` workaround. |
| `ImageLightbox.tsx` | Full-screen image viewer with navigation arrows, keyboard support (arrows + Escape), image counter. |
| `TypingIndicator.tsx` | Streaming indicator. Shows streamed text with cursor, or bouncing dots when waiting. Displays active tool name with friendly labels (e.g., "Reading file...", "Searching code..."). |

### Login (`supervisor/chat/src/components/`)

| File | Description |
|---|---|
| `LoginScreen.tsx` | Two-phase login: password (Basic auth) then optional TOTP (6-digit code or recovery code). "Trust device 90 days" option. Framer-motion animated transitions. Persists TOTP phase to `sessionStorage` for mobile PWA suspension recovery. |

### Hooks (`supervisor/chat/src/hooks/`)

| File | Description |
|---|---|
| `useChat.ts` | Simple chat hook. Manages messages, streaming state, tool activity, conversation ID. WebSocket event handlers for `bot:*` events. Optimistic message sending. Conversation persistence via `/api/context/*`. Exports types: `ChatMessage`, `ToolActivity`, `Attachment`, `StoredAttachment`. |
| `useBlobyChat.ts` | Full-featured chat hook for standalone app. Extends `useChat` semantics with authenticated fetching, cursor-based pagination (20 messages per page), cross-device sync (`chat:sync`), server conversation creation (`chat:conversation-created`), reconnect state recovery (`chat:state`), multi-client clearing (`chat:cleared`), and periodic DB re-sync during streams. |

### Libraries (`supervisor/chat/src/lib/`)

| File | Description |
|---|---|
| `ws-client.ts` | `WsClient` class. WebSocket wrapper with auto-reconnect (exponential backoff, 1s-8s), message queuing (flushed on reconnect), heartbeat (ping every 25s), auth token injection (?token= query param), event-based API (`on(type, handler)` returns unsubscribe), connection status callbacks. |
| `auth.ts` | JWT token management. `getAuthToken()`/`setAuthToken()`/`clearAuthToken()` for `localStorage`. `authFetch()` -- fetch wrapper that injects `Authorization: Bearer` headers and handles 401 (clears token, triggers callback). `onAuthFailure()` callback registration. |

### Styles (`supervisor/chat/src/styles/`)

| File | Description |
|---|---|
| `globals.css` | Identical Tailwind v4 theme to dashboard. Same `@theme` tokens, same custom utilities (`.text-gradient`, `.bg-gradient-brand`, `.glow-border`, `.animated-border`, `.input-glow`). Ensures visual consistency between dashboard and chat. |

---

## Supervisor Frontend Files (`supervisor/`)

| File | Description |
|---|---|
| `widget.js` | Chat bubble injector. Creates backdrop, slide-in panel (480px, iframe to `/bloby/`), and animated bubble (WebM video or PNG fallback for Safari). Toggle on click/Escape, `postMessage` handling for close/install, onboarding visibility check, HMR state persistence via `sessionStorage`. |
| `vite-dev.ts` | Vite dev server launcher. Creates dashboard Vite server on `port+2`, attaches HMR WebSocket to supervisor's HTTP server (for tunnel/relay compatibility). Pre-warms module transforms. Exports `reloadDashboard()` for programmatic full-reload. |
| `index.ts` | Supervisor main. HTTP reverse proxy, WebSocket server, auth middleware, `/bloby/*` static file serving, chat message routing, agent query orchestration. Contains embedded service worker constant and recovering HTML. |

---

## Build Output (`dist-bloby/`)

Pre-built static files shipped in the npm package. Not checked into source control but generated by `npm run build:bloby`. Contains:

| Path | Description |
|---|---|
| `bloby.html` | Chat app HTML entry point (references hashed JS/CSS). |
| `onboard.html` | Onboarding wizard HTML entry point (references hashed JS/CSS). |
| `assets/*.js` | Bundled and minified JavaScript chunks with content hashes. |
| `assets/*.css` | Bundled and minified CSS with content hashes. |

The supervisor serves these files for any request matching `/bloby/*`, with appropriate cache headers (no-cache for HTML, immutable for hashed assets).
