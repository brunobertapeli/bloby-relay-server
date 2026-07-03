---
title: "Self-Update"
---

The agent self-updates by calling the supervisor control surface:

```
POST http://127.0.0.1:${SUPERVISOR_PORT}/__bloby/control/update
→ { "ok": true, "queued": true, "deferred": true, "message": "..." }
```

This returns a **synchronous acknowledgment**, the reliability fix that replaced the old
fire-and-forget `touch .update` trigger file (which rode a lossy `fs.watch` and silently dropped
events). The `.update` file is still consumed by the workspace watcher as a **deprecated fallback**,
now routed through the same `queueUpdate()` path.

## Flow

1. **`queueUpdate()`** sets the in-memory `pendingUpdate` flag and writes a persisted marker
   `~/.morphy/.update-pending` (`{ queuedAt, attempts }`). It is idempotent (`updateInProgress`
   guard) and returns immediately so the agent gets its ack. If a turn is active it defers; if idle
   it flushes on the next tick.
2. The update **runs at the next turn-complete** so the agent's current turn finishes first (it does
   NOT die mid-turn). The flush is wired on **all three surfaces**: the dashboard turn handler, the
   scheduler (`onTurnComplete`), and the channel manager (`onTurnComplete`), so a pulse/cron or
   WhatsApp-triggered update behaves the same as a dashboard one. (Previously the defer gate keyed on
   `agentQueryActive`, which is set only on the dashboard surface, so non-dashboard updates exited
   mid-turn.)
3. **`runDeferredUpdate()`** spawns `bin/cli.js update` with `MORPHY_SELF_UPDATE=1` (which tells the
   CLI to skip its own daemon stop/restart) and waits for it to finish (the file copy + `npm install`
   complete while the supervisor is still alive). On success it clears the marker and calls
   **`relaunchSupervisor()`**.
4. **`relaunchSupervisor()`** is platform-aware:
   - **Under systemd** (detected via `INVOCATION_ID`): the supervisor simply `process.exit(1)`s
     after a 1s ack-flush delay, and `Restart=on-failure` respawns it onto the new code in ~5s. No
     sudo, no TTY needed (the old detached `morphy daemon restart` path died silently on a headless
     sudo prompt, so Linux agent-triggered updates never actually relaunched).
   - **On macOS** (launchd or foreground): spawns a **detached, unref'd** `morphy daemon restart`
     (modern `launchctl bootout` + `bootstrap` against an explicit `gui/$UID` domain target, falling
     back to `user/$UID` for pre-login SSH sessions). The relauncher outlives this process; its
     `bootout` terminates the old supervisor, then `bootstrap` starts the new code. **This replaced
     the old `process.exit(1)` + launchd `KeepAlive` approach, which silently failed to restart when
     the supervisor ran in the foreground or the launchd job wasn't loaded.** If no daemon is
     installed at all (pure foreground dev, no plist or unit file), `relaunchSupervisor()` skips the
     spawn and the supervisor stays up on the current code rather than going down with nothing to
     bring it back.

## Crash safety

- The marker **persists a queued update across a supervisor restart** that happens between the
  request and the turn-complete flush (in-memory `pendingUpdate` alone would be lost).
- **`resumePendingUpdateOnBoot()`** re-runs an interrupted update on the next boot. This is safe:
  `morphy update` version-checks and no-ops if already latest.
- `marker.attempts` (max 2) + a 30-minute TTL bound the boot-resume retry, so a persistently-failing
  update (e.g. no network) cannot loop forever. After the cap it clears the marker and broadcasts a
  `backend:failed` chat event telling the human to run `morphy update` manually.
- On success (`code === 0`) the marker is cleared **before** the relaunch, so the post-update boot
  has no marker and does not re-run.

## Checking status

```
GET http://127.0.0.1:${SUPERVISOR_PORT}/__bloby/control/update-status
→ { "ok": true, "state": "idle" | "queued" | "running" | "failed", "attempts": N, "logTail": "..." }
```

`logTail` is the last 60 lines of `~/.morphy/update.log`. A successful update ends in a daemon
relaunch (systemd: `process.exit(1)` + `Restart=on-failure`; macOS: detached `morphy daemon
restart`), so the agent observes `running` → a connection drop → a new version on reconnect. A
non-zero exit surfaces as `state: "failed"` with the error in the log tail; it retries on the next
boot, or immediately if the agent re-queues via POST (bounded by the attempts cap).
