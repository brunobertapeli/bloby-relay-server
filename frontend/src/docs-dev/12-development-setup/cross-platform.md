---
title: "Cross-Platform Notes"
---

## 8. Cross-Platform Notes

### Windows

**Shell:** Use PowerShell or Windows Terminal. The install script
(`scripts/install.ps1`) creates `~/.morphy/bin/bloby.cmd` as a wrapper:

```batch
@echo off
node "%USERPROFILE%\.morphy\bin\cli.js" %*
```

**Paths:** All path handling in the codebase uses `path.join()` and
`path.resolve()`, which produce correct backslash paths on Windows. The
worker/backend spawner converts paths to forward-slash `file://` URLs for
dynamic imports:

```js
const workerUrl = 'file://' + workerPath.replace(/\\/g, '/');
```

**Daemon mode:** Windows does not have systemd or launchd. The
`hasDaemonSupport()` function returns `false` on Windows. To run Morphy as a
background service on Windows, use Task Scheduler or a tool like `pm2`. The CLI
prints a specific message:

```
Use Task Scheduler to keep Morphy running in the background.
```

**Cloudflared:** Downloaded as `cloudflared.exe` to `~/.morphy/bin/`. The
`PROCESSOR_ARCHITECTURE` environment variable is used for architecture detection
instead of `os.arch()` (which returns Node's architecture, not the OS
architecture).

**npm bin linking:** On Windows, npm handles the `morphy` command via the `"bin"`
field in `package.json`. The postinstall script skips symlink creation:

```js
if (process.platform === 'win32') {
  // On Windows, npm handles the bin linking via package.json "bin" field
}
```

### macOS

**Daemon:** Uses `launchd`. The plist file is installed at
`~/Library/LaunchAgents/com.morphyagent.com.plist`. Commands:

```bash
morphy daemon install     # Create plist + load
morphy daemon start       # launchctl load
morphy daemon stop        # launchctl unload
morphy daemon logs        # tail -f ~/Library/Logs/bloby/bloby.log
morphy daemon uninstall   # Unload + delete plist
```

The plist configures:

- `RunAtLoad: true` -- starts on user login.
- `KeepAlive.SuccessfulExit: false` -- restarts if the process crashes (non-zero
  exit), but not if it exits cleanly.
- `ThrottleInterval: 5` -- at least 5 seconds between restarts.
- Logs to `~/Library/Logs/bloby/bloby.log`.

**PATH:** The `~/.morphy/bin/` directory is added to
`PATH` via `~/.zshrc` or `~/.bash_profile`.

**Native modules:** `better-sqlite3` requires Xcode Command Line Tools.

### Linux

**Daemon:** Uses `systemd`. The unit file is installed at
`/etc/systemd/system/bloby.service`. Commands:

```bash
morphy daemon install     # Create unit + enable + start (uses sudo)
morphy daemon start       # systemctl start morphy
morphy daemon stop        # systemctl stop morphy
morphy daemon restart     # systemctl restart morphy
morphy daemon status      # systemctl status morphy
morphy daemon logs        # journalctl -u morphy -f -n 50
morphy daemon uninstall   # Stop + disable + remove unit file
```

The unit file configures:

- `Restart=on-failure` with `RestartSec=5`.
- `WantedBy=multi-user.target` -- starts on boot.
- `StandardOutput=journal` and `StandardError=journal` -- logs to journald.

**Sudo:** Daemon commands that modify systemd require root. The CLI detects this
and re-executes itself with `sudo`, preserving `MORPHY_NODE_PATH` and
`MORPHY_REAL_HOME` so the correct `node` binary and home directory are used under
sudo.

**Architectures:** The install script supports `x86_64`, `aarch64`/`arm64`, and
`armv7l`/`armv6l` (Raspberry Pi).

**PATH:** The `~/.morphy/bin/` directory is added to `PATH` via `~/.bashrc`,
`~/.bash_profile`, `~/.zshrc`, `~/.config/fish/config.fish`, or `~/.profile`
depending on the detected shell.

---
