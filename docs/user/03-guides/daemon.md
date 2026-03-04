---
title: Daemon & Auto-Start
---

# Daemon & Auto-Start

The daemon keeps Fluxy running in the background and starts it automatically when your machine boots.

## macOS (launchd)

Fluxy creates a launch agent at:
```
~/Library/LaunchAgents/com.fluxy.bot.plist
```

Logs go to:
```
~/Library/Logs/fluxy/fluxy.log
```

It starts automatically on login and restarts if it crashes.

## Linux (systemd)

Fluxy creates a systemd service at:
```
/etc/systemd/system/fluxy.service
```

It starts on boot with auto-restart on failure. Some daemon commands require `sudo` on Linux.

## Windows

No built-in daemon support yet. Run `fluxy start` manually, or set up Windows Task Scheduler to run it on login.

## Commands

```bash
fluxy daemon install    # Set up auto-start
fluxy daemon start      # Start the daemon
fluxy daemon stop       # Stop the daemon
fluxy daemon restart    # Restart
fluxy daemon status     # Check status
fluxy daemon logs       # View logs
fluxy daemon uninstall  # Remove auto-start
```

## When is it installed?

The daemon is set up automatically during `fluxy init` on macOS and Linux. You don't need to do anything extra.
