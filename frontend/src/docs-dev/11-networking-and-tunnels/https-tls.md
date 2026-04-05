---
title: "HTTPS / TLS"
---

Bloby does not handle TLS itself. The TLS termination points are:

| Access Method          | TLS Terminates At       | Local Traffic     |
|------------------------|-------------------------|-------------------|
| Cloudflare Quick Tunnel | Cloudflare edge          | HTTP over loopback |
| Cloudflare Named Tunnel | Cloudflare edge          | HTTP over loopback |
| Bloby Relay             | Relay server (cloud)    | HTTP over loopback |
| Direct localhost        | No TLS                  | HTTP over loopback |

The `cloudflared` binary establishes an encrypted tunnel (using its own protocol) from the local machine to Cloudflare's edge. The edge handles the browser's TLS handshake and presents a valid certificate for `*.trycloudflare.com` (Quick Tunnel) or the custom domain (Named Tunnel). Traffic inside the tunnel, between `cloudflared` and the supervisor, is plain HTTP on `localhost`.

When the Bloby Relay is in use, the relay server at `api.bloby.bot` terminates TLS for the `*.bloby.bot` domain. It then re-encrypts traffic to forward it through the Cloudflare Tunnel URL (which is itself HTTPS).

Locally, all inter-service communication (supervisor to worker, supervisor to backend, supervisor to Vite) uses `http://127.0.0.1:<port>`. There is no TLS between local services.
