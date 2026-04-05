---
title: "Testing"
---

Bloby does not currently have an automated test suite. All testing is manual.

### Manual Testing Workflow

1. Start the development environment: `npm run dev`
2. Open `http://localhost:5173` in a browser (Vite dev server with HMR)
3. The chat widget appears as a floating bubble on the dashboard
4. The worker API is accessible at `http://localhost:3001/api/`
5. The user backend is accessible at `http://localhost:3004/` (or `http://localhost:5173/app/api/` via proxy)

### Testing Agent Changes

To test changes to the system prompt or agent capabilities:

1. Start Bloby: `npm run dev`
2. Open the chat widget on the dashboard
3. Send messages that exercise the changed behavior
4. Watch the terminal for log output from the supervisor and worker
5. Check that the agent uses tools correctly and produces expected responses
6. If you modified `bloby-system-prompt.txt`, the changes take effect on the next message (the prompt is read fresh each turn)

### Testing Tunnel Modes

**Quick tunnel:**

- Set tunnel mode to `quick` via `bloby init` or by editing `~/.bloby/config.json`
- Start Bloby and confirm the `*.trycloudflare.com` URL appears in logs
- Access the URL from another device or browser to verify reverse proxy routing

**Named tunnel:**

- Requires a Cloudflare account and DNS setup
- Set tunnel mode to `named` with `configPath` and `name` in the config
- Start Bloby and confirm the named tunnel connects

**No tunnel:**

- Set tunnel mode to `off` for local-only development (most common for contributors)

### Cross-Platform Testing Considerations

Bloby runs on Windows, macOS, and Linux (including Raspberry Pi). Key areas that differ:

- **Cloudflared binary:** Downloaded per-platform in `supervisor/tunnel.ts`. On Windows it is `.exe`; on macOS it is a `.tgz` archive.
- **Path separators:** Use `path.join()` and `path.resolve()` everywhere. Never construct paths with string concatenation and `/` or `\`. The `shared/paths.ts` module handles this.
- **Process spawning:** The worker spawn in `supervisor/worker.ts` uses `file://` URLs, converting backslashes on Windows (`workerPath.replace(/\\/g, '/')`).
- **Data directory:** `~/.bloby/` on all platforms (via `os.homedir()`).
- **Daemons:** On Linux/macOS, Bloby supports systemd/launchd daemon mode. Windows uses Task Scheduler.
