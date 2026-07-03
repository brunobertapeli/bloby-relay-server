---
title: FAQ
---

# FAQ

## How much does Morphy cost?

Self-hosting on your own hardware is free, and the built-in Morphy Relay has a free tier. The managed version is hosted on AWS in two plans: Starter at $29/mo (2 GB RAM) and Pro at $49/mo (4 GB RAM), with regions in North America (Virginia), Europe (Frankfurt), and Brazil (Sao Paulo). A premium handle is a one-time $5 fee. Either way, you bring your own AI: a Claude or ChatGPT subscription, an API key from providers like Gemini, DeepSeek, Groq, xAI, Mistral, or OpenRouter, or a free local model through Ollama or LM Studio.

## Does my data leave my machine?

The conversation goes to your AI provider, and that includes any workspace files the agent reads while working, since they become part of the context. If you self-host, the workspace itself stays on your machine. On the managed version it lives on your hosted instance. With a local model through Ollama or LM Studio, nothing leaves your machine at all.

## What about the tunnel? Is it safe?

The tunnel is Morphy's own carrier: a single encrypted outbound connection from your machine to Morphy's edge, authenticated with short-lived signed tickets. Nothing on your machine listens for inbound traffic. Portal password protection is required for remote access, and you can enable two-factor authentication (2FA) for an extra layer, recommended if your bot is publicly reachable. If you want no public URL at all, choose Private Network mode and reach your bot over your local network or a VPN like Tailscale. Managed instances skip the tunnel entirely and are served directly over HTTPS.

## Can Morphy break my workspace?

It can, so treat it like a capable collaborator rather than a sandboxed tool. Morphy has real access to your machine. It is instructed to work inside the `workspace/` directory, but that boundary is guidance, not an enforced sandbox. If something goes wrong, tell Morphy to fix it or revert with git, and keep backups of anything you care about.

## Can I use Morphy without coding knowledge?

Yes. That's the point. Describe what you want in plain English, and Morphy builds it. You don't need to touch any code.

## Can multiple people use the same workspace?

The workspace is designed for one human plus one agent. Multi-user support is on the roadmap.

## What if I lose my tunnel URL?

Run `morphy status` to see your bot's URLs. Your public URL is derived from your handle, so it never changes. Older versions used random rotating tunnel URLs; those are gone, and existing bots switch to the stable setup automatically when they update and restart.

## How do I update Morphy?

```bash
morphy update
```

This downloads the latest version, updates the code, and restarts. Your workspace and data are preserved.

## How is Morphy different from OpenClaw?

OpenClaw is a terminal-based agent. Morphy is a PWA, so you access it from your phone's browser like a native app, and it also connects to WhatsApp, Telegram, and Alexa. More importantly, Morphy comes with its own full-stack codebase (frontend, backend, database) that the agent builds and evolves through conversation. It's an agent and a playground.

## Can I use voice messages?

Yes. On browsers with built-in speech recognition, the mic works with no setup at all. If you add an OpenAI API key during onboarding, Morphy uses Whisper to transcribe instead, which also covers browsers without speech support. Send a voice note from your phone and Morphy gets to work. It's like talking to your codebase.

## Can Morphy work offline?

Cloud AI providers need internet, and so does reaching your bot remotely. The agent itself can run fully offline with a local model through Ollama or LM Studio, and the workspace runs locally either way.
