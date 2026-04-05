---
title: AI Models
---

# AI Models

Bloby supports two AI providers. The experience differs depending on which one you choose.

## Claude (Anthropic) — Recommended

When you use Claude, Bloby runs on the **Claude Agent SDK**. This gives it full tool access:

- Read, write, and edit files across your workspace
- Run terminal commands
- Search and navigate code
- Multi-turn conversations with persistent context

Available models: **Opus** (most capable), **Sonnet** (balanced), **Haiku** (fastest).

Authentication: OAuth sign-in with your Claude account, or paste an API key.

## OpenAI Codex

When you use OpenAI, Bloby uses a simpler chat interface:

- Conversational responses
- Code generation in messages
- No direct file editing or terminal access

Authentication: OAuth sign-in with your OpenAI account, or paste an API key.

## Which should you use?

**Claude is recommended.** The agent SDK integration gives Bloby the ability to actually read and modify your workspace files, run commands, and debug issues. With OpenAI, you're limited to a chat-only experience without direct workspace manipulation.

## Switching providers

You can switch providers through the onboarding wizard or by asking Bloby in the chat. The change takes effect on the next conversation.
