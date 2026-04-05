---
title: "Chat UI"
---

# Chat UI

The Chat UI is a self-contained single-page application that provides the AI chat interface and onboarding wizard. It lives in `supervisor/chat/` and is intentionally separate from the dashboard for crash isolation -- if the dashboard crashes (e.g., due to a bad code change by the agent), the chat remains functional so the user can still communicate with the AI to fix the problem.

## Vite Configuration

The chat's Vite config is at the project root: `vite.bloby.config.ts`.

```ts
export default defineConfig({
  root: 'supervisor/chat',
  base: '/bloby/',
  resolve: {
    alias: { '@': path.resolve(__dirname, 'supervisor/chat/src') },
  },
  build: {
    outDir: '../../dist-bloby',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        bloby: path.resolve(__dirname, 'supervisor/chat/bloby.html'),
        onboard: path.resolve(__dirname, 'supervisor/chat/onboard.html'),
      },
    },
  },
  plugins: [react(), tailwindcss()],
});
```

Key differences from the dashboard config:

- **Base path** is `/bloby/` so all assets are served under that prefix.
- **Multiple entry points** via Rollup's `input` -- `bloby.html` (chat) and `onboard.html` (onboarding wizard). Each gets its own JS bundle.
- **Build output** goes to `dist-bloby/` at the project root, which is committed to the npm package. The supervisor serves these files statically -- no Vite dev server.
- **Dep optimization** includes `react-markdown`, `remark-gfm`, and `react-syntax-highlighter` for markdown rendering in chat messages.

The build is triggered via `npm run build:bloby` (or as part of `npm run build`). The resulting `dist-bloby/` directory is pre-shipped in the npm package so users do not need to build it.

## Entry Points

### `bloby.html` + `bloby-main.tsx` (Chat)

The main chat interface. `bloby.html` is minimal -- a `#root` div, the module script entry, and a service worker registration (`/bloby/sw.js`). The `BlobyApp` component in `bloby-main.tsx` is a large root component that handles:

1. **Authentication gate** -- Checks `/api/onboard/status` to determine if a password is configured. If yes, validates the stored JWT token. Shows `LoginScreen` if authentication fails.
2. **WebSocket connection** -- Creates a `WsClient` instance connecting to `/bloby/ws` with the auth token appended as a query parameter.
3. **Chat UI** -- Renders `MessageList` and `InputBar` with the `useBlobyChat` hook managing message state.
4. **Settings loading** -- Fetches `/api/settings` to get the bot name and whisper (voice) configuration.
5. **Push notification management** -- Subscribe/unsubscribe UI for Web Push using VAPID. Checks `PushManager` availability and permission state.
6. **PWA install flow** -- Mobile-only "Install App" menu option. On Android, triggers `beforeinstallprompt`. On iOS, shows manual instructions (share -> add to home screen).
7. **Rebuild event forwarding** -- Listens for `app:rebuilding`, `app:rebuilt`, `app:build-error`, `app:hmr-update` events on the WebSocket and forwards them to the parent window via `postMessage`.
8. **Setup wizard** -- Menu option to re-open the `OnboardWizard` overlay at any time.

### `onboard.html` + `onboard-main.tsx` (Onboarding)

The initial setup wizard, displayed as a full-screen iframe over the dashboard on first run. `onboard-main.tsx` simply renders `<OnboardWizard isInitialSetup />` and notifies the parent window on completion via `postMessage({ type: 'bloby:onboard-complete' })`.

## Component Hierarchy

### Chat Components (`src/components/Chat/`)

**`ChatView`** -- Wrapper component that wires `useChat` to `MessageList` and `InputBar`. Used by the dashboard-embedded variant (using the simpler `useChat` hook). The standalone Bloby app (`bloby-main.tsx`) uses `useBlobyChat` directly instead.

**`MessageList`** -- Scrollable message container with:

- Auto-scroll to bottom on new messages (instant on initial load, smooth afterwards).
- Infinite scroll up via `IntersectionObserver` on a sentinel element. When the sentinel enters the viewport, calls `onLoadOlder()` (cursor-based pagination). Preserves scroll position after prepending older messages.
- Loading spinner when fetching older messages.
- "Start a conversation" placeholder when empty.
- `ImageLightbox` overlay for viewing image attachments.

**`MessageBubble`** -- Renders a single message with different layouts for user and assistant:

- **User messages** -- Right-aligned, blue background (`bg-primary`). Supports text, image thumbnails (clickable to open lightbox), document attachment indicators, and audio bubbles for voice messages.
- **Assistant messages** -- Left-aligned, muted background (`bg-muted`). Renders markdown via `react-markdown` with `remark-gfm`. Code blocks use `react-syntax-highlighter` with the `oneDark` theme. Tables, lists, and inline code have custom renderers.
- Both include a copy-to-clipboard button (appears on hover) and a timestamp.

**`InputBar`** -- The message composer with:

- Auto-resizing textarea (up to 4 lines, then scrolls).
- File attachments (`Paperclip` button) supporting images and PDFs. Camera capture button (`Camera`) for mobile.
- Image paste handling from clipboard.
- Image compression (`compressImage()`) that scales images down to 1600px max dimension and compresses JPEG quality to stay under 4MB.
- Draft persistence to `localStorage` (debounced, key `bloby_draft`).
- Voice recording via `MediaRecorder` API (hold-to-record with slide-to-cancel gesture). Records WebM audio, sends to Whisper for transcription.
- Three button states: microphone (no text), send arrow (has text), stop square (streaming).
- Desktop: Enter sends, Shift+Enter inserts newline. Mobile: Enter always inserts newline.

**`AudioBubble`** -- Inline audio player for voice messages with play/pause toggle, seekable progress bar, and duration display. Includes a workaround for WebM's `duration=Infinity` issue (seeks to a large value to force browser calculation).

**`ImageLightbox`** -- Full-screen overlay for viewing images. Supports keyboard navigation (arrow keys, Escape), left/right arrows for multi-image navigation, and image counter.

**`TypingIndicator`** -- Shown during streaming. Displays the streaming text buffer with a blinking cursor, or a bouncing three-dot animation when waiting for the first token. Shows the current tool name (e.g., "Reading file...", "Running command...") from a human-friendly label map.

### Login Screen (`src/components/`)

**`LoginScreen`** -- Two-phase authentication:

1. **Password phase** -- Basic auth with `admin:password` sent to `/api/portal/login`. Animated via `framer-motion`.
2. **TOTP phase** (if 2FA is enabled) -- 6-digit code input with numeric keyboard. "Trust this device for 90 days" checkbox. Recovery code option. TOTP state is saved to `sessionStorage` to survive page reloads (mobile PWA suspension).

### Onboarding Wizard

**`OnboardWizard`** -- Multi-step setup wizard with:

- AI provider selection (Claude/Anthropic or OpenAI Codex).
- OAuth device flow for Anthropic or OpenAI authentication.
- Model selection dropdown.
- Agent name customization (with live validation).
- User name input.
- Whisper (voice input) toggle.
- Portal password setup (optional on private networks, recommended on public).
- Tunnel configuration (Cloudflare quick tunnel toggle).
- Handle/relay registration for remote access.
- Access method detection (Tailscale, LAN, localhost, tunnel, relay, custom domain).

The wizard saves settings via WebSocket (`settings:save` message type) rather than HTTP POST to avoid relay/proxy issues.

## Hooks

### `useChat` (`src/hooks/useChat.ts`)

The simpler of the two chat hooks. Used by `ChatView` for the dashboard-embedded variant. Manages:

- Message array (`ChatMessage[]`) with role, content, timestamp, attachments, and audio data.
- Stream state (`streaming`, `streamBuffer`) for real-time token display.
- Tool activity tracking (`ToolActivity[]`) with name and status.
- Conversation ID persistence via `/api/context/current` and `/api/context/set`.
- WebSocket event handlers: `bot:typing`, `bot:token`, `bot:tool`, `bot:response`, `bot:error`.
- `sendMessage()` with optimistic UI (adds user message immediately before server confirms).
- `clearContext()` to reset conversation state.

### `useBlobyChat` (`src/hooks/useBlobyChat.ts`)

The full-featured hook used by the standalone Bloby chat app. Extends `useChat` with:

- **Authenticated fetching** via `authFetch()` for all API calls.
- **Cursor-based pagination** (`loadOlder()`) -- fetches 20 messages before the oldest visible message.
- **Cross-device sync** -- Listens for `chat:sync` events to show messages sent from other connected clients.
- **Server-created conversations** -- Handles `chat:conversation-created` events.
- **Reconnect state recovery** -- Listens for `chat:state` on connect to resume a stream in progress. Periodically re-syncs from DB during reconnect+streaming.
- **Multi-client context clearing** -- Sends `user:clear-context` and listens for `chat:cleared` broadcast.
- **DB-first loading** -- Loads messages from `/api/conversations/:id/messages?limit=20` instead of in-memory state.

## WebSocket Client (`src/lib/ws-client.ts`)

The `WsClient` class is a custom WebSocket wrapper with:

- **Auto-reconnect** with exponential backoff (1s initial, 8s max).
- **Message queuing** -- Messages sent while disconnected are queued and flushed on reconnect.
- **Heartbeat** -- Sends `ping` every 25 seconds to keep the connection alive through proxies and load balancers.
- **Auth token injection** -- Appends `?token=...` to the WebSocket URL on connect.
- **Event-based API** -- `on(type, handler)` returns an unsubscribe function. `onStatus(handler)` for connection state changes.
- **Type-safe protocol** -- Messages are `{ type: string, data: any }` JSON objects.

WebSocket events used:

| Direction | Event | Purpose |
|---|---|---|
| Server -> Client | `bot:typing` | Agent started processing |
| Server -> Client | `bot:token` | Streaming token |
| Server -> Client | `bot:tool` | Agent using a tool |
| Server -> Client | `bot:response` | Final response |
| Server -> Client | `bot:error` | Error message |
| Server -> Client | `chat:sync` | Cross-device message sync |
| Server -> Client | `chat:conversation-created` | New conversation ID |
| Server -> Client | `chat:state` | Current streaming state on reconnect |
| Server -> Client | `chat:cleared` | Context was cleared (broadcast) |
| Server -> Client | `app:rebuilding` | Dashboard rebuild started |
| Server -> Client | `app:rebuilt` | Dashboard rebuild complete |
| Server -> Client | `app:build-error` | Dashboard build failed |
| Server -> Client | `app:hmr-update` | HMR update applied |
| Server -> Client | `whisper:result` | Transcription result |
| Server -> Client | `settings:saved` | Settings save confirmed |
| Server -> Client | `tunnel:switched` | Tunnel mode changed |
| Client -> Server | `user:message` | Send chat message (with optional attachments/audio) |
| Client -> Server | `user:stop` | Stop current stream |
| Client -> Server | `user:clear-context` | Clear conversation |
| Client -> Server | `whisper:transcribe` | Transcribe audio |
| Client -> Server | `settings:save` | Save settings |
| Client -> Server | `tunnel:switch` | Change tunnel mode |
| Heartbeat | `ping` / `pong` | Keep-alive |

## Auth Library (`src/lib/auth.ts`)

Manages JWT tokens in `localStorage` (key: `bloby_token`):

- `getAuthToken()` / `setAuthToken()` / `clearAuthToken()` -- Simple localStorage accessors.
- `authFetch(url, options)` -- Drop-in `fetch()` replacement that injects `Authorization: Bearer <token>` headers and handles 401 responses by clearing the token and triggering the auth failure callback.
- `onAuthFailure(callback)` -- Registers a callback invoked on 401 (used to force re-login).

## Push Notifications

The chat app manages Web Push subscriptions via the service worker:

1. **Subscribe**: Requests notification permission, gets VAPID public key from `/api/push/vapid-public-key`, creates a `PushManager` subscription, and registers it with `/api/push/subscribe`.
2. **Unsubscribe**: Calls `subscription.unsubscribe()` and notifies the server at `/api/push/unsubscribe`.
3. **Status check**: Queries `/api/push/status?endpoint=...` to determine if the current device is subscribed.

Push states: `loading`, `unsupported`, `denied`, `subscribed`, `unsubscribed`.

## Styling

The chat UI uses the same Tailwind v4 setup as the dashboard, with an identical `globals.css` theme. The dark color scheme (`#212121` background, `#3C8FFF` primary, `#FD486B` destructive) provides visual consistency. Custom classes include `.text-gradient`, `.bg-gradient-brand`, `.glow-border`, `.animated-border`, and `.input-glow`.

## How dist-bloby/ Works

The chat UI is pre-built and shipped as static files:

1. `npm run build:bloby` runs `vite build --config vite.bloby.config.ts`.
2. Output goes to `dist-bloby/` with hashed JS/CSS asset filenames.
3. Two HTML entry points: `bloby.html` and `onboard.html`.
4. The supervisor serves these files statically for any request matching `/bloby/*`.
5. The `dist-bloby/` directory is included in the npm package's `files` array.
6. If `dist-bloby/` is missing at startup (e.g., first run after clone), the supervisor auto-builds it.

This approach means the chat never depends on a dev server being alive -- it works even if Vite crashes, the Node process is restarting, or the dashboard is rebuilding.
