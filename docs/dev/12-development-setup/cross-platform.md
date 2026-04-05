---
title: "Cross-Platform Notes"
---

## 8. Cross-Platform Notes

### Windows

**Shell:** Use PowerShell or Windows Terminal. The install script
(`scripts/install.ps1`) creates `~/.bloby/bin/bloby.cmd` as a wrapper:

```batch
@echo off
node "%USERPROFILE%\.bloby\bin\cli.js" %*
```

**Paths:** All path handling in the codebase uses `path.join()` and
`path.resolve()`, which produce correct backslash paths on Windows. The
worker/backend spawner converts paths to forward-slash `file://` URLs for
dynamic imports:

```js
const workerUrl = 'file://' + workerPath.replace(/\\/g, '/');
```

**Daemon mode:** Windows does not have systemd or launchd. The
`hasDaemonSupport()` function returns `false` on Windows. To run Bloby as a
background service on Windows, use Task Scheduler or a tool like `pm2`. The CLI
prints a specific message:

```
Use Task Scheduler to keep Bloby running in the background.
```

**Cloudflared:** Downloaded as `cloudflared.exe` to `~/.bloby/bin/`. The
`PROCESSOR_ARCHITECTURE` environment variable is used for architecture detection
instead of `os.arch()` (which returns Node's architecture, not the OS
architecture).

**npm bin linking:** On Windows, npm handles the `bloby` command via the `"bin"`
field in `package.json`. The postinstall script skips symlink creation:

```js
if (process.platform === 'win32') {
  // On Windows, npm handles the bin linking via package.json "bin" field
}
```

### macOS

**Daemon:** Uses `launchd`. The plist file is installed at
`~/Library/LaunchAgents/com.bloby.bot.plist`. Commands:

```bash
bloby daemon install     # Create plist + load
bloby daemon start       # launchctl load
bloby daemon stop        # launchctl unload
bloby daemon logs        # tail -f ~/Library/Logs/bloby/bloby.log
bloby daemon uninstall   # Unload + delete plist
```

The plist configures:

- `RunAtLoad: true` -- starts on user login.
- `KeepAlive.SuccessfulExit: false` -- restarts if the process crashes (non-zero
  exit), but not if it exits cleanly.
- `ThrottleInterval: 5` -- at least 5 seconds between restarts.
- Logs to `~/Library/Logs/bloby/bloby.log`.

**PATH:** The `~/.bloby/bin/` directory is added to
`PATH` via `~/.zshrc` or `~/.bash_profile`.

**Native modules:** `better-sqlite3` requires Xcode Command Line Tools.

### Linux

**Daemon:** Uses `systemd`. The unit file is installed at
`/etc/systemd/system/bloby.service`. Commands:

```bash
bloby daemon install     # Create unit + enable + start (uses sudo)
bloby daemon start       # systemctl start bloby
bloby daemon stop        # systemctl stop bloby
bloby daemon restart     # systemctl restart bloby
bloby daemon status      # systemctl status bloby
bloby daemon logs        # journalctl -u bloby -f -n 50
bloby daemon uninstall   # Stop + disable + remove unit file
```

The unit file configures:

- `Restart=on-failure` with `RestartSec=5`.
- `WantedBy=multi-user.target` -- starts on boot.
- `StandardOutput=journal` and `StandardError=journal` -- logs to journald.

**Sudo:** Daemon commands that modify systemd require root. The CLI detects this
and re-executes itself with `sudo`, preserving `BLOBY_NODE_PATH` and
`BLOBY_REAL_HOME` so the correct `node` binary and home directory are used under
sudo.

**Architectures:** The install script supports `x86_64`, `aarch64`/`arm64`, and
`armv7l`/`armv6l` (Raspberry Pi).

**PATH:** The `~/.bloby/bin/` directory is added to `PATH` via `~/.bashrc`,
`~/.bash_profile`, `~/.zshrc`, `~/.config/fish/config.fish`, or `~/.profile`
depending on the detected shell.

---
