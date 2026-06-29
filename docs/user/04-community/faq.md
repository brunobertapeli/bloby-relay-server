---
title: FAQ
---

# FAQ

## Is Morphy free?

Yes. Morphy is open source and free to use. You need your own AI provider account (Claude or OpenAI), which has its own costs. The Morphy Relay free tier is also free.

## Does my data leave my machine?

Only the conversation goes to the AI provider's API. Your workspace files, database, and code stay on your machine.

## What about the tunnel — is that safe?

The tunnel encrypts all traffic via Cloudflare. Portal password protection is required for remote access. No one can access your workspace without your password. You can also enable two-factor authentication (2FA) for an extra layer of security — recommended if your bot is publicly accessible.

## Can Morphy break my workspace?

Morphy can only modify files inside the `workspace/` directory. It can't touch system files or its own core code. If something goes wrong in the workspace, tell Morphy to fix it or revert with git.

## Can I use Morphy without coding knowledge?

Yes. That's the point. Describe what you want in plain English, and Morphy builds it. You don't need to touch any code.

## Can multiple people use the same workspace?

The workspace is designed for one human + one agent. Multi-user support is on the roadmap.

## What if I lose my tunnel URL?

Run `morphy status` to see your current tunnel URL and relay URL. If you registered a handle with the relay, your URL never changes.

## How do I update Morphy?

```bash
morphy update
```

This downloads the latest version, updates the code, and restarts. Your workspace and data are preserved.

## How is Morphy different from OpenClaw?

OpenClaw is a terminal-based agent you reach via the command line, WhatsApp, or Telegram. Morphy is a PWA — you access it from your phone's browser like a native app. More importantly, Morphy comes with its own full-stack codebase (frontend, backend, database) that the agent builds and evolves through conversation. It's an agent and a playground.

## Can I use voice messages?

Yes. If you add an OpenAI API key during onboarding, Morphy uses Whisper to transcribe voice messages. Send a voice note from your phone and Morphy gets to work. It's like talking to your codebase.

## Can Morphy work offline?

Morphy needs internet access for the AI provider API. The workspace itself runs locally, but without an AI connection the agent can't respond.
