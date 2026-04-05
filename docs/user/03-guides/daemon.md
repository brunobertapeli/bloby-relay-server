---
title: Daemon & Auto-Start
---

# Daemon & Auto-Start

The daemon keeps Bloby running in the background and starts it automatically when your machine boots.

## macOS (launchd)

Bloby creates a launch agent at:
```
~/Library/LaunchAgents/com.bloby.bot.plist
```

Logs go to:
```
~/Library/Logs/bloby/bloby.log
```

It starts automatically on login and restarts if it crashes.

## Linux (systemd)

Bloby creates a systemd service at:
```
/etc/systemd/system/bloby.service
```

It starts on boot with auto-restart on failure. Some daemon commands require `sudo` on Linux.

## Windows

No built-in daemon support yet. Run `bloby start` manually, or set up Windows Task Scheduler to run it on login.

## Commands

```bash
bloby daemon install    # Set up auto-start
bloby daemon start      # Start the daemon
bloby daemon stop       # Stop the daemon
bloby daemon restart    # Restart
bloby daemon status     # Check status
bloby daemon logs       # View logs
bloby daemon uninstall  # Remove auto-start
```

## When is it installed?

The daemon is set up automatically during `bloby init` on macOS and Linux. You don't need to do anything extra.
