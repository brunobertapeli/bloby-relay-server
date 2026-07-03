---
title: Chat Bubble
---

# Chat Bubble

The chat bubble is how you talk to Morphy. It floats in the bottom-right corner of your workspace, and it stays up even when the workspace does not.

## Indestructible by design

The chat lives in its own iframe under a minimal top-level shell that never reloads. Your workspace runs in a separate iframe next to it. All rebuilds, reloads, and error screens happen inside the workspace frame, never in the shell. This is a critical design choice:

- **If the agent breaks the workspace, the chat survives.** You can always reach Morphy and ask for fixes.
- No CSS or JavaScript conflicts between the chat and your app
- The chat is always accessible, no matter what state the workspace is in

This is what makes Morphy safe to use as a vibe coding tool. The agent has full freedom to experiment with your workspace, and you always have a way to talk to it.

## What you can do

- Ask Morphy to build new features
- Report bugs and have them fixed
- Ask questions about your workspace
- Request changes to existing features
- Use the mic for voice input. Without Whisper it uses your browser's built-in dictation (Chrome, Edge, or Safari). Enable Whisper in Settings to send recorded voice messages from any browser.
- Attach files of any type for context, up to about 12 MB each. On mobile you can snap a photo with the camera, and you can paste images straight from your clipboard.
- Stop a response mid-stream. While Morphy is replying, the send button becomes a stop button.

## Multi-device sync

If you have the workspace open on multiple devices, messages sync across all of them in real time via WebSocket. Send a message from your phone and see it on your laptop.

## Push notifications

When Morphy sends you a proactive message (from a scheduled task or pulse), it can push a notification to your phone or browser, even if the tab is closed. Push is off until you turn it on. Tap the bell icon at the top of the chat and accept the browser's permission prompt. Each device subscribes separately, so enable it on every device where you want notifications.

## The chat is the interface

There is no drag-and-drop builder and no config files to edit. If you want something changed in your workspace, say it. The one panel you will use is the Settings menu inside the chat, which covers setup: your AI provider login, agent and user names, voice input, portal password, and remote access.
