---
title: "HTTPS / TLS"
---

Morphy does not handle TLS itself. The TLS termination points are:

| Access Method                   | TLS Terminates At                          | Local Traffic     |
|---------------------------------|--------------------------------------------|-------------------|
| Morphy Relay carrier            | Cloudflare edge (Worker + Durable Object)  | HTTP over loopback |
| Managed instance (`tunnel.mode: 'off'`) | Caddy on the instance              | HTTP over loopback |
| Direct localhost                | No TLS                                     | HTTP over loopback |

For self-hosted bots (`tunnel.mode: 'relay'`), the browser's TLS handshake terminates at the Cloudflare edge, which presents a valid certificate for `<handle>.morphyagent.com` (premium) or `<handle>.open.morphyagent.com` (free; a second-level wildcard, covered by a dedicated wildcard certificate because Universal SSL does not extend that deep). From the edge, the Worker routes the request to the bot's Durable Object, which sends it down the agent's single persistent outbound WSS carrier (itself TLS). That carrier is opened by `RelayTunnel` in `supervisor/relay-tunnel.ts`, which dials `wss://<handle-host>/__morphy/carrier` authenticated with a short-lived Ed25519 ticket, then demuxes each stream and replays it as plain HTTP against `127.0.0.1:<port>`. No inbound port is ever opened and no certificate lives on the user's machine.

On the managed tier (`tunnel.mode: 'off'`), Caddy on the instance terminates TLS on `:443` with a Cloudflare Origin certificate (Full-strict) and proxies to the supervisor over loopback. There is no tunnel or carrier in this mode.

Locally, all inter-service communication (supervisor to backend, supervisor to Vite) uses `http://127.0.0.1:<port>`. There is no TLS between local services. The worker API is in-process (mounted directly on the supervisor), so `/api/*` traffic has no network hop at all.
