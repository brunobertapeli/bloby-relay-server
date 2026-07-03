---
title: Memory System
---

# Memory System

Morphy wakes up fresh each session. What it remembers lives in plain markdown files in the workspace, plus a saved chat history.

## How it works

Every time Morphy wakes up (new conversation, pulse, cron), these files are loaded into its system prompt:

| File | Purpose |
|------|---------|
| `MYSELF.md` | Agent's identity, personality, and operating rules |
| `MYHUMAN.md` | Who you are: your name, preferences, context |
| `MEMORY.md` | Long-term curated knowledge |

Daily notes in `memory/YYYY-MM-DD.md` are not injected. Morphy's wake-up routine tells it to read today's and yesterday's notes itself. If you ask about something older, it searches the whole `memory/` folder for it.

In the live dashboard chat, the memory files are injected once when the conversation starts, and the context then grows turn by turn. One-shot runs (pulses, crons, channel messages) get a fresh injection every time.

## Conversation history

The files are not the only continuity. When a session starts, Morphy also receives your most recent chat messages so it can pick up where you left off. The full chat history is stored in a local database at `~/.morphy/memory.db`, and Morphy can search it as a last resort when you say it should remember something.

## Daily notes

As you work together, Morphy logs events in daily note files. What was built, what broke, what decisions were made. These are append-only working logs. Morphy adds to them but doesn't delete from them.

## Long-term memory

Periodically, Morphy reviews its daily notes and distills the important stuff into `MEMORY.md`. Patterns, preferences, lessons learned. It also prunes stale entries, so the file stays concise instead of growing forever.

## You can help

- Tell Morphy to remember something: *"Remember that I prefer dark themes"*
- Tell it to forget: *"Forget the old API key format"*
- Edit the files directly if you want. They are just markdown.

## Golden rule

A thought not written down is a thought lost. If Morphy doesn't write something to a file before the session ends, it won't carry it into the next one.
