---
title: "Cloudflare Tunnel"
---

The Cloudflare Tunnel (powered by the `cloudflared` binary) creates an encrypted outbound connection from the local machine to Cloudflare's edge network. Traffic arriving at the Cloudflare edge is forwarded back through this tunnel to the local supervisor. This eliminates the need for port forwarding, static IPs, or firewall rules.

All tunnel logic lives in `supervisor/tunnel.ts`.

### 3.1 Binary Auto-Download

Before starting a tunnel, Fluxy ensures the `cloudflared` binary is available. The `findBinary()` function checks two locations:

1. **System-wide install** -- runs `which cloudflared` (or `where cloudflared` on Windows). If found, returns `'cloudflared'` (uses the PATH).
2. **Local install** -- checks `paths.cloudflared` (resolved by `shared/paths.ts` to `~/.fluxy/bin/cloudflared` or `cloudflared.exe` on Windows). Validates the file size is at least 10 MB (`MIN_CF_SIZE = 10 * 1024 * 1024`) to reject truncated downloads. If the file exists but is too small, it is deleted.

If neither location yields a valid binary, `installCloudflared()` downloads the latest release from GitHub. Platform and architecture detection:

| Platform  | Architecture Detection                                 | Download URL Pattern                                           |
|-----------|--------------------------------------------------------|----------------------------------------------------------------|
| Windows   | `PROCESSOR_ARCHITECTURE` env var or `os.arch()`        | `cloudflared-windows-amd64.exe` or `cloudflared-windows-arm64.exe` |
| macOS     | `os.arch()` -- `arm64` for Apple Silicon, else `amd64` | `cloudflared-darwin-arm64.tgz` or `cloudflared-darwin-amd64.tgz`   |
| Linux     | `os.arch()` -- `arm64`/`aarch64`, `arm*`, else `amd64` | `cloudflared-linux-arm64`, `cloudflared-linux-arm`, or `cloudflared-linux-amd64` |

On macOS, the download is a `.tgz` archive which is piped through `tar xz`. On Windows, `curl.exe` is used (not the PowerShell alias). On Linux, the binary is downloaded directly. On non-Windows platforms, `chmod 0o755` is applied after download.

The download uses `execSync` with `stdio: 'ignore'` for a clean silent install.

### 3.2 Quick Tunnel Mode

Quick Tunnel mode (`config.tunnel.mode === 'quick'`) creates an ephemeral tunnel that requires zero configuration -- no Cloudflare account, no DNS setup, no credentials.

The `startTunnel(port)` function:

1. Calls `installCloudflared()` to ensure the binary is present.
2. Spawns `cloudflared tunnel --url http://localhost:<port> --no-autoupdate` as a child process.
3. Buffers both `stdout` and `stderr` output.
4. Scans the output for a URL matching `https://*.trycloudflare.com` using the regex `/https:\/\/[^\s]+\.trycloudflare\.com/`.
5. Resolves the promise with the extracted URL.
6. If no URL appears within 30 seconds, rejects with a `Tunnel timeout` error.

The child process is spawned with `windowsHide: true` to prevent a console window on Windows, and `stdin` is set to `'ignore'`.

Quick tunnel URLs are ephemeral -- they change every time the tunnel restarts. This is why the Fluxy Relay exists: it provides a stable domain that re-maps to the new ephemeral URL.

### 3.3 Named Tunnel Mode

Named Tunnel mode (`config.tunnel.mode === 'named'`) uses a persistent Cloudflare Tunnel with a fixed domain name. This requires:

- A Cloudflare account
- A pre-configured tunnel (created via `cloudflared tunnel create`)
- A credentials file
- A tunnel config file (YAML)

The `startNamedTunnel(configPath, name)` function spawns:

```
cloudflared tunnel --config <configPath> run <name>
```

Unlike Quick Tunnel, the URL is not extracted from process output -- it is already known from `config.tunnel.domain` and is constructed as `https://${config.tunnel.domain}` in `supervisor/index.ts`.

The relevant config fields in `BotConfig.tunnel`:

```ts
tunnel: {
  mode: 'named';
  name: string;        // tunnel name
  domain: string;      // e.g. "mybot.example.com"
  configPath: string;  // path to cloudflared config YAML
}
```

### 3.4 Tunnel Mode Dispatcher

The `startTunnelForMode(mode, port, configPath?, name?)` function is the unified entry point:

- `mode === 'off'` -- returns `null`, no tunnel is started.
- `mode === 'quick'` -- calls `startTunnel(port)`, returns the ephemeral URL.
- `mode === 'named'` -- calls `startNamedTunnel(configPath, name)`, returns `null` (the URL is derived from config).

### 3.5 Tunnel Health Watchdog

Once a tunnel is running, the supervisor starts a watchdog (`supervisor/index.ts`, lines 877-925) that runs every 30 seconds via `setInterval`. The watchdog triggers a health check under two conditions:

1. **Wake gap detection** -- if the time elapsed since the last tick exceeds 60 seconds (`now - lastTick > 60_000`), the machine likely went to sleep and woke up. The tunnel process may have died during sleep.
2. **Periodic check** -- every 10th tick (approximately every 5 minutes), a health check runs regardless.

The health check calls `isTunnelAlive(tunnelUrl, config.port)` which performs a two-layer check:

1. **Process check** -- `isTunnelProcessAlive()` verifies the `cloudflared` child process is still running (non-null, no `exitCode`, no `signalCode`).
2. **Local reachability check** -- if a `localPort` is provided, it fetches `http://127.0.0.1:<port>/api/health` with a 3-second timeout. This uses the loopback interface directly rather than the tunnel URL. The comment in the code explains why: on macOS, the server cannot reach itself through the Cloudflare tunnel due to DNS/firewall behavior.

If the tunnel is dead, the watchdog restarts it:

- **Quick tunnel**: calls `restartTunnel(config.port)` which kills the old process and spawns a new one. Waits 3 seconds for the new tunnel to establish. Then updates the config file with the new URL. If a relay token exists, it updates the relay with the new URL and restarts heartbeats.
- **Named tunnel**: calls `restartNamedTunnel(configPath, name)` which kills and respawns. The URL does not change.

### 3.6 Readiness Probes

Before advertising the tunnel URL to the relay, the supervisor runs a readiness probe loop (up to 30 attempts, 1 second apart). It fetches `http://127.0.0.1:<port>/api/health` with a 3-second timeout. This ensures the worker is healthy before external traffic can arrive. If all 30 probes fail, the supervisor logs a warning and proceeds anyway.
