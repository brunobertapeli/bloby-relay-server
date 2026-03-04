---
title: "Design Decisions"
---

1. **Single-port architecture**: The supervisor exposes one port to the world and
   multiplexes all traffic (HTTP, WebSocket chat, HMR) through URL-based routing.
   This simplifies firewall, tunnel, and reverse proxy configurations.

2. **Inline wrapper spawning**: Child processes use an inline ESM wrapper passed
   via `node -e` rather than a separate bootstrap script. This avoids extra files
   and guarantees the keepalive timer and error handler are always present.

3. **Localhost-only probing**: Health checks and readiness probes always target
   `127.0.0.1` rather than external URLs. This avoids macOS-specific issues where
   the server cannot reach itself through Cloudflare tunnels.

4. **Agent-aware restart deferral**: File-change-triggered restarts are deferred
   during active agent turns to avoid disrupting multi-step AI operations that write
   to the filesystem.

5. **Promise-based backend stop**: `stopBackend()` returns a Promise that resolves
   only after the process fully exits, preventing port collision when the replacement
   process is spawned immediately after.
