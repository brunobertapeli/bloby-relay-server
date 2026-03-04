import { useState, useEffect, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { HiBars3, HiXMark, HiChevronRight, HiEllipsisVertical } from 'react-icons/hi2'
import { FaGithub, FaDiscord, FaCopy, FaCheck, FaLink } from 'react-icons/fa'

const sections = [
  {
    group: 'Getting Started',
    items: [
      { slug: 'introduction', title: 'Introduction' },
      { slug: 'installation', title: 'Installation' },
      { slug: 'setup', title: 'Setup (fluxy init)' },
      { slug: 'onboarding', title: 'Onboarding Wizard' },
      { slug: 'first-conversation', title: 'First Conversation' },
    ],
  },
  {
    group: 'Core Concepts',
    items: [
      { slug: 'workspace', title: 'The Workspace' },
      { slug: 'chat', title: 'Chat Bubble' },
      { slug: 'memory', title: 'Memory System' },
      { slug: 'pulse-crons', title: 'Pulse & Scheduled Tasks' },
      { slug: 'pwa', title: 'PWA & Mobile' },
    ],
  },
  {
    group: 'Connectivity',
    items: [
      { slug: 'tunnels', title: 'Tunnels & Remote Access' },
      { slug: 'relay', title: 'Fluxy Relay' },
    ],
  },
  {
    group: 'Guides',
    items: [
      { slug: 'cli', title: 'CLI Commands' },
      { slug: 'daemon', title: 'Daemon & Auto-Start' },
      { slug: 'configuration', title: 'Configuration' },
      { slug: 'models', title: 'AI Models' },
      { slug: 'skills', title: 'Skills & Plugins' },
    ],
  },
  {
    group: 'Community',
    items: [
      { slug: 'contributing', title: 'Contributing' },
      { slug: 'faq', title: 'FAQ' },
    ],
  },
]

const docs = {
  introduction: `
# Introduction

Welcome to Fluxy — vibe coding in your pocket.

Think of it as an AI coding agent like OpenClaw, but instead of living in your terminal, Fluxy lives in its own full-stack app. You install it on any machine that stays on (Mac Mini, VPS, Raspberry Pi), and you get a URL you can visit from your phone, laptop, anywhere. Behind that URL is a PWA with a chat bubble — your direct line to the agent — and a workspace the agent builds and evolves through conversation.

## What makes Fluxy different

Most AI coding agents give you a terminal or a chat window. Fluxy gives the agent an entire application — frontend, backend, and database — that it shapes into whatever you need.

- **It's an agent and a playground.** Like OpenClaw, but with its own full-stack codebase to build anything in.
- **Pocket vibe coding.** Talk to your agent from your phone, by text or voice, and watch it build real software.
- **The chat never dies.** It runs in an isolated iframe — even if the agent breaks the workspace, you can always reach it and ask for fixes.
- **Mini apps on demand.** "I need a calorie counter." The agent builds one and adds it to your sidebar.
- **Runs on your hardware.** Your data never leaves your machine. Access it from anywhere via secure tunnels.
- **It remembers you.** Memory files keep context across sessions.
- **It wakes up on its own.** Scheduled tasks and periodic pulses keep it proactive.
- **Open source.** Fork it, extend it, make it yours.

## How it works

1. Install Fluxy on a machine that stays on
2. Run \`fluxy init\` — it sets up everything and gives you a URL
3. Visit the URL from any device, complete onboarding (AI provider, password, 2FA)
4. Talk to it. It builds what you ask for. The workspace grows with every conversation.
`,

  installation: `
# Installation

Fluxy runs on macOS, Windows, and Linux. Pick your method:

## macOS / Linux

\`\`\`bash
curl -fsSL https://www.fluxy.bot/install | sh
\`\`\`

This downloads Fluxy, bundles Node.js if needed, and installs everything to \`~/.fluxy/\`. The \`fluxy\` command is added to your PATH automatically.

## Windows

\`\`\`powershell
iwr -useb https://www.fluxy.bot/install.ps1 | iex
\`\`\`

## npm

\`\`\`bash
npm i -g fluxy-bot
\`\`\`

After npm install, everything is copied to \`~/.fluxy/\` and the CLI is linked.

## What gets installed

After installation, your Fluxy home looks like this:

\`\`\`
~/.fluxy/
├── config.json          # Your settings
├── memory.db            # Conversations & data
├── workspace/           # The app you and Fluxy build together
├── supervisor/          # Manages all processes
├── worker/              # API server
├── dist-fluxy/          # Chat interface
└── bin/                 # Cloudflare tunnel binary
\`\`\`

## Requirements

- **OS:** macOS, Windows 10+, or Linux
- **RAM:** 4 GB minimum
- **Disk:** 500 MB
- **Node.js:** 18+ (bundled automatically if missing)

## Next step

Run \`fluxy init\` to set everything up. See the **Setup** page for details.
`,

  setup: `
# Setup (fluxy init)

After installing, run:

\`\`\`bash
fluxy init
\`\`\`

This is the one-time setup that gets Fluxy running. Here's what happens step by step.

## 1. Tunnel mode

You'll be asked how you want to access Fluxy remotely. Use the arrow keys to pick one:

| Mode | What it does |
|------|-------------|
| **Quick Tunnel** | Gives you a random public URL instantly. No account needed. Best for most users. |
| **Named Tunnel** | Uses your own domain via Cloudflare. Permanent URL, requires a Cloudflare account. |
| **Private Network** | No public URL. Access only via your local network or VPN (Tailscale, WireGuard, etc). |

Most people should start with **Quick Tunnel**. You can change it later.

## 2. What happens next

After you pick a tunnel mode, Fluxy runs through these steps automatically:

1. Creates your config file
2. Downloads the Cloudflare tunnel binary (if using a tunnel)
3. Starts the server
4. Connects the tunnel
5. Verifies the connection
6. Sets up the dashboard
7. Installs the daemon (macOS/Linux) so Fluxy starts automatically

## 3. Named tunnel setup

If you chose **Named Tunnel**, you'll go through an extra setup:

1. Log in to your Cloudflare account (opens a browser)
2. A tunnel is created and linked to your account
3. You'll see DNS instructions — add a CNAME record pointing to your tunnel
4. Once DNS propagates, your domain points to Fluxy

## 4. Done

When init finishes, your workspace opens at \`localhost:3000\`. The chat bubble in the bottom-right corner is where you'll complete the onboarding wizard.
`,

  onboarding: `
# Onboarding Wizard

After \`fluxy init\`, the chat bubble opens with a step-by-step wizard. This is where you connect an AI provider and set up remote access.

## Steps

### 1. Welcome
A quick intro. Hit continue.

### 2. AI Provider
Choose between **Claude** (Anthropic) or **OpenAI Codex**.

Claude is recommended — it uses the Claude Agent SDK under the hood, which gives Fluxy full tool access (reading, writing, editing files, running commands). OpenAI works too, but with simpler chat-only capabilities.

### 3. Model
Pick the specific model to use. For Claude: Opus, Sonnet, or Haiku. For OpenAI: the available GPT/Codex models.

### 4. Authentication
Two options depending on provider:
- **OAuth** — Sign in with your Claude or OpenAI account (recommended, no keys to manage)
- **API Key** — Paste your key manually

For Claude: you'll be redirected to Anthropic's login page, get a code, and paste it back. For OpenAI: the browser handles it automatically — no code to copy.

### 5. Handle (optional)
Register a public username with the Fluxy Relay. This gives you a permanent URL like:
- \`username.my.fluxy.bot\` (free)
- \`fluxy.bot/username\` (premium, $5)

Skip this if you're using a named tunnel or private network.

### 6. Portal Password
Set a password to protect remote access. Anyone with your tunnel URL will need this to log in. Minimum 6 characters.

### 7. Two-Factor Authentication (optional)
You can enable TOTP-based 2FA right from this step. It's recommended if your bot is publicly accessible (Quick or Named Tunnel).

- Toggle it on and scan the QR code with an authenticator app (Google Authenticator, Authy, 1Password, etc.)
- On mobile, you can tap "Open in Authenticator" instead of scanning
- Enter the 6-digit code from your app to verify
- Save your **recovery codes** — each one works once if you lose access to your authenticator

You can also enable or disable 2FA later by re-running the onboarding wizard.

### 8. Voice (optional)
Add an OpenAI API key for Whisper voice transcription. This lets you send voice messages to Fluxy.

### 9. Done
You're ready to go. Start chatting.
`,

  'first-conversation': `
# Your First Conversation

After onboarding, you're in the chat. This is where everything happens — your agent builds, debugs, and evolves your workspace through conversation.

## Start with something real

Don't start small. Fluxy handles full features end-to-end. Try:

- *"Build me a personal contacts CRM with tags, search, and import from CSV"*
- *"Create a habit tracker with streaks and a weekly overview chart"*
- *"I want a finance dashboard — let me log expenses and see monthly breakdowns"*

Fluxy builds the frontend UI, creates the backend API routes, sets up the database tables, and wires everything together. You'll see your workspace update in real time.

## Keep going

Once a feature exists, refine it. This is where the vibe coding magic happens:

- *"Add a dark mode toggle to the whole app"*
- *"The contacts list should show the most recent first"*
- *"Add an export to CSV button on the habits page"*
- *"I need a quick calorie counter too — add it to the sidebar"*

Every conversation changes real, working code. Your workspace grows with each request.

## Talk to it from your phone

Open the PWA on your phone and send a voice message: "Hey, add a notes section to the dashboard." Fluxy transcribes it with Whisper and gets to work. It's like talking to your codebase.

## What happens behind the scenes

When you send a message:

1. Your message goes to the AI model (Claude or OpenAI)
2. The agent reads your workspace files to understand context
3. It writes code — edits files, creates new ones, runs commands
4. The dashboard hot-reloads automatically
5. If backend code changed, the server restarts

The chat shows what tools the agent is using in real time. And because the chat is sandboxed in an iframe, it never goes down — even if the agent accidentally breaks something.

## Tips

- Be specific when you can. "Add a contacts page" is good. "Add a contacts page with name, email, phone, and tags" is better.
- Fluxy remembers context within a session. Refer back to what you just built.
- If something breaks, just tell Fluxy. The chat always works, and the agent can debug and fix its own code.
- Send voice messages from your phone if you set up Whisper during onboarding.
- Think big — the workspace can hold many features. A CRM, a tracker, a research log, mini tools. All in one place.
`,

  workspace: `
# The Workspace

Your workspace is a full-stack application that lives at \`~/.fluxy/workspace/\`. You and Fluxy share it — you use it, Fluxy builds it.

## Structure

\`\`\`
workspace/
├── client/              # React + Tailwind frontend
│   └── src/App.tsx      # Main app component
├── backend/
│   └── index.ts         # Express API server
├── app.db               # SQLite database
├── .env                 # Backend environment variables
├── MYSELF.md            # Agent identity & personality
├── MYHUMAN.md           # What Fluxy knows about you
├── MEMORY.md            # Long-term curated memory
├── PULSE.json           # Periodic wake-up config
├── CRONS.json           # Scheduled tasks
├── memory/              # Daily note files
├── skills/              # Plugins & extensions
├── MCP.json             # MCP server config (optional)
└── files/               # Uploaded attachments
\`\`\`

## Frontend

A React app with Tailwind CSS. This is what you see in the browser — the pages, the components, the UI. Fluxy builds and modifies this when you ask for new features.

## Backend

An Express server running on its own port. It handles API routes and talks to the database. When Fluxy creates a feature, it wires up the backend automatically. Your backend routes are accessible at \`/app/api/\`.

## Database

A SQLite database (\`app.db\`) for your app data. Contacts, notes, habits — whatever you're building lives here.

## One workspace, infinite features

Everything lives in a single workspace. When you ask for a CRM today, a finance tracker tomorrow, and a calorie counter next week, Fluxy adds them as modules — a sidebar icon, a new page, a dashboard card. They all coexist.

The workspace can be one big app or a collection of mini apps the agent builds on demand. It's your sandbox — shape it however you want.

## Public or private

By default, anyone who visits your URL (e.g., \`fluxy.bot/yourname\`) sees the workspace. You can use it as a public dashboard, a portfolio, or a team hub. Or ask the agent to add authentication so only you (or your team) can access it.

## Boundaries

Fluxy can only modify files inside \`workspace/\`. It cannot touch the supervisor, worker, or system files. This keeps the core stable while giving the agent full freedom inside its sandbox. If something breaks in the workspace, the chat is always available to ask for fixes — it runs in a separate, isolated process.
`,

  chat: `
# Chat Bubble

The chat bubble is how you talk to Fluxy. It floats in the bottom-right corner of your workspace — and it never goes down.

## Indestructible by design

The chat runs in an isolated iframe — a completely separate process from the workspace. This is a critical design choice:

- **If the agent breaks the workspace, the chat survives.** You can always reach Fluxy and ask for fixes.
- No CSS or JavaScript conflicts between the chat and your app
- The chat is always accessible, no matter what state the workspace is in

This is what makes Fluxy safe to use as a vibe coding tool. The agent has full freedom to experiment with your workspace, and you always have a way to talk to it.

## What you can do

- Ask Fluxy to build new features
- Report bugs and have them fixed
- Ask questions about your workspace
- Request changes to existing features
- Send voice messages (if Whisper is configured)
- Attach images or documents for context

## Multi-device sync

If you have the workspace open on multiple devices, messages sync across all of them in real time via WebSocket. Send a message from your phone and see it on your laptop.

## Push notifications

When Fluxy sends you a message (from a scheduled task or pulse), you'll get a push notification on your phone or browser — even if the tab is closed.

## The chat is the interface

There are no settings panels, no drag-and-drop builders. The chat is how you control everything. If you want something changed, say it.
`,

  memory: `
# Memory System

Fluxy forgets everything between sessions. Files are the only thing that persists.

## How it works

Every time Fluxy wakes up (new conversation, pulse, cron), it reads these files to rebuild its understanding:

| File | Purpose |
|------|---------|
| \`MYSELF.md\` | Agent's identity, personality, and operating rules |
| \`MYHUMAN.md\` | Who you are — your name, preferences, context |
| \`MEMORY.md\` | Long-term curated knowledge |
| \`memory/YYYY-MM-DD.md\` | Daily notes — what happened on each day |

These files are injected into the system prompt at the start of every query. They are the agent's entire memory.

## Daily notes

As you work together, Fluxy logs events in daily note files. What was built, what broke, what decisions were made. These are append-only — Fluxy adds to them but doesn't delete from them.

## Long-term memory

Periodically, Fluxy reviews its daily notes and distills the important stuff into \`MEMORY.md\`. Patterns, preferences, lessons learned.

## You can help

- Tell Fluxy to remember something: *"Remember that I prefer dark themes"*
- Tell it to forget: *"Forget the old API key format"*
- Edit the files directly if you want — they're just markdown

## Golden rule

A thought not written down is a thought lost. If Fluxy doesn't save something to a file before the session ends, it's gone.
`,

  'pulse-crons': `
# Pulse & Scheduled Tasks

Fluxy can wake up on its own — no message from you needed.

## Pulse

Pulse is a periodic wake-up. Fluxy checks in at regular intervals, reviews its memory, and can take proactive actions.

Configure it in \`workspace/PULSE.json\`:

\`\`\`json
{
  "enabled": true,
  "intervalMinutes": 30,
  "quietHours": { "start": "23:00", "end": "07:00" }
}
\`\`\`

- **intervalMinutes** — How often Fluxy wakes up (in minutes)
- **quietHours** — No wake-ups during this window (respects your sleep)

## Scheduled tasks (Crons)

For specific scheduled actions, use \`workspace/CRONS.json\`:

\`\`\`json
[
  {
    "id": "morning-briefing",
    "schedule": "0 9 * * *",
    "task": "Give me a morning briefing with today's tasks",
    "enabled": true,
    "oneShot": false
  }
]
\`\`\`

- **schedule** — Standard cron expression (minute, hour, day, month, weekday)
- **task** — What to tell the agent when the cron fires
- **oneShot** — If true, the cron is automatically removed after it runs once

## What happens when they fire

1. Fluxy wakes up and reads its memory files
2. Processes the task or pulse check
3. If it has something to tell you, it sends a push notification
4. Goes back to sleep until the next trigger

## Examples

- *"Check my calendar every morning at 9am and summarize my day"*
- *"Every Friday at 5pm, generate a weekly report"*
- *"Every hour, check if any API endpoints are down"*

You can edit these files directly, or ask Fluxy to set up crons for you through the chat.
`,

  pwa: `
# PWA & Mobile

Your Fluxy workspace is a Progressive Web App. Install it on your phone or tablet and use it like a native app.

## Installing the PWA

### Android / Chrome
1. Open your workspace URL in Chrome
2. Tap the install prompt or go to menu > "Add to Home Screen"
3. The workspace appears as an app on your home screen

### iOS / Safari
1. Open your workspace URL in Safari
2. Tap the share button > "Add to Home Screen"
3. Done — it shows up like a regular app

## Push notifications

Once installed as a PWA, you'll receive push notifications when:
- Fluxy completes a scheduled task and has something to tell you
- A pulse check finds something noteworthy
- Any event that triggers a message from Fluxy

Notifications work even when the app isn't open.

## Mobile chat

The chat bubble is fully responsive. On mobile it goes full-screen when opened. Voice messages work if Whisper is configured. You can attach photos directly from your camera.

## Accessing from anywhere

To use Fluxy on your phone outside your home network, you need a tunnel (Quick Tunnel or Named Tunnel). See the **Tunnels & Remote Access** section.
`,

  tunnels: `
# Tunnels & Remote Access

Fluxy runs on your machine, but you can access it from anywhere using tunnels.

## Quick Tunnel (default)

Zero configuration. Fluxy spins up a Cloudflare tunnel automatically and gives you a public URL.

- **No account needed** — works out of the box
- **Random URL** — changes every time Fluxy restarts (e.g., \`random-words.trycloudflare.com\`)
- **Pair with Fluxy Relay** for a permanent, memorable URL

This is set up during \`fluxy init\`. Nothing to configure.

## Named Tunnel

Use your own domain for a permanent, branded URL.

### Setup

Run the tunnel setup:

\`\`\`bash
fluxy tunnel setup
\`\`\`

This walks you through:
1. Logging into your Cloudflare account
2. Creating a tunnel
3. Getting DNS instructions (add a CNAME record)

Once DNS propagates, your domain points directly to your Fluxy instance.

### Requirements

- A Cloudflare account (free)
- A domain managed by Cloudflare

## Private Network (no tunnel)

If you don't want any public URL, choose "Private Network" during \`fluxy init\`. Access Fluxy only via:

- Your local network (\`http://192.168.x.x:3000\`)
- A VPN like Tailscale or WireGuard

## Tunnel commands

| Command | What it does |
|---------|-------------|
| \`fluxy tunnel setup\` | Interactive named tunnel setup |
| \`fluxy tunnel status\` | Show current tunnel mode and URL |
| \`fluxy tunnel reset\` | Switch back to quick tunnel mode |

## Security

All tunnel traffic is encrypted through Cloudflare. Remote access is protected by your portal password. If you have 2FA enabled, logging in from a new device requires a 6-digit code from your authenticator app. You can also choose to "trust" a device for 90 days so you don't have to enter the code every time.

## Health monitoring

Fluxy checks tunnel health every 30 seconds. If the tunnel dies (laptop sleep, network change, etc.), it automatically restarts and reconnects. For quick tunnels, a new URL is generated and the relay is updated.
`,

  relay: `
# Fluxy Relay

The Fluxy Relay gives you a permanent, memorable URL — even when using Quick Tunnel (which generates random URLs on every restart).

## How it works

1. You register a username during onboarding (or later via settings)
2. Fluxy sends heartbeats to the relay server every 30 seconds
3. When someone visits your relay URL, the relay proxies the request to your current tunnel URL

\`\`\`
Your phone → fluxy.bot/username → Relay → Quick Tunnel → Your machine
\`\`\`

## URL tiers

| Tier | URL format | Cost |
|------|-----------|------|
| **Free** | \`username.my.fluxy.bot\` | Free |
| **Premium** | \`fluxy.bot/username\` | $3 one-time |

## When do you need it?

- **Quick Tunnel users** — Yes, strongly recommended. Without the relay, your URL changes every restart.
- **Named Tunnel users** — No, you already have a permanent domain.
- **Private Network users** — No, there's no public URL to relay.

## Offline detection

If Fluxy stops sending heartbeats for 2 minutes, the relay marks your bot as offline and shows a friendly offline page to visitors.
`,

  cli: `
# CLI Commands

Everything in Fluxy is controlled through the \`fluxy\` command.

## Main commands

| Command | What it does |
|---------|-------------|
| \`fluxy init\` | First-time setup — tunnel mode, config, server boot, daemon install |
| \`fluxy start\` | Start the server (or show status if daemon is running) |
| \`fluxy status\` | Show health info — uptime, tunnel URL, relay URL |
| \`fluxy update\` | Download and install the latest version |

## Tunnel commands

| Command | What it does |
|---------|-------------|
| \`fluxy tunnel setup\` | Interactive named tunnel setup (Cloudflare) |
| \`fluxy tunnel status\` | Show current tunnel mode and URL |
| \`fluxy tunnel reset\` | Switch back to quick tunnel mode |

## Daemon commands

| Command | What it does |
|---------|-------------|
| \`fluxy daemon install\` | Set up auto-start on boot |
| \`fluxy daemon start\` | Start the daemon |
| \`fluxy daemon stop\` | Stop the daemon |
| \`fluxy daemon restart\` | Restart the daemon |
| \`fluxy daemon status\` | Check if the daemon is running |
| \`fluxy daemon logs\` | View daemon logs |
| \`fluxy daemon uninstall\` | Remove auto-start |

## Updates

\`\`\`bash
fluxy update
\`\`\`

This checks the npm registry for a newer version, downloads it, updates the code, rebuilds the UI, and restarts the daemon. Your workspace and data are preserved.
`,

  daemon: `
# Daemon & Auto-Start

The daemon keeps Fluxy running in the background and starts it automatically when your machine boots.

## macOS (launchd)

Fluxy creates a launch agent at:
\`\`\`
~/Library/LaunchAgents/com.fluxy.bot.plist
\`\`\`

Logs go to:
\`\`\`
~/Library/Logs/fluxy/fluxy.log
\`\`\`

It starts automatically on login and restarts if it crashes.

## Linux (systemd)

Fluxy creates a systemd service at:
\`\`\`
/etc/systemd/system/fluxy.service
\`\`\`

It starts on boot with auto-restart on failure. Some daemon commands require \`sudo\` on Linux.

## Windows

No built-in daemon support yet. Run \`fluxy start\` manually, or set up Windows Task Scheduler to run it on login.

## Commands

\`\`\`bash
fluxy daemon install    # Set up auto-start
fluxy daemon start      # Start the daemon
fluxy daemon stop       # Stop the daemon
fluxy daemon restart    # Restart
fluxy daemon status     # Check status
fluxy daemon logs       # View logs
fluxy daemon uninstall  # Remove auto-start
\`\`\`

## When is it installed?

The daemon is set up automatically during \`fluxy init\` on macOS and Linux. You don't need to do anything extra.
`,

  configuration: `
# Configuration

Fluxy stores its config at \`~/.fluxy/config.json\`. Most settings are configured during \`fluxy init\` and onboarding, but you can edit them manually.

## Config file

\`\`\`json
{
  "port": 3000,
  "tunnel": {
    "mode": "quick"
  }
}
\`\`\`

| Field | Description | Default |
|-------|-------------|---------|
| \`port\` | Base port for the server | \`3000\` |
| \`tunnel.mode\` | \`quick\`, \`named\`, or \`off\` | \`quick\` |

## AI provider settings

AI provider, model, and API keys are configured through the onboarding wizard and stored in the database. You can change them later through the chat by asking Fluxy.

## Workspace environment

The workspace backend reads from \`workspace/.env\` for any custom environment variables your app needs. Changes to \`.env\` trigger an automatic backend restart.

## Ports

Fluxy uses a base port (default 3000) with automatic offsets:

| Service | Port |
|---------|------|
| Supervisor (main) | 3000 |
| Worker API | 3001 |
| Dashboard (dev) | 3002 |
| Workspace backend | 3004 |

You can change the base port in \`config.json\` — all offsets adjust automatically.
`,

  models: `
# AI Models

Fluxy supports two AI providers. The experience differs depending on which one you choose.

## Claude (Anthropic) — Recommended

When you use Claude, Fluxy runs on the **Claude Agent SDK**. This gives it full tool access:

- Read, write, and edit files across your workspace
- Run terminal commands
- Search and navigate code
- Multi-turn conversations with persistent context

Available models: **Opus** (most capable), **Sonnet** (balanced), **Haiku** (fastest).

Authentication: OAuth sign-in with your Claude account, or paste an API key.

## OpenAI Codex

When you use OpenAI, Fluxy uses a simpler chat interface:

- Conversational responses
- Code generation in messages
- No direct file editing or terminal access

Authentication: OAuth sign-in with your OpenAI account, or paste an API key.

## Which should you use?

**Claude is recommended.** The agent SDK integration gives Fluxy the ability to actually read and modify your workspace files, run commands, and debug issues. With OpenAI, you're limited to a chat-only experience without direct workspace manipulation.

## Switching providers

You can switch providers through the onboarding wizard or by asking Fluxy in the chat. The change takes effect on the next conversation.
`,

  skills: `
# Skills & Plugins

Skills are plugins that extend what Fluxy can do. They live inside your workspace.

## How they work

Each skill is a directory inside \`workspace/skills/\` with a plugin manifest:

\`\`\`
workspace/skills/
└── my-skill/
    └── .claude-plugin/
        └── plugin.json
\`\`\`

Skills are automatically discovered and loaded when Fluxy starts a new conversation. They appear as additional capabilities the agent can use.

## MCP Servers

Fluxy also supports MCP (Model Context Protocol) servers. Configure them in \`workspace/MCP.json\`:

\`\`\`json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "my-mcp-server"]
    }
  }
}
\`\`\`

MCP servers give Fluxy access to external tools and data sources — databases, APIs, services — through a standardized protocol.

## Creating skills

You can ask Fluxy to create skills for you. Just describe what capability you want to add and it will set up the plugin structure.
`,

  contributing: `
# Contributing

Fluxy is open source. Contributions are welcome.

## Getting started

\`\`\`bash
git clone https://github.com/fluxy-ai/fluxy.git
cd fluxy && npm install
npm run dev
\`\`\`

## How to contribute

- **Bug reports** — Open an issue on GitHub
- **Feature requests** — Open a discussion
- **Pull requests** — Fork, branch, submit
- **Documentation** — Help improve these docs

## Architecture overview

Fluxy has a process-based architecture:

- **Supervisor** — The main process. Routes HTTP requests, manages child processes, runs the scheduler
- **Worker** — Express API server. Handles auth, conversations, settings, database
- **Workspace backend** — Your custom Express server that Fluxy builds
- **Vite** — Development server for the dashboard with hot-reload
- **Cloudflared** — Tunnel process for remote access

The supervisor keeps everything running. If a child crashes, it auto-restarts (up to 3 times).

## Community

Join the Discord to chat with other contributors and users.
`,

  faq: `
# FAQ

## Is Fluxy free?

Yes. Fluxy is open source and free to use. You need your own AI provider account (Claude or OpenAI), which has its own costs. The Fluxy Relay free tier is also free.

## Does my data leave my machine?

Only the conversation goes to the AI provider's API. Your workspace files, database, and code stay on your machine.

## What about the tunnel — is that safe?

The tunnel encrypts all traffic via Cloudflare. Portal password protection is required for remote access. No one can access your workspace without your password. You can also enable two-factor authentication (2FA) for an extra layer of security — recommended if your bot is publicly accessible.

## Can Fluxy break my workspace?

Fluxy can only modify files inside the \`workspace/\` directory. It can't touch system files or its own core code. If something goes wrong in the workspace, tell Fluxy to fix it or revert with git.

## Can I use Fluxy without coding knowledge?

Yes. That's the point. Describe what you want in plain English, and Fluxy builds it. You don't need to touch any code.

## Can multiple people use the same workspace?

The workspace is designed for one human + one agent. Multi-user support is on the roadmap.

## What if I lose my tunnel URL?

Run \`fluxy status\` to see your current tunnel URL and relay URL. If you registered a handle with the relay, your URL never changes.

## How do I update Fluxy?

\`\`\`bash
fluxy update
\`\`\`

This downloads the latest version, updates the code, and restarts. Your workspace and data are preserved.

## How is Fluxy different from OpenClaw?

OpenClaw is a terminal-based agent you reach via the command line, WhatsApp, or Telegram. Fluxy is a PWA — you access it from your phone's browser like a native app. More importantly, Fluxy comes with its own full-stack codebase (frontend, backend, database) that the agent builds and evolves through conversation. It's an agent and a playground.

## Can I use voice messages?

Yes. If you add an OpenAI API key during onboarding, Fluxy uses Whisper to transcribe voice messages. Send a voice note from your phone and Fluxy gets to work. It's like talking to your codebase.

## Can Fluxy work offline?

Fluxy needs internet access for the AI provider API. The workspace itself runs locally, but without an AI connection the agent can't respond.
`,
}

const defaultSlug = 'introduction'

function CopyDropdown({ markdown }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const copyMarkdown = () => {
    navigator.clipboard.writeText(markdown.trim())
    setCopied('md')
    setTimeout(() => { setCopied(null); setOpen(false) }, 1500)
  }

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied('url')
    setTimeout(() => { setCopied(null); setOpen(false) }, 1500)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors duration-200"
      >
        <HiEllipsisVertical className="w-5 h-5" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-border bg-card shadow-xl shadow-black/30 overflow-hidden z-20"
          >
            <button
              onClick={copyMarkdown}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors duration-200"
            >
              {copied === 'md' ? <FaCheck className="w-3.5 h-3.5 text-emerald-400" /> : <FaCopy className="w-3.5 h-3.5" />}
              Copy as markdown
            </button>
            <button
              onClick={copyUrl}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors duration-200"
            >
              {copied === 'url' ? <FaCheck className="w-3.5 h-3.5 text-emerald-400" /> : <FaLink className="w-3.5 h-3.5" />}
              Copy URL to your agent
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function DocsNav({ currentSlug, onSelect, className = '' }) {
  return (
    <nav className={className}>
      {sections.map((section) => (
        <div key={section.group} className="mb-6">
          <h4 className="text-xs font-semibold font-display uppercase tracking-wider text-muted-foreground/50 mb-2 px-3">
            {section.group}
          </h4>
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => (
              <button
                key={item.slug}
                onClick={() => onSelect(item.slug)}
                className={`text-left px-3 py-1.5 rounded-lg text-sm transition-colors duration-200 ${
                  currentSlug === item.slug
                    ? 'text-foreground bg-white/[0.06] font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.03]'
                }`}
              >
                {item.title}
              </button>
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}

export default function Docs() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const currentSlug = searchParams.get('page') || defaultSlug
  const content = docs[currentSlug] || docs[defaultSlug]

  const handleSelect = (slug) => {
    setSearchParams({ page: slug })
    setSidebarOpen(false)
    window.scrollTo(0, 0)
  }

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  const currentTitle = sections
    .flatMap(s => s.items)
    .find(i => i.slug === currentSlug)?.title || 'Docs'

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2.5 group">
              <img src="/assets/images/fluxy.png" alt="Fluxy" className="h-8 w-auto" />
              <span className="text-lg font-bold font-display text-foreground">Fluxy</span>
            </Link>
            <HiChevronRight className="w-4 h-4 text-muted-foreground/40 hidden sm:block" />
            <span className="text-sm text-muted-foreground hidden sm:block">Docs</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <a href="#" className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors duration-200">
              <FaDiscord className="w-[18px] h-[18px]" />
            </a>
            <a href="#" className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors duration-200">
              <FaGithub className="w-[18px] h-[18px]" />
            </a>
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground lg:hidden transition-colors duration-200"
            >
              <HiBars3 className="w-6 h-6" />
            </button>
          </div>
        </div>
      </nav>

      <div className="lg:hidden fixed top-16 left-0 right-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center gap-2 px-4 h-11">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            <HiBars3 className="w-4 h-4" />
            <span>Menu</span>
          </button>
          <HiChevronRight className="w-3 h-3 text-muted-foreground/40" />
          <span className="text-sm text-foreground font-medium truncate">{currentTitle}</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-[7.5rem] lg:pt-24 pb-16">
        <div className="flex gap-10">
          <aside className="hidden lg:block w-56 shrink-0 sticky top-24 self-start max-h-[calc(100vh-8rem)] overflow-y-auto no-scrollbar">
            <DocsNav currentSlug={currentSlug} onSelect={handleSelect} />
          </aside>

          <motion.article
            key={currentSlug}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 min-w-0 max-w-3xl prose-docs relative"
          >
            <div className="absolute top-0 right-0">
              <CopyDropdown markdown={content} />
            </div>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content.trim()}
            </ReactMarkdown>
          </motion.article>
        </div>
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <div className="fixed inset-0 z-[60] lg:hidden">
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              className="absolute left-0 top-0 bottom-0 w-[280px] bg-background border-r border-border/50 p-6 overflow-y-auto"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 35 }}
            >
              <div className="flex items-center justify-between mb-8">
                <span className="font-bold font-display text-foreground">Docs</span>
                <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                  <HiXMark className="w-5 h-5" />
                </button>
              </div>
              <DocsNav currentSlug={currentSlug} onSelect={handleSelect} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
