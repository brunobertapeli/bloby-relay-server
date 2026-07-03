---
title: Pulse & Scheduled Tasks
---

# Pulse & Scheduled Tasks

Morphy can wake up on its own. No message from you needed.

## Pulse

Pulse is a periodic wake-up. Morphy checks in at regular intervals, reviews its memory, and can take proactive actions.

Configure it in `workspace/PULSE.json`:

```json
{
  "enabled": true,
  "intervalMinutes": 30,
  "quietHours": { "start": "23:00", "end": "07:00" }
}
```

- **intervalMinutes**: how often Morphy wakes up, in minutes
- **quietHours**: no Pulse wake-ups during this window (respects your sleep)

Quiet hours apply to Pulse only. A cron scheduled inside the quiet window still fires.

## Scheduled tasks (Crons)

For specific scheduled actions, use `workspace/CRONS.json`:

```json
[
  {
    "id": "morning-briefing",
    "schedule": "0 9 * * *",
    "task": "Give me a morning briefing with today's tasks",
    "enabled": true,
    "oneShot": false
  }
]
```

- **schedule**: standard cron expression (minute, hour, day, month, weekday)
- **task**: what to tell the agent when the cron fires
- **oneShot**: if true, the cron is removed automatically after it runs once
- **paused**: if true, the cron stays in the file (and keeps its task file) but does not fire until you resume it

Schedules run on the system's local time, not UTC. If you write `0 15 * * *`, it fires at 3pm in whatever timezone your instance uses.

### Task detail files

For complex crons, keep the `task` field as a short summary and put the full instructions in `workspace/tasks/<cron-id>.md`. The filename must match the cron's `id`. When the cron fires, Morphy receives the file's contents along with the trigger, so it follows the detailed plan instead of just the summary. One-shot crons clean up their task file when they are removed.

## What happens when they fire

1. Morphy wakes up and reads its memory files
2. Processes the task or pulse check
3. If it has something to tell you, the message is saved to your chat history, synced to any open chat, and sent as a push notification. On the Mac app it can also appear as a notch card.
4. Goes back to sleep until the next trigger

## Examples

- *"Check my calendar every morning at 9am and summarize my day"*
- *"Every Friday at 5pm, generate a weekly report"*
- *"Every hour, check if any API endpoints are down"*

## Managing them

You have three ways to manage Pulse and crons:

- **Settings**: open the Pulse & Crons screen in the app to toggle Pulse, adjust its interval and quiet hours, and pause, resume, or delete crons. It shows each cron's schedule in plain words, its next run time, and lets you download its task file.
- **Chat**: ask Morphy to set up, pause, or remove crons for you.
- **Files**: edit `PULSE.json` and `CRONS.json` directly.
