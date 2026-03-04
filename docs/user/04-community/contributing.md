---
title: Contributing
---

# Contributing

Fluxy is open source. Contributions are welcome.

## Getting started

```bash
git clone https://github.com/fluxy-ai/fluxy.git
cd fluxy && npm install
npm run dev
```

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
