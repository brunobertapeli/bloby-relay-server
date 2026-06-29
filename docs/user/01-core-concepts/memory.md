---
title: Memory System
---

# Memory System

Morphy forgets everything between sessions. Files are the only thing that persists.

## How it works

Every time Morphy wakes up (new conversation, pulse, cron), it reads these files to rebuild its understanding:

| File | Purpose |
|------|---------|
| `MYSELF.md` | Agent's identity, personality, and operating rules |
| `MYHUMAN.md` | Who you are — your name, preferences, context |
| `MEMORY.md` | Long-term curated knowledge |
| `memory/YYYY-MM-DD.md` | Daily notes — what happened on each day |

These files are injected into the system prompt at the start of every query. They are the agent's entire memory.

## Daily notes

As you work together, Morphy logs events in daily note files. What was built, what broke, what decisions were made. These are append-only — Morphy adds to them but doesn't delete from them.

## Long-term memory

Periodically, Morphy reviews its daily notes and distills the important stuff into `MEMORY.md`. Patterns, preferences, lessons learned.

## You can help

- Tell Morphy to remember something: *"Remember that I prefer dark themes"*
- Tell it to forget: *"Forget the old API key format"*
- Edit the files directly if you want — they're just markdown

## Golden rule

A thought not written down is a thought lost. If Morphy doesn't save something to a file before the session ends, it's gone.
