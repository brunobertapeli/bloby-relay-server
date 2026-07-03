---
title: Onboarding Wizard
---

# Onboarding Wizard

After `morphy init`, open your dashboard in the browser. On first visit, a full-screen setup wizard walks you through naming your agent, securing it, and connecting an AI provider. On a managed instance there is no install step. The wizard appears the first time you open your agent's URL.

## Steps

### 1. Welcome
A quick intro. Hit continue.

### 2. Your Name
Tell the wizard your name. This is how your agent will address you.

### 3. Agent Name & Access
Give your bot a name. It doubles as your handle and is used throughout the app as your bot's identity. Registering it with the Morphy Relay gives you a permanent URL:

- `open.morphyagent.com/username` (free)
- `morphyagent.com/username` (premium, $5)

Premium handles are reserved on morphyagent.com first. You then activate the handle here with the 5-character code from your morphyagent.com account.

On a private-network install (chosen with `morphy init -advanced`), this step only names your bot. There is no public URL to claim.

### 4. Password & Two-Factor
Set a password for Morphy Chat. Anyone with your URL will need it to log in. Minimum 6 characters.

You can enable TOTP-based 2FA in the same step:

- Scan the QR code with an authenticator app (Google Authenticator, Authy, 1Password, or any TOTP app)
- On mobile, copy the secret key or open it directly in your authenticator
- Enter the 6-digit code from your app to verify
- Save your **recovery codes**. Each one works once if you lose access to your authenticator.

You can enable or disable 2FA later by re-running the wizard.

### 5. AI Provider
Pick a provider, authenticate, and select a model, all in one step. Four tiles:

- **Claude** (Anthropic). Uses the Claude Agent SDK, which gives Morphy full tool access: reading, writing, and editing files, running commands. Models include Opus 4.8 and Opus 4.7 (both with 1M-context variants), Sonnet 5, Sonnet 4.6, and Haiku 4.5.
- **Codex** (OpenAI). Also a full agentic harness with file editing, shell commands, and web search. Models include GPT-5.6 Sol, Terra, and Luna (preview), GPT-5.5, GPT-5.4, and GPT-5.4-Mini at different reasoning-effort levels.
- **Pi** (bring your own model). Connect Google Gemini, DeepSeek, Groq, xAI (Grok), Cerebras, OpenRouter, Mistral, Ollama, LM Studio, or any custom OpenAI-compatible endpoint. OpenAI and Anthropic API keys work here too.
- **Morphy** (managed provider, coming soon).

Claude and Codex sign in with your existing subscription, no API keys:

- **Claude**: the wizard opens Anthropic's login page. Sign in, copy the code it generates, and paste it back.
- **Codex**: sign in with a ChatGPT Plus or Pro account. The wizard shows a one-time code that you type on the OpenAI device page it opens for you. A fallback flow lets you paste a callback URL instead.
- **Pi**: paste the API key for your chosen provider, or point at a local Ollama or LM Studio server.

The model picker appears once authentication succeeds.

### 6. Voice (optional)
Voice input works out of the box using your browser's built-in speech recognition (Chrome, Edge, and Safari). For more accurate transcription that also works in Firefox, toggle on OpenAI Whisper and add an OpenAI API key (starts with `sk-`).

### 7. All Set
The final screen shows your agent's URL and your password, with copy and reveal controls. Accept the terms and privacy policy, then hit "Go to your agent" and start chatting.

## Re-running the wizard

Opening the wizard again turns it into a settings hub. Each screen saves on its own, and a jump menu takes you straight to any of them: Personal Info, Agent Name & Access, Security, AI Provider, Voice Messages, plus two screens not shown during initial onboarding, Environment Variables and Pulse & Crons.
