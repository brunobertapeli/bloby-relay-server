---
title: "System Integration"
---

### Cloudflare Tunnel

Bloby auto-installs and manages a `cloudflared` binary to expose the local server to the internet. Two modes:

| Mode      | Behavior                                          | URL persistence |
| --------- | ------------------------------------------------- | --------------- |
| **quick** | `cloudflared tunnel --url http://localhost:PORT`   | Random URL, changes on restart |
| **named** | `cloudflared tunnel --config PATH run NAME`        | Fixed domain    |
| **off**   | No tunnel                                          | N/A             |

Binary resolution order:

1. System-wide install (checked via `which`/`where`).
2. Local install at `~/.bloby/bin/cloudflared` (validated by file size >= 10 MB).
3. Auto-download from GitHub releases (platform-aware: Windows .exe, macOS .tgz, Linux binary).

The supervisor includes a **tunnel watchdog** that runs every 30 seconds and detects:

- Process death (cloudflared child exited).
- Sleep/wake gaps (> 60 seconds between ticks).
- Periodic health checks (every 10th tick).

On tunnel death, the supervisor automatically restarts cloudflared and (for quick tunnels) updates the relay with the new URL.

### Process Management

The supervisor manages child processes via Node's `child_process` module:

| Process    | Spawn method     | Restart behavior                              |
| ---------- | ---------------- | --------------------------------------------- |
| Worker     | `child_process.spawn` with tsx | Auto-respawned on crash             |
| Backend    | `child_process.spawn` with tsx | Auto-restarted on file changes or agent file edits |
| Tunnel     | `child_process.spawn`          | Watchdog-driven restart             |
| Vite       | Vite Node API (`createServer`)  | Not auto-restarted                 |

**Deferred updates:** When the agent creates a `.update` file in the workspace during a turn, the update is deferred until `bot:done` fires. The update runs in a detached process (`systemd-run` on Linux, detached child on macOS/Windows) so it survives daemon restarts.

### OS Service Integration

Bloby supports installation as a system service on all major platforms:

| Platform | Service type     | Manager                |
| -------- | ---------------- | ---------------------- |
| Linux    | systemd unit     | `systemctl`            |
| macOS    | launchd plist    | `launchctl`            |
| Windows  | PowerShell setup | `install.ps1`          |
