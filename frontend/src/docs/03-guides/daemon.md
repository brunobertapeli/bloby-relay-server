---
title: Daemon & Auto-Start
---

# Daemon & Auto-Start

The daemon keeps Morphy running in the background and starts it automatically when your machine boots. This page applies to self-hosted setups. On a managed instance this is all handled for you.

## macOS (launchd)

Morphy creates a launch agent at:
```
~/Library/LaunchAgents/com.morphyagent.app.plist
```

Logs go to:
```
~/Library/Logs/morphy/morphy.log
```

It starts automatically on login and restarts if it crashes.

## Linux (systemd)

Morphy creates a systemd service at:
```
/etc/systemd/system/morphy.service
```

It starts on boot with auto-restart on failure. Some daemon commands require `sudo` on Linux.

On Linux, logs go to the systemd journal instead of a file. `morphy logs` wraps `journalctl -u morphy` for you. If your user cannot read the journal, run it with `sudo`.

## Windows

No built-in daemon support yet. Run `morphy start` manually, or set up Windows Task Scheduler to run it on login.

## Commands

```bash
morphy daemon install    # Set up auto-start
morphy daemon start      # Start the daemon
morphy daemon stop       # Stop the daemon
morphy daemon restart    # Restart
morphy daemon status     # Check status
morphy daemon logs       # View logs
morphy daemon uninstall  # Remove auto-start
```

Day to day you can just use the top-level commands: `morphy start`, `morphy stop`, `morphy restart`, `morphy status`, and `morphy logs`. The `morphy daemon` spellings above are aliases that do exactly the same thing.

## When is it installed?

The daemon is set up automatically during `morphy init` on macOS and Linux. You don't need to do anything extra.
