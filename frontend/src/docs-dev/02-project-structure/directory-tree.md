---
title: "Directory Tree"
---

### 2.1 `/bin/` -- CLI Entry Point

```plain
bin/
  cli.js            The `morphy` command-line interface (bundled JS)
```

| File     | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cli.js` | The executable CLI. Registered as `"morphy"` in `package.json`'s `bin` field. Determines whether it is running in dev mode (has `.git`) or production mode (operates from `~/.morphy/`). Handles all subcommands: `morphy start`, `morphy init`, `morphy update`, `morphy daemon install/start/stop/restart/status/logs/uninstall`, `morphy tunnel`, `morphy password-reset`, etc. Supports systemd (Linux) and launchd (macOS) daemon management; every command daemonizes and returns the terminal (use `start --foreground` to debug). Accepts a `--hosted` flag for cloud deployments. |

---

### 2.2 `/supervisor/` -- Core Supervisor Process

The supervisor is the central orchestrator. It boots the HTTP server, mounts the worker API in-process, spawns the user's backend as a child process, holds the carrier connection to the Morphy edge, schedules cron jobs, and serves both the dashboard and the chat UI.

```plain
supervisor/
  index.ts           Main supervisor entry point -- HTTP server, WebSocket handler, routing, static serving
  relay-tunnel.ts    Carrier client -- persistent outbound WSS to the bot's Durable Object at the Morphy edge
  backend.ts         Backend child process manager -- spawns, monitors, auto-restarts the user's Express backend
  vite-dev.ts        Vite dev server launcher -- in-process Vite that serves the dashboard
  bloby-agent.ts     Agent harness dispatcher -- routes agent calls to the configured provider's harness
  harnesses/         Harness implementations -- claude.ts, codex.ts, pi/, plus shared skills.ts plumbing
  agents/            Sub-agent definitions -- per-agent config and prompt files
  agent-api.ts       POST /api/agent/query -- exposes the active harness to workspace code
  channels/          Messaging channels -- WhatsApp, Telegram, Alexa, coordinated by manager.ts
  outbound.ts        Unified outbound delivery -- chat timeline, Mac push, channel messages
  scheduler.ts       Pulse and cron scheduler -- checks timing every 60s, triggers autonomous agent actions
  cli-warmup.ts      Pre-warms the Claude Agent SDK subprocess for a fast first response
  shell.ts           The "immortal shell" page -- bubble + chat chrome around the workspace iframe
  workspace-guard.js Browser-side guard injected into the dashboard -- error overlay, reload forensics
  app-ws.js          Workspace-side WebSocket helper injected into the dashboard
  frontend-log.ts    Server-side ring buffer of frontend compile and runtime errors
  file-saver.ts      File attachment handler -- saves uploaded images, audio, and documents to workspace/files/
  widget.js          Chat widget injector -- vanilla JS that creates the floating bubble and slide-out chat panel
  public/            Morphy-branded static assets -- PWA icons, manifest, avatar animations and sprites
  chat/              Pre-built chat SPA source (see section 2.3)
```

#### File-by-file breakdown

| File             | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`       | **The heart of Morphy.** Creates an HTTP server on the configured port (default 7400). Serves the top-level shell page, proxies workspace requests to the in-process Vite dev server, and serves the chat UI from `dist-chat/` under the `/bloby/` path. Mounts the worker's Express app in-process via `createWorkerApp()` (no separate worker process or port). Runs the WebSocket server (`blobyWss`) for real-time chat. Orchestrates startup: starts Vite on port+2, spawns the backend on port+4, opens the carrier (`relay-tunnel.ts`), starts the scheduler and channels. Handles graceful shutdown (SIGINT/SIGTERM). Embeds the service worker for PWA installability and push notifications. |
| `relay-tunnel.ts` | The carrier client (`tunnel.mode: 'relay'`), which replaced the old cloudflared integration. Opens one long-lived outbound WSS connection to the bot's Durable Object at the Morphy edge, authenticated with a short-lived Ed25519 ticket minted from the relay token (`fetchTicket` in `shared/relay.ts`). The edge muxes browser HTTP and WebSocket traffic down the carrier; this client demuxes each stream and replays it against the local supervisor port. Streams response bodies in 64 KB frames with backpressure, pings the edge every 15s, and redials the same Durable Object on disconnect: the public URL never changes. Stamps `x-morphy-tunnel` and the real client IP on every replayed request so loopback-only endpoints stay unreachable from the public path. |
| `backend.ts`     | Spawns the user's backend (`workspace/backend/index.ts`) as a child process on port `basePort + 4`. Auto-restarts on unexpected exit with backoff; logs stdout/stderr to `workspace/.backend.log` (the previous run is preserved as `.backend.log.prev`). Exposes `spawnBackend(port)`, `stopBackend()`, `restartBackend(port)`, `isBackendAlive()`, `probeBackendReady()`, `readBackendLogTail()`, `setBackendEnv()`, `resetBackendRestarts()`.                                                                                                                                     |
| `vite-dev.ts`    | Creates an in-process Vite dev server for the dashboard on port `basePort + 2`. Runs in development and production alike: the workspace stays source-editable so the agent can modify the app live. Attaches the HMR WebSocket to the supervisor's HTTP server so hot reload works through the carrier. Pre-warms module transforms on startup and captures compile/transform errors into the frontend log ring.                                                                                                                                                                     |
| `bloby-agent.ts` | Thin agent harness dispatcher. Picks the harness for the configured provider and forwards every call: `anthropic` routes to the Claude Agent SDK harness (`harnesses/claude.ts`), `openai` to the Codex app-server harness (`harnesses/codex.ts`), `pi` to the Pi harness (`harnesses/pi/`). Cleanup operations (`endConversation`, `endAllConversations`) fan out to all harnesses so a stale conversation cannot outlive a provider switch. Exposes `startConversation`, `pushMessage`, `startBlobyAgentQuery`, and friends to the supervisor, scheduler, and channels.            |
| `harnesses/`     | The harness implementations behind the dispatcher. `claude.ts` wraps `@anthropic-ai/claude-agent-sdk`; each session gets the memory files (`MYSELF.md`, `MYHUMAN.md`, `MEMORY.md`) and recent conversation history injected. `codex.ts` drives a spawned `codex app-server` process with full tool use. `pi/` implements the Pi provider (sessions, tools, model catalog). `skills.ts` is the shared skill-loading plumbing for all three; `attachment-policy.ts` normalizes attachment limits; `types.ts` defines the common `Harness` contract.                                     |
| `channels/`      | Messaging channels: `whatsapp.ts` (Baileys), `telegram.ts` (Bot API long-polling with the user's own bot token), `alexa.ts`, coordinated by `manager.ts`. Each channel runs in one of three modes (channel, business, assistant) and can load a customer-facing skill persona from the active skill's `SCRIPT.md`.                                                                                                                                                                                                                                                                    |
| `agent-api.ts`   | `POST /api/agent/query`: exposes the active harness to workspace code. Localhost-only, authenticated with a per-session secret injected into the backend as `MORPHY_AGENT_SECRET`, with concurrency and rate limits. Supports session persistence via an opaque `sessionId`.                                                                                                                                                                                                                                                                                                         |
| `outbound.ts`    | Unified outbound delivery: the one place agent-to-human messages leave the system, whether to the chat timeline (plus web push), connected Mac apps, or a WhatsApp/Telegram send. Every delivery is also persisted to the conversation so the timeline records all agent-initiated messages. `extractOutboundTags()` parses `<mac_push>` / `<Message>` blocks in agent output for both interactive turns and scheduler runs.                                                                                                                                                          |
| `scheduler.ts`   | Reads `workspace/PULSE.json` and `workspace/CRONS.json` every 60 seconds. Pulse: triggers autonomous agent actions at a configurable interval (default 30 min) with quiet hours support. Crons: evaluates cron expressions (via `cron-parser`) and fires `startBlobyAgentQuery` when schedules match. Supports one-shot crons that auto-disable after firing and user-paused crons.                                                                                                                                                                                                  |
| `shell.ts`       | The static "immortal shell" HTML served for top-level navigations. It contains only the widget chrome and a same-origin iframe hosting the workspace app, so workspace reloads, rebuilds, and error interstitials happen inside the iframe and the chat never dies. Disabled with `MORPHY_NO_SHELL=1`.                                                                                                                                                                                                                                                                              |
| `workspace-guard.js` | Injected by the supervisor into the workspace dashboard HTML. Auto-detects a dead backend and reloads into the recovery page, replaces Vite's raw error overlay with a friendly one, records reload forensics, and forwards browser errors to the supervisor's frontend log ring (`frontend-log.ts`) so the agent can read them.                                                                                                                                                                                                                                                 |
| `file-saver.ts`  | Handles file uploads from chat. `ensureFileDirs()` creates `workspace/files/audio/`, `workspace/files/images/`, and `workspace/files/documents/`. `saveAttachment()` takes a base64-encoded file, generates a timestamped filename with random suffix, writes it to the appropriate subdirectory, and returns metadata including the relative and absolute paths. `saveAudio()` does the same for voice recordings.                                                                                                                                                                  |
| `widget.js`      | Vanilla JavaScript snippet (no framework dependencies). Loaded by the shell (and by `workspace/client/index.html` in plain-Vite dev). Creates three DOM elements: (1) a floating circular bubble with the Morphy canvas avatar animation (sprites served from `supervisor/public/`), (2) a backdrop overlay, and (3) a slide-out side panel containing an iframe pointed at `/bloby/`. Handles open/close toggling, unread badges, voice-recording hand-off, mobile responsiveness, and escape-key dismissal.                                                                        |

---

### 2.3 `/supervisor/chat/` -- Pre-built Chat SPA

The chat UI is a standalone React single-page application. It runs inside an iframe embedded by `widget.js` and communicates with the supervisor via WebSocket. It is built separately from the dashboard and ships pre-compiled in `dist-chat/`.

```plain
supervisor/chat/
  chat.html              HTML entry point for the chat interface
  chat-main.tsx          React entry point for the chat app
  onboard.html           HTML entry point for the onboarding wizard
  onboard-main.tsx       React entry point for onboarding (renders OnboardWizard)
  OnboardWizard.tsx      Full onboarding wizard component -- AI setup, config, relay registration
  ARCHITECTURE.md        Internal architecture notes on network topology and WS-vs-HTTP decisions
  src/
    components/
      LoginScreen.tsx     Password + 2FA login screen with trusted device support
      Chat/
        AudioBubble.tsx   Audio message playback bubble with waveform visualization
        AuthedImage.tsx   <img> for /api/files/* attachments, fetched with the auth token
        BlobyImageCard.tsx  Image card for agent-sent images (authenticated fetch + download)
        BlobyTextCard.tsx   Collapsible rich-text card rendered with Streamdown markdown
        ChatView.tsx      Top-level chat view container (renders MessageList + InputBar)
        EnvForm.tsx       Inline form the agent uses to collect .env secrets from the user
        HeadphonesAnimation.tsx  Voice-mode avatar animation (config-driven sprite clips)
        ImageLightbox.tsx Full-screen image viewer for image attachments
        InputBar.tsx      Chat input bar -- text, voice recording, file attachments, whisper
        MessageBubble.tsx Individual message bubble with markdown rendering and attachment display
        MessageList.tsx   Scrollable message list with auto-scroll and infinite scroll (load more)
        MorphyActionCard.tsx  Card for <morphy_action> Mac actions (spotlight, point, ...)
        NotchCard.tsx     Card for <notch_html> / <notch_card> Mac notch payloads
        TypingIndicator.tsx Animated typing dots indicator
    hooks/
      useChat.ts          Base chat hook -- defines ChatMessage, ToolActivity, Attachment types and core chat logic
      useBlobyChat.ts     Morphy-specific chat hook -- loads/persists messages via worker API, handles cross-device sync
      useSpeechRecognition.ts  Browser speech-to-text hook for voice input
    lib/
      auth.ts             Auth token management (localStorage) and `authFetch()` wrapper that auto-handles 401s
      authedFile.ts       Resolves protected /api/files/* paths into blob URLs fetched with the auth token
      ws-client.ts        WebSocket client class with auto-reconnect, message queuing, heartbeat, and auth token injection
    styles/
      globals.css         Global CSS with Tailwind v4 imports and CSS custom properties (dark theme)
```

#### Key architectural decisions

- The chat SPA is **completely isolated** from the dashboard. It has its own React tree, its own styles, its own WebSocket connection.
- All mutations (saving settings, etc.) are sent over the WebSocket rather than HTTP POST. The supervisor's WS handler calls the worker API in-process, so chat behavior is identical on localhost and through the relay.
- The onboarding wizard (`OnboardWizard.tsx`) is reusable -- it can be rendered both as the initial setup flow (in its own iframe at `/bloby/onboard.html`) and from within the chat settings menu.

---

### 2.4 `/worker/` -- Worker API

The worker is an Express app that handles authentication, database operations, AI provider auth flows, and all configuration endpoints. It runs **in-process**: `worker/index.ts` exports `createWorkerApp()`, which the supervisor mounts on its own HTTP server. There is no separate worker process or port.

```plain
worker/
  index.ts            Express API app -- createWorkerApp() with all REST endpoints for auth, chat, settings, files
  db.ts               SQLite database layer (better-sqlite3) -- schema, migrations, all DB operations
  claude-auth.ts      Claude OAuth PKCE flow -- authenticates via claude.ai for Anthropic subscription users
  codex-auth.ts       Codex OAuth PKCE flow -- authenticates via OpenAI for ChatGPT Plus/Pro subscription users
  prompts/
    bloby-system-prompt.txt        Base system prompt for the Claude harness
    bloby-system-prompt-codex.txt  Base system prompt for the Codex harness
    bloby-system-prompt-pi.txt     Base system prompt for the Pi harness
    prompt-assembler.ts            Dynamic prompt assembly -- applies fragments to the base prompt
    prompt-conditions.ts           Condition registry that decides which fragments apply
    prompt-fragments.json          Fragment definitions (replace / remove / append on marker blocks)
    DYNAMIC-PROMPTS.md             Playbook for the dynamic prompt system
```

#### File-by-file breakdown

| File                              | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`                        | Exports `createWorkerApp()`, the Express app the supervisor mounts in-process. Password hashing (scrypt), TOTP-based 2FA with recovery codes, session management, conversation CRUD, message storage, settings management, push notification setup (web-push), authenticated file serving, and relay handle endpoints (availability check, registration, change, release). Auth is secure by default: once a password is set, `/api` routes require a valid session. Imports auth flows from `claude-auth.ts`, `codex-auth.ts`, and the Pi harness's auth helpers. |
| `db.ts`                           | SQLite database using `better-sqlite3`. Schema defines tables: `conversations`, `messages`, `settings`, `sessions`, `push_subscriptions`, `trusted_devices`. Stores data in `~/.morphy/memory.db`. Exports functions: `initDb`, `closeDb`, `listConversations`, `createConversation`, `deleteConversation`, `getMessages`, `addMessage`, `getSetting`, `setSetting`, `createSession`, `getSession`, push subscription CRUD, trusted device CRUD, and more. |
| `claude-auth.ts`                  | Implements OAuth 2.0 PKCE flow for Anthropic's Claude. User signs in at `claude.ai`, receives a code, pastes it back. Stores credentials in `~/.claude/.credentials.json`; on macOS the Keychain is the source of truth. Exposes `startClaudeOAuth()`, `exchangeClaudeCode()`, `getClaudeAuthStatus()`, `readClaudeAccessToken()`.                                                                                                                        |
| `codex-auth.ts`                   | Implements OAuth 2.0 PKCE for OpenAI's Codex/ChatGPT as a **paste-back flow**: no local callback server runs. The browser redirects to an unreachable `localhost:1455` callback URL; the user pastes that URL (or just the code) back into the wizard for token exchange. Also supports a device-code login. Stores credentials in `~/.codex/auth.json` in the same shape the Codex CLI writes (a legacy `codedeck-auth.json` is migrated automatically). Exposes `startCodexOAuth()`, `exchangeCodexCode()`, `cancelCodexOAuth()`, `getCodexAuthStatus()`, and the device-code functions. |
| `prompts/`                        | One base system prompt per harness, each carrying the same `<!-- dynamic:* -->` marker blocks. `prompt-assembler.ts` evaluates the conditions in `prompt-conditions.ts` and applies the matching fragments from `prompt-fragments.json` (replace / remove / append) to produce the final prompt injected into every agent query. The prompt defines the agent's personality, capabilities, coding rules, memory system, and workspace conventions. This is what makes Morphy "Morphy."                                                                     |

---

### 2.5 `/shared/` -- Shared Utilities

Utility modules imported by both the supervisor and worker. No runtime-specific code -- these are pure library functions.

```plain
shared/
  config.ts           Configuration loader/saver -- reads/writes ~/.morphy/config.json
  paths.ts            Central path definitions -- PKG_DIR, DATA_DIR, WORKSPACE_DIR, all derived paths
  relay.ts            Morphy Relay API client -- handle registration, availability checks, carrier tickets
  ai.ts               AI provider abstraction -- unified streaming interface for OpenAI, Anthropic, and Ollama
  logger.ts           Minimal colored console logger -- info, warn, error, ok with timestamps
```

#### File-by-file breakdown

| File        | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config.ts` | Defines the `BotConfig` interface: `port` (default 7400), `username`, `ai` (provider: openai / anthropic / ollama / pi, model, apiKey, baseUrl), `tunnel` (mode: `'relay'`, the default carrier connection, or `'off'` for managed/hosted bots), `relay` (token, tier, url), `wallet`, and per-channel `channels` config (WhatsApp, Telegram, Alexa). `loadConfig()` reads `~/.morphy/config.json` and applies one-shot migrations: legacy cloudflared `quick`/`named` tunnel modes become `relay`, and superseded model ids are bumped. `saveConfig()` writes atomically with a `.bak` mirror. |
| `paths.ts`  | Computes and exports all critical paths: `PKG_DIR` (package install directory), `DATA_DIR` (`~/.morphy/`), `WORKSPACE_DIR` (`{PKG_DIR}/workspace`, overridable via `MORPHY_WORKSPACE`). The `paths` object maps logical names to absolute paths: `config`, `db`, `widgetJs`, `supervisorPublic`, `files`, `filesAudio`, `filesImages`, `filesDocuments`.                                                                                                                                 |
| `relay.ts`  | HTTP client for the Morphy Relay cloud service at `https://api.morphyagent.com/api`. Functions: `registerHandle(username, tier)` -- registers a public handle, `checkAvailability(username)` -- checks if a handle is taken, `claimReservedHandle()` -- claims a purchased premium handle, `releaseHandle(token)` -- releases a handle, `fetchTicket(token)` -- mints the short-lived Ed25519 carrier ticket the bot presents when dialing its Durable Object, `reportWallet()` -- links the bot's wallet address, `disconnect(token)` -- best-effort offline mark on shutdown. There is no heartbeat: presence is the live carrier socket. |
| `ai.ts`     | Provider-agnostic AI streaming interface. Defines `AiProvider` interface with a `chat()` method that accepts messages, model name, and callbacks (`onToken`, `onDone`, `onError`). Factory function `createProvider(provider, apiKey, baseUrl)` returns an implementation for `openai`, `anthropic`, or `ollama`. All providers use raw `fetch()` with SSE streaming -- zero external AI SDK dependencies. Tracks token usage (`tokensIn`, `tokensOut`).                                 |
| `logger.ts` | Simple structured logger. All output goes to `console.log`/`console.warn`/`console.error` with ANSI color codes and `HH:MM:SS` timestamps. Levels: `log.info()` (cyan), `log.warn()` (yellow), `log.error()` (red), `log.ok()` (green).                                                                                                                                                                                                                                                  |

---

### 2.6 `/workspace/` -- Agent-Editable Workspace

The workspace is the agent's playground. The AI agent can read, write, and modify any file in this directory. It contains the user-facing dashboard app, the backend template, memory files, configuration files, skills, and uploaded files.

```
workspace/
  MYSELF.md           Agent self-description -- personality, wake-up sequence, self-evolving identity
  MYHUMAN.md          Notes about the user -- preferences, communication style, context (agent-maintained)
  MEMORY.md           Long-term memory -- persistent facts and context across conversations
  PULSE.json          Pulse configuration -- autonomous check-in interval and quiet hours
  CRONS.json          Scheduled tasks -- array of cron expressions with task descriptions
  package.json        Workspace-scoped dependencies (Express, better-sqlite3) for the user backend
  client/             React dashboard app (see section 2.6.1)
  backend/            Express backend template (see section 2.6.2)
  skills/             Plugin directories for agent skills (see section 2.6.3)
  files/              Attachment storage (created at runtime, not in git)
```

#### Memory files

| File         | Purpose                                                                                                                                                                                                                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MYSELF.md`  | The agent's self-identity document. Starts with a default template describing the agent's nature as more than a code assistant. Contains a wake-up sequence (memory files are auto-injected, check daily notes, check `MEMORY.md`). The agent is encouraged to update this file as it learns about itself. |
| `MYHUMAN.md` | The agent's notes about its human user. Initially empty. The agent fills this in over time with the user's preferences, expertise level, communication style, and personal context.                                                                                                                        |
| `MEMORY.md`  | Long-term memory store. Initially empty. The agent writes persistent facts, project context, and important information here. Injected into the system prompt on every query.                                                                                                                               |

#### Configuration files

| File         | Purpose                                                                                                                                                                                 |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PULSE.json` | Controls autonomous "pulse" check-ins. Fields: `enabled` (boolean), `intervalMinutes` (default 30), `quietHours` (start/end times, default 23:00-07:00). The scheduler reads this to decide when the agent should proactively check in. |
| `CRONS.json` | Array of scheduled task definitions. Each entry: `id` (string), `schedule` (cron expression), `task` (natural language description), `enabled` (boolean), `oneShot` (optional, auto-disable after firing). Default: empty array `[]`.   |

---

#### 2.6.1 `/workspace/client/` -- React Dashboard

The dashboard is a Vite-powered React SPA. It is the main user-facing interface -- what the user sees when they visit their Morphy instance. The agent can modify any file here to build custom apps.

```
workspace/client/
  index.html                Dashboard HTML shell -- loads main.tsx and registers the service worker
  public/
    manifest.json           PWA manifest -- app name, theme color, icon references
    sw.js                   Service worker source (at runtime the supervisor serves its own embedded /sw.js)
    morphy_bounce.webm      Morphy avatar bounce animation (WebM with alpha)
    morphy_bounce.mov       Morphy avatar bounce animation (HEVC with alpha, for Safari)
    icons/
      claude.png            Claude/Anthropic provider icon
      codex.png             Codex/OpenAI provider icon
      openai.svg            OpenAI provider icon
      pi.svg                Pi provider icon
  src/
    main.tsx                React entry point -- renders <App /> into #root with StrictMode
    App.tsx                 Root component -- checks onboard status, renders DashboardLayout and the first-run workspace tour
    styles/
      globals.css           Global stylesheet with Tailwind v4 CSS imports and dark theme variables
    lib/
      utils.ts              Utility functions -- `cn()` for merging Tailwind classes (clsx + tailwind-merge)
    components/
      ErrorBoundary.tsx     React error boundary -- catches render errors and shows crash screen
      Dashboard/
        DashboardPage.tsx   Main dashboard page component (the default view)
      Layout/
        DashboardLayout.tsx Top-level layout wrapper with sidebar and content area
        Sidebar.tsx         Navigation sidebar component
        Footer.tsx          Footer component
        MobileNav.tsx       Mobile navigation component (hamburger menu)
      ui/
        avatar.tsx          shadcn/ui Avatar component
        badge.tsx           shadcn/ui Badge component
        button.tsx          shadcn/ui Button component (with variants via CVA)
        card.tsx            shadcn/ui Card component
        dialog.tsx          shadcn/ui Dialog component (Radix UI)
        dropdown-menu.tsx   shadcn/ui Dropdown Menu component (Radix UI)
        input.tsx           shadcn/ui Input component
        scroll-area.tsx     shadcn/ui Scroll Area component (Radix UI)
        select.tsx          shadcn/ui Select component (Radix UI)
        separator.tsx       shadcn/ui Separator component (Radix UI)
        sheet.tsx           shadcn/ui Sheet component (slide-out panel, Radix UI)
        skeleton.tsx        shadcn/ui Skeleton loading component
        switch.tsx          shadcn/ui Switch toggle component (Radix UI)
        tabs.tsx            shadcn/ui Tabs component (Radix UI)
        textarea.tsx        shadcn/ui Textarea component
        tooltip.tsx         shadcn/ui Tooltip component (Radix UI)
```

The shared Morphy brand assets (avatar sprites, PWA icons, notification badge) live in `supervisor/public/` and are served by the supervisor, so the agent can freely rebuild the workspace without touching them.

**How the dashboard loads:**

1. Browser navigates to the Morphy URL (local or through the relay).
2. The supervisor serves the shell page (`shell.ts`) for the top-level navigation. The shell loads `widget.js` and a same-origin iframe hosting the workspace app (the iframe src carries `?__bloby_frame=1` so the supervisor routes it to the workspace instead of the shell).
3. Workspace requests are proxied to the in-process Vite dev server, which serves `workspace/client/index.html` and `src/main.tsx`. `index.html` registers the service worker (`/sw.js`, served by the supervisor).
4. `widget.js` creates the floating Morphy bubble and the slide-out panel with the chat iframe at `/bloby/`.
5. `App.tsx` checks if onboarding is complete; if not, it shows the onboard iframe overlay (`/bloby/onboard.html`).
6. The shell and widget listen for postMessage events from the Morphy iframes: `bloby:onboard-complete`, `bloby:app-ready`, `bloby:new-message`, `bloby:close`, `bloby:version-changed`, and friends.

---

#### 2.6.2 `/workspace/backend/` -- Express Backend Template

A minimal Express backend that the agent can extend with custom API routes. Runs as a child process on port `basePort + 4`.

```
workspace/backend/
  index.ts            Express server template -- health check endpoint, SQLite database, .env loader
```

| File       | Purpose                                                                                                                                                                                                                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `index.ts` | Scaffolded Express server. Reads port from `BACKEND_PORT` env var (default 7404). Manually parses `workspace/.env` for environment variables (no dotenv dependency). Opens an SQLite database at `workspace/app.db` with WAL mode. Includes a `/api/health` endpoint and a 404 catch-all. The agent adds custom routes here as the user requests features. |

---

#### 2.6.3 `/workspace/skills/` -- Skill Folders

Skills are modular agent capabilities. Each skill is a flat folder under `workspace/skills/` named after the skill, with a `SKILL.md` at its core.

```
workspace/skills/
  {skill-name}/
    SKILL.md              Skill definition -- YAML frontmatter (name, description) + Markdown instructions
    skill.json            Morphy marketplace metadata (optional)
    SCRIPT.md             Customer-facing persona for channel business/assistant modes (optional)
    references/           Supporting documents (optional)
    scripts/              Helper scripts (optional)
    assets/               Static assets (optional)
```

The `SKILL.md` frontmatter holds two mandatory keys: `name` (must equal the folder name) and `description` (the routing/trigger text). When a `skill.json` is present, its `description` must stay in sync with the frontmatter. Each skill's name and description are always in the agent's context; the full `SKILL.md` body is loaded only when the skill is actually used (progressive disclosure). Shared loading plumbing lives in `supervisor/harnesses/skills.ts`.

---

#### 2.6.4 `/workspace/files/` -- Attachment Storage

Created at runtime by `file-saver.ts`. Not present in git.

```
workspace/files/              (created at runtime)
  audio/                      Voice message recordings
  images/                     Uploaded and received images (timestamped filenames)
  documents/                  Uploaded documents (PDFs, text files, CSVs, etc.)
```

Files are named with the pattern `YYYYMMDD_HHMMSS_{random-hex}.{ext}` to avoid collisions.

---

### 2.7 `/scripts/` -- Installation Scripts

```
scripts/
  install              Unix installer (symlink to install.sh)
  install.sh           Unix installer -- downloads Node.js + Morphy into ~/.morphy
  install.ps1          Windows installer (PowerShell) -- same logic as install.sh for Windows
  postinstall.js       npm postinstall hook -- copies source files to ~/.morphy, installs deps, ships chat UI
```

| File                     | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `install` / `install.sh` | Standalone curl installer (`curl -fsSL https://morphyagent.com/install \| sh`). Downloads Node.js v22 (checksum-verified) if no suitable system Node is present, fetches the latest `morphyagent` tarball from the npm registry into `~/.morphy/`, installs dependencies, copies the pre-built chat UI, and creates a `morphy` launcher in `/usr/local/bin/` or `~/.local/bin/`. Works on Linux, macOS, and ARM (Raspberry Pi).                                                                             |
| `install.ps1`            | PowerShell equivalent (`irm https://morphyagent.com/install.ps1 \| iex`). Same logic adapted for Windows: downloads Node.js, sets up `~/.morphy/`, installs dependencies.                                                                                                                                                                                                                                                                                                                                       |
| `postinstall.js`         | Runs after `npm install -g morphyagent`. Copies application code directories (`bin/`, `supervisor/`, `worker/`, `shared/`, `scripts/`) to `~/.morphy/`, preserving the workspace on updates (only copies the workspace template on first install). Installs production dependencies in `~/.morphy/` and workspace dependencies in `~/.morphy/workspace/`. Copies or builds `dist-chat/`. Creates the `morphy` symlink. Includes guards to skip execution during development (if `.git` exists) and to prevent infinite loops (if already running inside `~/.morphy/`). |

---

### 2.8 `/dist-chat/` -- Pre-built Chat UI Bundles

Production build output of `vite.chat.config.ts`. Gitignored; built at publish time by the `prepublishOnly` script and shipped with the npm package so users do not need to build from source.

```
dist-chat/
  chat.html                  Production entry point for the chat interface
  onboard.html               Production entry point for the onboarding wizard
  assets/                    Hashed JS/CSS bundles -- app code, vendor chunks, compiled Tailwind CSS,
                             plus per-language syntax-highlighting chunks loaded on demand
```

These bundles are hashed for cache-busting. The supervisor serves them under the `/bloby/` URL path.

---
