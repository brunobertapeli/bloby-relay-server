---
title: "System Integration"
---

### Morphy Carrier Tunnel

Morphy exposes the local server to the internet through a built-in carrier: `supervisor/relay-tunnel.ts` (the `RelayTunnel` class) holds one persistent outbound WSS connection to the bot's own Durable Object at the Cloudflare edge, authenticated with a short-lived Ed25519 ticket. The edge muxes browser HTTP and WebSocket traffic down that socket; the client demuxes each stream and replays it against the local server on `127.0.0.1`. Two modes (`tunnel.mode` in `shared/config.ts`):

| Mode      | Behavior                                          | URL persistence |
| --------- | ------------------------------------------------- | --------------- |
| **relay** (default) | Persistent carrier into the bot's Durable Object | Stable: `<handle>.open.morphyagent.com` (free) or `<handle>.morphyagent.com` (premium) |
| **off**   | No tunnel (managed/hosted bots are reached directly) | N/A          |

Legacy `quick`/`named` cloudflared configs migrate to `relay` automatically at config load; there is no external binary to install or download.

Liveness and recovery are built into the carrier client:

- Protocol-level ping/pong every 15 seconds; a pong gap over 30 seconds forces a reconnect (`PING_MS` / `PONG_TIMEOUT_MS` in `supervisor/relay-tunnel.ts`).
- A supervisor watchdog ticks every 30 seconds and detects sleep/wake or network-change gaps (> 60 seconds between ticks), forcing an immediate redial instead of waiting out the pong deadline.

A reconnect is just a redial of the same stable host: no URL rotation, no re-registration, no DNS propagation. Presence is the carrier socket itself: the bot is online exactly while the carrier is connected, with no heartbeat polling.

### Process Management

The worker is not a separate process: `worker/index.ts` exports `createWorkerApp()`, which the supervisor mounts in-process, so `/api/*` is served directly with no proxy hop. The remaining pieces:

| Process    | Run method     | Restart behavior                              |
| ---------- | ---------------- | --------------------------------------------- |
| Backend    | `child_process.spawn` with tsx | Auto-respawned on crash (with backoff), restarted on file changes or agent file edits |
| Carrier    | In-process WSS client (`RelayTunnel`) | Ping/pong keepalive, auto-reconnect, watchdog redial on wake |
| Vite       | Vite Node API (`createServer`)  | Not auto-restarted                 |

**Deferred updates:** Agents queue a self-update via `POST /__bloby/control/update` (a `.update` file in the workspace still works as a deprecated fallback). The update is recorded in a persistent marker and runs only once no turn is active on any surface, at the next `bot:turn-complete`. It executes `morphy update` as a child process; on success the supervisor relaunches the daemon (under systemd it exits and `Restart=on-failure` respawns it; on macOS a detached `morphy daemon restart` reloads the launchd job). The marker survives restarts, so an update queued right before a crash resumes at the next boot.

### OS Service Integration

Morphy installs itself as a background service on Linux and macOS; on Windows it runs as a regular process:

| Platform | Service type     | Manager                |
| -------- | ---------------- | ---------------------- |
| Linux    | systemd unit (`/etc/systemd/system/morphy.service`) | `systemctl` |
| macOS    | launchd plist (`~/Library/LaunchAgents/com.morphyagent.app.plist`) | `launchctl` |
| Windows  | No service; `install.ps1` installs Node + Morphy, the bot runs in the terminal | PowerShell installer |
