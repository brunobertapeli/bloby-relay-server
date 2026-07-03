---
title: "Networking & Relay"
---

This document covers the full networking stack of Morphy: how a local development machine is exposed to the public internet, how internal services are wired together through a reverse proxy, and how the Morphy Relay carrier gives every self-hosted bot a permanent domain name (`<handle>.open.morphyagent.com` free, `<handle>.morphyagent.com` premium) over a single persistent outbound connection. Relay mode is the default for self-hosted bots; there are no ephemeral tunnel URLs.
