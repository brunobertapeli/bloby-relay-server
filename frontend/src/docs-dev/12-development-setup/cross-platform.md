---
title: "Cross-Platform Notes"
---

## 8. Cross-Platform Notes

### Windows

**Shell:** Use PowerShell or Windows Terminal. The install script
(`scripts/install.ps1`) creates `~/.morphy/bin/morphy.cmd` as a wrapper. It
prefers the bundled Node runtime and falls back to a `node` on PATH:

```batch
@echo off
set "MN=%USERPROFILE%\.morphy\tools\node\node.exe"
if not exist "%MN%" set "MN=node"
"%MN%" "%USERPROFILE%\.morphy\bin\cli.js" %*
```

**Paths:** All path handling in the codebase uses `path.join()` and
`path.resolve()`, which produce correct backslash paths on Windows. The
backend spawner (`supervisor/backend.ts`) converts paths to forward-slash
`file://` URLs for dynamic imports:

```js
const backendUrl = 'file://' + backendPath.replace(/\\/g, '/');
```

**Daemon mode:** Windows does not have systemd or launchd. The
`hasDaemonSupport()` function returns `false` on Windows. To run Morphy as a
background service on Windows, use Task Scheduler or a tool like `pm2`. The CLI
prints a specific message:

```
Use Task Scheduler to keep Morphy running in the background.
```

**Tunneling:** No platform binary is downloaded (cloudflared was removed; the
carrier in `supervisor/relay-tunnel.ts` is a plain outbound WebSocket opened
from the Node process itself), so remote access works identically on Windows.
The `PROCESSOR_ARCHITECTURE` environment variable is still used by
`scripts/install.ps1` to pick the bundled Node architecture (ARM64 vs x64).

**npm bin linking:** On Windows, npm handles the `morphy` command via the `"bin"`
field in `package.json`. The postinstall script skips symlink creation:

```js
if (process.platform === 'win32') {
  // On Windows, npm handles the bin linking via package.json "bin" field
}
```

### macOS

**Daemon:** Uses `launchd`. The plist file is installed at
`~/Library/LaunchAgents/com.morphyagent.app.plist`. Commands:

```bash
morphy daemon install     # Write plist + launchctl bootstrap gui/$UID
morphy start              # bootstrap (or kickstart -k if loaded but stopped)
morphy stop               # launchctl bootout gui/$UID/com.morphyagent.app
morphy restart            # bootout + bootstrap (== stop + start)
morphy logs               # last 80 lines of ~/Library/Logs/morphy/morphy.log (-f follows via tail -F)
morphy daemon uninstall   # bootout + delete plist
```

The CLI uses the modern `launchctl` verbs (`bootstrap`/`bootout`/`kickstart`/`print`)
with an explicit domain target (`gui/$UID`, falling back to `user/$UID` for headless
sessions). The legacy `load`/`unload`/`list` subcommands always exit 0 and resolve the
domain from the caller's context, which made SSH/tmux/detached invocations silently
fail or boot duplicate instances. The launchd log is rotated at start when it exceeds
5 MB (only while the job is stopped: renaming a live log file is what causes stale
`morphy logs` output).

The plist configures:

- `RunAtLoad: true` -- starts on user login.
- `KeepAlive.SuccessfulExit: false` -- restarts if the process crashes (non-zero
  exit), but not if it exits cleanly.
- `ThrottleInterval: 5` -- at least 5 seconds between restarts.
- Logs to `~/Library/Logs/morphy/morphy.log`.

**PATH:** The `~/.morphy/bin/` directory is added to
`PATH` via `~/.zshrc` or `~/.bash_profile`.

**Native modules:** `better-sqlite3` requires Xcode Command Line Tools.

### Linux

**Daemon:** Uses `systemd`. The unit file is installed at
`/etc/systemd/system/morphy.service`. Commands:

```bash
morphy daemon install     # Write unit + enable + start (uses sudo)
morphy start              # systemctl start morphy
morphy stop               # systemctl stop morphy
morphy restart            # systemctl stop + start
morphy status             # systemctl show + /api/health + ~/.morphy/supervisor.json
morphy logs               # journalctl -u morphy -n 80 --no-pager (-f follows)
morphy daemon uninstall   # Stop + disable + remove unit file
```

The unit file configures:

- `Restart=on-failure` with `RestartSec=5`.
- `WantedBy=multi-user.target` -- starts on boot.
- `StandardOutput=journal` and `StandardError=journal` -- logs to journald.

**Sudo:** Daemon commands that modify systemd require root. The CLI runs only the
privileged command (`systemctl ...`, the unit-file copy) under sudo, trying
passwordless `sudo -n` first, prompting on a TTY, and failing fast with the exact
manual command when headless (so the supervisor's detached self-update relaunch
never hangs on a password prompt). Under systemd the supervisor relaunches itself
after a self-update by exiting non-zero and letting `Restart=on-failure` respawn
it (no sudo involved). `MORPHY_NODE_PATH` and `MORPHY_REAL_HOME` are still honored
for the unit's node binary and the data directory.

**Architectures:** The install script supports `x86_64`, `aarch64`/`arm64`, and
`armv7l`/`armv6l` (Raspberry Pi).

**PATH:** The `~/.morphy/bin/` directory is added to `PATH` via `~/.bashrc`,
`~/.bash_profile`, `~/.zshrc`, `~/.config/fish/config.fish`, or `~/.profile`
depending on the detected shell.

---
