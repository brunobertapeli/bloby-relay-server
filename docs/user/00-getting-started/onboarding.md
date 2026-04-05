---
title: Onboarding Wizard
---

# Onboarding Wizard

After `bloby init`, the chat bubble opens with a step-by-step wizard. This is where you connect an AI provider and set up remote access.

## Steps

### 1. Welcome
A quick intro. Hit continue.

### 2. AI Provider
Choose between **Claude** (Anthropic) or **OpenAI Codex**.

Claude is recommended — it uses the Claude Agent SDK under the hood, which gives Bloby full tool access (reading, writing, editing files, running commands). OpenAI works too, but with simpler chat-only capabilities.

### 3. Model
Pick the specific model to use. For Claude: Opus, Sonnet, or Haiku. For OpenAI: the available GPT/Codex models.

### 4. Authentication
Two options depending on provider:
- **OAuth** — Sign in with your Claude or OpenAI account (recommended, no keys to manage)
- **API Key** — Paste your key manually

For Claude: you'll be redirected to Anthropic's login page, get a code, and paste it back. For OpenAI: the browser handles it automatically — no code to copy.

### 5. Handle (optional)
Register a public username with the Bloby Relay. This gives you a permanent URL like:
- `username.my.bloby.bot` (free)
- `bloby.bot/username` (premium, $5)

Skip this if you're using a named tunnel or private network.

### 6. Portal Password
Set a password to protect remote access. Anyone with your tunnel URL will need this to log in. Minimum 6 characters.

### 7. Two-Factor Authentication (optional)
You can enable TOTP-based 2FA right from this step. It's recommended if your bot is publicly accessible (Quick or Named Tunnel).

- Toggle it on and scan the QR code with an authenticator app (Google Authenticator, Authy, 1Password, etc.)
- On mobile, you can tap "Open in Authenticator" instead of scanning
- Enter the 6-digit code from your app to verify
- Save your **recovery codes** — each one works once if you lose access to your authenticator

You can also enable or disable 2FA later by re-running the onboarding wizard.

### 8. Voice (optional)
Add an OpenAI API key for Whisper voice transcription. This lets you send voice messages to Bloby.

### 9. Done
You're ready to go. Start chatting.
