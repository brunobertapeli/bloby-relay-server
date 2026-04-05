---
title: "Directory Tree"
---

### 2.1 `/bin/` -- CLI Entry Point

```plain
bin/
  cli.js            The `bloby` command-line interface (59 KB, bundled JS)
```

| File     | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cli.js` | The executable CLI. Registered as `"bloby"` in `package.json`'s `bin` field. Determines whether it is running in dev mode (has `.git`) or production mode (operates from `~/.bloby/`). Handles all subcommands: `bloby start`, `bloby init`, `bloby daemon install/uninstall/status`, `bloby tunnel`, etc. Supports systemd (Linux) and launchd (macOS) daemon management. Accepts `--hosted` flag for cloud deployments. |

---

### 2.2 `/supervisor/` -- Core Supervisor Process

The supervisor is the central orchestrator. It boots the HTTP server, spawns child processes (worker, backend), manages tunnels, schedules cron jobs, and serves both the dashboard and the chat UI.

```plain
supervisor/
  index.ts           Main supervisor entry point (37 KB) -- HTTP server, WebSocket handler, static file serving
  worker.ts          Worker child process manager -- spawns, monitors, auto-restarts the worker
  backend.ts         Backend child process manager -- spawns, monitors, auto-restarts the user's Express backend
  tunnel.ts          Cloudflare Tunnel manager -- installs cloudflared, starts quick/named tunnels
  vite-dev.ts        Vite dev server launcher -- starts HMR dev server for the dashboard in development mode
  bloby-agent.ts     Claude Agent SDK wrapper -- handles agent queries from the chat UI using claude-agent-sdk
  scheduler.ts       Pulse and cron scheduler -- checks timing every 60s, triggers autonomous agent actions
  file-saver.ts      File attachment handler -- saves uploaded images and documents to workspace/files/
  widget.js          Chat widget injector -- vanilla JS that creates the floating bubble and slide-out chat panel
  chat/              Pre-built chat SPA source (see section 2.3)
```

#### File-by-file breakdown

| File             | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`       | **The heart of Bloby.** Creates an HTTP server on the configured port (default 3000). Serves the dashboard from `dist/` (production) or proxies to Vite dev server (development). Serves the chat UI from `dist-bloby/` under the `/bloby/` path. Runs a WebSocket server for real-time chat communication. Orchestrates startup: spawns the worker on port+1, backend on port+4, starts Cloudflare tunnel, begins heartbeat to the relay, starts the scheduler. Handles graceful shutdown (SIGINT/SIGTERM). Embeds a service worker for PWA installability and push notifications. |
| `worker.ts`      | Spawns the worker (`worker/index.ts`) as a child process using `tsx/esm` loader. Exposes `spawnWorker(port)`, `stopWorker()`, `isWorkerAlive()`. Auto-restarts on unexpected exit (up to 3 times with exponential backoff, resets after 30s of stable runtime).                                                                                                                                                                                                                                                                                                                     |
| `backend.ts`     | Spawns the user's backend (`workspace/backend/index.ts`) as a child process. Same restart logic as `worker.ts`. Logs stdout/stderr to `workspace/.backend.log`. Exposes `spawnBackend(port)`, `stopBackend()`, `isBackendAlive()`, `resetBackendRestarts()`. Port is `basePort + 4`.                                                                                                                                                                                                                                                                                                |
| `tunnel.ts`      | Manages Cloudflare Tunnel for public access. `installCloudflared()` downloads the binary to `~/.bloby/bin/cloudflared` if not present. `startTunnel(port)` starts a quick tunnel and returns the assigned `*.trycloudflare.com` URL. `startNamedTunnel(configPath, name)` starts a persistent named tunnel with a custom domain. Supports `isTunnelAlive()` health checks and `restartTunnel()`/`restartNamedTunnel()` for recovery.                                                                                                                                                |
| `vite-dev.ts`    | Creates an in-process Vite dev server for the dashboard on port `basePort + 2`. Attaches HMR WebSocket to the supervisor's HTTP server so hot reload works through the tunnel. Pre-warms module transforms on startup. Only active during development (`npm run dev`).                                                                                                                                                                                                                                                                                                              |
| `bloby-agent.ts` | Lightweight wrapper around `@anthropic-ai/claude-agent-sdk`. Each conversation turn gets a fresh context with memory files (`MYSELF.md`, `MYHUMAN.md`, `MEMORY.md`) and recent conversation history injected into the system prompt. Reads the system prompt from `worker/prompts/bloby-system-prompt.txt`. Supports attachments (images, files) via base64 encoding. Manages active queries with abort controllers for cancellation.                                                                                                                                               |
| `scheduler.ts`   | Reads `workspace/PULSE.json` and `workspace/CRONS.json` every 60 seconds. Pulse: triggers autonomous agent actions at a configurable interval (default 30 min) with quiet hours support. Crons: evaluates cron expressions (via `cron-parser`) and fires `startBlobyAgentQuery` when schedules match. Supports one-shot crons that auto-disable after firing.                                                                                                                                                                                                                       |
| `file-saver.ts`  | Handles file uploads from chat. `ensureFileDirs()` creates `workspace/files/audio/`, `workspace/files/images/`, and `workspace/files/documents/`. `saveAttachment()` takes a base64-encoded file, generates a timestamped filename with random suffix, writes it to the appropriate subdirectory, and returns metadata including the relative and absolute paths.                                                                                                                                                                                                                   |
| `widget.js`      | Vanilla JavaScript snippet (no framework dependencies). Injected into the dashboard via a `<script>` tag in `workspace/client/index.html`. Creates three DOM elements: (1) a floating circular bubble with the Bloby avatar video, (2) a backdrop overlay, and (3) a slide-out side panel containing an iframe pointed at `/bloby/bloby.html`. Handles open/close toggling, mobile responsiveness, and escape-key dismissal.                                                                                                                                                        |

---

### 2.3 `/supervisor/chat/` -- Pre-built Chat SPA

The chat UI is a standalone React single-page application. It runs inside an iframe embedded by `widget.js` and communicates with the supervisor via WebSocket. It is built separately from the dashboard and ships pre-compiled in `dist-bloby/`.

```plain
supervisor/chat/
  bloby.html              HTML entry point for the chat interface
  bloby-main.tsx          React entry point for the chat app (21 KB)
  onboard.html            HTML entry point for the onboarding wizard
  onboard-main.tsx        React entry point for onboarding (renders OnboardWizard)
  OnboardWizard.tsx       Full onboarding wizard component (94 KB) -- AI setup, config, relay registration
  ARCHITECTURE.md         Internal architecture doc explaining network topology and WS-vs-HTTP decisions
  src/
    components/
      LoginScreen.tsx     Password + 2FA login screen with trusted device support
      Chat/
        AudioBubble.tsx   Audio message playback bubble with waveform visualization
        ChatView.tsx      Top-level chat view container (renders MessageList + InputBar)
        ImageLightbox.tsx Full-screen image viewer for image attachments
        InputBar.tsx      Chat input bar (19 KB) -- text, voice recording, file attachments, whisper
        MessageBubble.tsx Individual message bubble with markdown rendering and attachment display
        MessageList.tsx   Scrollable message list with auto-scroll and infinite scroll (load more)
        TypingIndicator.tsx Animated typing dots indicator
    hooks/
      useChat.ts          Base chat hook -- defines ChatMessage, ToolActivity, Attachment types and core chat logic
      useBlobyChat.ts     Bloby-specific chat hook -- loads/persists messages via worker API, handles cross-device sync
    lib/
      auth.ts             Auth token management (localStorage) and `authFetch()` wrapper that auto-handles 401s
      ws-client.ts        WebSocket client class with auto-reconnect, message queuing, heartbeat, and auth token injection
    styles/
      globals.css         Global CSS with Tailwind v4 imports and CSS custom properties (dark theme)
```

#### Key architectural decisions

- The chat SPA is **completely isolated** from the dashboard. It has its own React tree, its own styles, its own WebSocket connection.
- POST requests from the chat iframe fail through the relay/tunnel chain. All mutations (saving settings, etc.) are sent over WebSocket instead. The supervisor's WS handler makes local HTTP calls to the worker, bypassing the relay entirely.
- The onboarding wizard (`OnboardWizard.tsx`) is reusable -- it can be rendered both as the initial setup flow (in its own iframe at `/bloby/onboard.html`) and from within the chat settings menu.

---

### 2.4 `/worker/` -- Worker API

The worker is an Express REST API server that handles authentication, database operations, AI provider routing, and all configuration endpoints. It runs as a child process on port `basePort + 1`.

```plain
worker/
  index.ts            Express API server (28 KB) -- all REST endpoints for auth, chat, settings, files
  db.ts               SQLite database layer (better-sqlite3) -- schema, migrations, all DB operations
  claude-auth.ts      Claude OAuth PKCE flow -- authenticates via claude.ai for Anthropic subscription users
  codex-auth.ts       Codex OAuth PKCE flow -- authenticates via OpenAI for ChatGPT Plus/Pro subscription users
  prompts/
    bloby-system-prompt.txt    The agent's system prompt (20 KB) -- personality, capabilities, routing rules, memory system
```

#### File-by-file breakdown

| File                              | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`                        | Express server with all API routes. Password hashing (scrypt), TOTP-based 2FA, session management, conversation CRUD, message storage, settings management, push notification setup (web-push), file upload handling, relay registration (handle availability, registration, release). Imports auth flows from `claude-auth.ts` and `codex-auth.ts`.                                                                                                      |
| `db.ts`                           | SQLite database using `better-sqlite3`. Schema defines tables: `conversations`, `messages`, `settings`, `sessions`, `push_subscriptions`, `trusted_devices`. Stores data in `~/.bloby/memory.db`. Exports functions: `initDb`, `closeDb`, `listConversations`, `createConversation`, `deleteConversation`, `getMessages`, `addMessage`, `getSetting`, `setSetting`, `createSession`, `getSession`, push subscription CRUD, trusted device CRUD, and more. |
| `claude-auth.ts`                  | Implements OAuth 2.0 PKCE flow for Anthropic's Claude. User signs in at `claude.ai`, receives a code, pastes it back. Stores credentials in `~/.claude/.credentials.json`. Uses macOS Keychain when available. Exposes `startClaudeOAuth()`, `exchangeClaudeCode()`, `getClaudeAuthStatus()`, `readClaudeAccessToken()`.                                                                                                                                  |
| `codex-auth.ts`                   | Implements OAuth 2.0 PKCE flow for OpenAI's Codex/ChatGPT. Spins up a temporary HTTP server on port 1455 to capture the OAuth callback. Stores credentials in `~/.codex/codedeck-auth.json`. Exposes `startCodexOAuth()`, `cancelCodexOAuth()`, `getCodexAuthStatus()`, `readCodexAccessToken()`.                                                                                                                                                         |
| `prompts/bloby-system-prompt.txt` | The master system prompt injected into every Claude Agent SDK query. Defines the agent's personality, capabilities, coding rules, memory system, dashboard architecture, file organization, tool usage patterns, and workspace conventions. This is what makes Bloby "Bloby."                                                                                                                                                                             |

---

### 2.5 `/shared/` -- Shared Utilities

Utility modules imported by both the supervisor and worker. No runtime-specific code -- these are pure library functions.

```plain
shared/
  config.ts           Configuration loader/saver -- reads/writes ~/.bloby/config.json
  paths.ts            Central path definitions -- PKG_DIR, DATA_DIR, WORKSPACE_DIR, all derived paths
  relay.ts            Bloby Relay API client -- handle registration, availability checks, heartbeat, tunnel URL updates
  ai.ts               AI provider abstraction -- unified streaming interface for OpenAI, Anthropic, and Ollama
  logger.ts           Minimal colored console logger -- info, warn, error, ok with timestamps
```

#### File-by-file breakdown

| File        | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config.ts` | Defines `BotConfig` interface: `port`, `username`, `ai` (provider, model, apiKey, baseUrl), `tunnel` (mode: off/quick/named, name, domain, configPath), `relay` (token, tier, url), `tunnelUrl`. `loadConfig()` reads from `~/.bloby/config.json` with backward compatibility migration. `saveConfig()` writes atomically.                                                                                                                                                               |
| `paths.ts`  | Computes and exports all critical paths: `PKG_DIR` (package install directory), `DATA_DIR` (`~/.bloby/`), `WORKSPACE_DIR` (`{PKG_DIR}/workspace`). The `paths` object maps logical names to absolute paths: `config`, `db`, `widgetJs`, `cloudflared`, `files`, `filesAudio`, `filesImages`, `filesDocuments`.                                                                                                                                                                           |
| `relay.ts`  | HTTP client for the Bloby Relay cloud service at `https://api.bloby.bot/api`. Functions: `registerHandle(username, tier)` -- registers a public handle, `checkAvailability(username)` -- checks if a handle is taken, `releaseHandle(token)` -- releases a handle, `updateTunnelUrl(token, tunnelUrl)` -- tells the relay where to route traffic, `startHeartbeat(token, tunnelUrl)` -- pings the relay every 30s to stay online, `disconnect(token)` -- graceful shutdown notification. |
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
  client/             React dashboard app (see section 2.6.1)
  backend/            Express backend template (see section 2.6.2)
  skills/             Plugin directories for agent skills (see section 2.6.3)
  files/              Attachment storage (created at runtime, not in git)
```

#### Memory files

| File         | Purpose                                                                                                                                                                                                                                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MYSELF.md`  | The agent's self-identity document. Starts with a default template describing the agent's nature as more than a code assistant. Contains a wake-up sequence (memory files are auto-injected, check daily notes, check `MEMORY.md`). The agent is encouraged to update this file as it learns about itself. |
| `MYHUMAN.md` | The agent's notes about its human user. Initially empty. The agent fills this in over time with the user's preferences, expertise level, communication style, and personal context.                                                                                                                        |
| `MEMORY.md`  | Long-term memory store. Initially empty. The agent writes persistent facts, project context, and important information here. Injected into the system prompt on every query.                                                                                                                               |

#### Configuration files

| File         | Purpose                                                                                                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PULSE.json` | Controls autonomous "pulse" check-ins. Fields: `enabled` (boolean), `intervalMinutes` (default 30), `quietHours` (start/end times, default 23:00-07:00). The scheduler reads this to decide when the agent should proactively check in. |
| `CRONS.json` | Array of scheduled task definitions. Each entry: `id` (string), `schedule` (cron expression), `task` (natural language description), `enabled` (boolean), `oneShot` (optional, auto-disable after firing). Default: empty array `[]`.   |

---

#### 2.6.1 `/workspace/client/` -- React Dashboard

The dashboard is a Vite-powered React SPA. It is the main user-facing interface -- what the user sees when they visit their Bloby instance. The agent can modify any file here to build custom apps.

```
workspace/client/
  index.html                Dashboard HTML shell -- loads main.tsx, registers service worker, injects widget.js
  public/
    manifest.json           PWA manifest -- app name, theme color (#212121), icon references
    sw.js                   Service worker -- PWA installability, push notification handling
    bloby.png               Bloby logo (PNG, 44 KB)
    bloby_frame1.png        Bloby avatar static frame (PNG, 390 KB, used as fallback)
    bloby_say_hi.webm       Bloby avatar wave animation (WebM, 787 KB)
    bloby_tilts.webm        Bloby avatar tilt animation (WebM, 880 KB)
    bloby-badge.png         Notification badge icon (PNG, 3 KB)
    bloby-icon-192.png      PWA icon 192x192 (PNG, 27 KB)
    bloby-icon-512.png      PWA icon 512x512 (PNG, 115 KB)
    arrow.png               Onboarding arrow graphic (PNG, 1.4 MB)
    icons/
      claude.png            Claude/Anthropic provider icon (PNG, 27 KB)
      codex.png             Codex/OpenAI provider icon (PNG, 32 KB)
      openai.svg            OpenAI provider icon (SVG, 3 KB)
  src/
    main.tsx                React entry point -- renders <App /> into #root with StrictMode
    App.tsx                 Root component -- checks onboard status, renders DashboardLayout, handles rebuild events from chat iframe via postMessage
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

**How the dashboard loads:**

1. Browser navigates to the Bloby URL (local or through the relay).
2. The supervisor serves `workspace/client/index.html` (in production from `dist/`, in dev via Vite proxy).
3. `index.html` loads `src/main.tsx`, registers the service worker (`sw.js`), and injects `widget.js`.
4. `widget.js` creates the floating Bloby bubble and the slide-out panel with the chat iframe.
5. `App.tsx` checks if onboarding is complete; if not, it shows the onboard iframe overlay.
6. The app listens for postMessage events from the chat iframe: `bloby:rebuilding`, `bloby:rebuilt`, `bloby:build-error`, `bloby:onboard-complete`, `bloby:hmr-update`.

---

#### 2.6.2 `/workspace/backend/` -- Express Backend Template

A minimal Express backend that the agent can extend with custom API routes. Runs as a child process on port `basePort + 4`.

```
workspace/backend/
  index.ts            Express server template -- health check endpoint, SQLite database, .env loader
```

| File       | Purpose                                                                                                                                                                                                                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `index.ts` | Scaffolded Express server. Reads port from `BACKEND_PORT` env var (default 3004). Manually parses `workspace/.env` for environment variables (no dotenv dependency). Opens an SQLite database at `workspace/app.db` with WAL mode. Includes a `/health` endpoint and a 404 catch-all. The agent adds custom routes here as the user requests features. |

---

#### 2.6.3 `/workspace/skills/` -- Plugin Directories

Skills are modular agent capabilities structured as Claude plugin directories. Each skill follows a `{skill-name}/.claude-plugin/plugin.json` + `{skill-name}/skills/{skill-name}/SKILL.md` convention.

```
workspace/skills/
  code-reviewer/
    .claude-plugin/
      plugin.json         Plugin manifest (name, version, description)
    skills/
      code-reviewer/
        SKILL.md          Skill instructions for code review behavior
  daily-standup/
    .claude-plugin/
      plugin.json         Plugin manifest
    skills/
      daily-standup/
        SKILL.md          Skill instructions for daily standup summaries
  workspace-helper/
    .claude-plugin/
      plugin.json         Plugin manifest
    skills/
      workspace-helper/
        SKILL.md          Skill instructions for workspace management
```

Each skill's `plugin.json` defines metadata (name, version, description). The `SKILL.md` file contains natural language instructions that are injected into the agent's context when the skill is activated.

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
  install.sh           Unix installer -- downloads Node.js + Bloby into ~/.bloby (10 KB)
  install.ps1          Windows installer (PowerShell) -- same logic as install.sh for Windows (13 KB)
  postinstall.js       npm postinstall hook -- copies source files to ~/.bloby, installs deps, builds chat UI
```

| File                     | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `install` / `install.sh` | Standalone curl installer (`curl -fsSL https://bloby.bot/install \| sh`). Downloads Node.js v22.14.0 if not present, clones Bloby into `~/.bloby/`, installs dependencies, builds the chat UI, and creates a `bloby` symlink in `/usr/local/bin/` or `~/.local/bin/`. Works on Linux, macOS, and ARM (Raspberry Pi).                                                                                                                                                                                     |
| `install.ps1`            | PowerShell equivalent (`irm https://bloby.bot/install.ps1 \| iex`). Same logic adapted for Windows: downloads Node.js, sets up `~/.bloby/`, installs dependencies.                                                                                                                                                                                                                                                                                                                                       |
| `postinstall.js`         | Runs after `npm install -g bloby-bot`. Copies application code directories (`bin/`, `supervisor/`, `worker/`, `shared/`, `scripts/`) to `~/.bloby/`, preserving the workspace on updates (only copies workspace template on first install). Installs production dependencies in `~/.bloby/`. Copies or builds `dist-bloby/`. Creates the `bloby` symlink. Includes guards to skip execution during development (if `.git` exists) and to prevent infinite loops (if already running inside `~/.bloby/`). |

---

### 2.8 `/dist-bloby/` -- Pre-built Chat UI Bundles

Production build output of `vite.bloby.config.ts`. Shipped with the npm package so users do not need to build from source.

```
dist-bloby/
  bloby.html                  Production entry point for the chat interface
  onboard.html                Production entry point for the onboarding wizard
  assets/
    bloby-Bcd5tJrt.js         Chat app bundle (838 KB) -- all React components, hooks, libraries
    globals-CMrTFJSE.js       Shared vendor bundle (367 KB) -- React, Radix UI, framer-motion, etc.
    globals-Bs_wR6rP.css      Compiled CSS (42 KB) -- Tailwind output + custom styles
    onboard-BSlNrxVH.js       Onboard entry chunk (301 B) -- tiny bootstrap for the wizard
```

These bundles are hashed for cache-busting. The supervisor serves them under the `/bloby/` URL path.

---
