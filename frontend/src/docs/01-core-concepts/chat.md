---
title: Chat Bubble
---

# Chat Bubble

The chat bubble is how you talk to Fluxy. It floats in the bottom-right corner of your workspace — and it never goes down.

## Indestructible by design

The chat runs in an isolated iframe — a completely separate process from the workspace. This is a critical design choice:

- **If the agent breaks the workspace, the chat survives.** You can always reach Fluxy and ask for fixes.
- No CSS or JavaScript conflicts between the chat and your app
- The chat is always accessible, no matter what state the workspace is in

This is what makes Fluxy safe to use as a vibe coding tool. The agent has full freedom to experiment with your workspace, and you always have a way to talk to it.

## What you can do

- Ask Fluxy to build new features
- Report bugs and have them fixed
- Ask questions about your workspace
- Request changes to existing features
- Send voice messages (if Whisper is configured)
- Attach images or documents for context

## Multi-device sync

If you have the workspace open on multiple devices, messages sync across all of them in real time via WebSocket. Send a message from your phone and see it on your laptop.

## Push notifications

When Fluxy sends you a message (from a scheduled task or pulse), you'll get a push notification on your phone or browser — even if the tab is closed.

## The chat is the interface

There are no settings panels, no drag-and-drop builders. The chat is how you control everything. If you want something changed, say it.
