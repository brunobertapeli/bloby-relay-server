---
title: "Memory System"
---

## 5. Memory System

### 5.1 Overview

The agent's memory system is entirely file-based. The system prompt states this principle clearly:

> "You wake up fresh each session. Files are your **only** persistence layer. There is no other way to remember anything."

Memory files live in the `workspace/` directory and are read fresh from disk and injected into the system prompt whenever a conversation or one-shot query starts (see Section 2.3).

### 5.2 MYSELF.md -- Agent Identity

**Path:** `workspace/MYSELF.md`

This file defines the agent's sense of self -- its personality, values, working style, and quirks. The system prompt (`worker/prompts/bloby-system-prompt.txt`) describes it as "Your operating manual and sense of self".

The default content (from the file as shipped):

```markdown
## My Nature
I'm more than a code assistant. I can be whatever the situation demands...

## Wake-Up Sequence
1. Memory files are injected into my context automatically...
2. Check today's and yesterday's daily notes in `memory/`.
3. Check `MEMORY.md` for long-term context.
4. Get to work.
```

The agent is explicitly told this file is its own to change: "Edit it when you learn something fundamental about yourself. If you change this file, mention it to your human -- it's your soul, and they should know."

### 5.3 MYHUMAN.md -- User Profile

**Path:** `workspace/MYHUMAN.md`

Contains everything the agent knows about its human: name, communication style, projects, preferences, what annoys them, what makes them happy. The system prompt describes it as a profile built "through conversation -- you're learning about a person, not building a dossier". Channel preferences (which channels the agent may use for proactive messages, and when) also live here under a `## Channel Preferences` heading.

This file is populated and updated by the agent over time as it learns about the user.

### 5.4 MEMORY.md -- Curated Long-Term Knowledge

**Path:** `workspace/MEMORY.md`

The agent's distilled, curated understanding of its world. The system prompt distinguishes this from raw logs: "Think of daily notes as a journal; this is your long-term understanding of the world."

What belongs here:

- Confirmed user preferences and patterns
- Important decisions and their reasoning
- Project context spanning multiple days
- Lessons learned from mistakes
- Technical patterns specific to the workspace

The system prompt instructs the agent to periodically review daily notes and promote what is worth keeping, while removing stale entries: "This file should stay concise and current -- not grow forever."

### 5.5 Daily Notes -- memory/YYYY-MM-DD.md

**Path:** `workspace/memory/YYYY-MM-DD.md`

Raw, append-only logs of each day's activity. The agent writes timestamped entries as it works. These capture:

- What was built, changed, or fixed
- Decisions made and why
- User preferences revealed through conversation
- Problems encountered and solved
- Tasks started but not finished

The system prompt emphasizes these are working logs, not polished documents.

### 5.6 How Memory is Read and Injected

Each provider harness (`supervisor/harnesses/claude.ts`, `supervisor/harnesses/codex.ts`, `supervisor/harnesses/pi/index.ts`) has a `readMemoryFile()` function that reads each file synchronously:

```ts
function readMemoryFile(filename: string): string {
  try {
    const content = fs.readFileSync(path.join(WORKSPACE_DIR, filename), 'utf-8').trim();
    return content || '(empty)';
  } catch {
    return '(empty)';
  }
}
```

The files are collected via `readMemoryFiles()` and appended to the base prompt produced by `assembleSystemPrompt()` (in `worker/prompts/prompt-assembler.ts`). All three harnesses inject the same set, so memory behaves identically regardless of provider. The agent sees the files as plain text under markdown headings in its system prompt context.

Critically, the system prompt tells the agent: "Your memory files (MYSELF.md, MYHUMAN.md, MEMORY.md) are provided below in this system prompt. You already have their contents -- do not re-read them with tools."

However, the agent is instructed to **write** to these files whenever it learns something worth remembering: "You should still WRITE to all memory files whenever you learn something worth remembering."

### 5.7 Config Files in Context

In addition to memory files, two configuration files are injected into the agent's context:

- **PULSE.json** -- The pulse scheduler configuration (enabled, interval, quiet hours)
- **CRONS.json** -- Array of scheduled tasks with their cron expressions

These are injected so the agent can reference and modify them when the user asks to change scheduling behavior.

---
