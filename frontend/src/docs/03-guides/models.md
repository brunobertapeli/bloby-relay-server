---
title: AI Models
---

# AI Models

Morphy supports three AI providers: Claude (Anthropic), Codex (OpenAI), and Pi (bring your own model). You bring your own AI subscription or API key, and Morphy never bills you for AI usage. A managed Morphy provider appears in the setup wizard as coming soon.

## Claude (Anthropic)

Morphy runs on the official Claude Agent SDK with full tool access:

- Read, write, and edit files across your workspace
- Run terminal commands
- Search and navigate code
- Multi-turn conversations with persistent context
- MCP servers through `MCP.json`

Available models: **Opus 4.8** and **Opus 4.7** (each with a 1M-context variant), **Sonnet 5** (1M context), **Sonnet 4.6** (1M context), and **Haiku 4.5**.

Authentication: sign in with your Claude account. Morphy opens an authorization page, you approve, then paste the code back into the wizard. There is no API key option here. To use an Anthropic API key instead, pick the Pi provider and choose Anthropic (API key).

## Codex (OpenAI)

Morphy runs the official Codex app-server as a full agent, at parity with the Claude setup:

- Edits files and applies patches
- Runs terminal commands
- Multi-turn conversations with persistent context
- MCP servers through `MCP.json`

Available models: **GPT-5.6 Sol**, **Terra**, and **Luna** (limited preview), **GPT-5.5**, **GPT-5.4**, and **GPT-5.4-Mini**. Each model comes with a choice of reasoning effort (medium, high, or extra high).

Authentication: sign in with your ChatGPT account (Plus or Pro). The default flow shows a short code that you enter on openai.com. A paste-back link flow is available as a fallback. There is no API key option here. To use an OpenAI API key instead, pick the Pi provider and choose OpenAI (API key).

## Pi (bring your own model)

Pi connects Morphy to a model of your choice with an API key. Options include Google Gemini, DeepSeek, Groq, xAI (Grok), Cerebras, OpenRouter, Mistral, OpenAI (API key), and Anthropic (API key). You can also run local or self-managed models with Ollama, LM Studio, or any custom OpenAI-compatible endpoint. Those three need a base URL.

Live conversations on Pi get the full tool loop: file edits, terminal commands, and multi-turn context. One limit: MCP servers are not supported on Pi. Entries in `MCP.json` are ignored on this provider.

## Which should you use?

Claude and Codex both give Morphy full agent abilities, so the simplest choice is the provider whose subscription you already have. Pick Pi when you want a specific model, a cheaper API-key setup, or a local model.

## Switching providers

You can switch providers any time in the setup wizard or Settings. Pick the new provider and model, complete its sign-in, and save. Saving restarts your active conversations, so the change takes effect right away.
