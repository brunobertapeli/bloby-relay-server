---
title: Pulse & Scheduled Tasks
---

# Pulse & Scheduled Tasks

Fluxy can wake up on its own — no message from you needed.

## Pulse

Pulse is a periodic wake-up. Fluxy checks in at regular intervals, reviews its memory, and can take proactive actions.

Configure it in `workspace/PULSE.json`:

```json
{
  "enabled": true,
  "intervalMinutes": 30,
  "quietHours": { "start": "23:00", "end": "07:00" }
}
```

- **intervalMinutes** — How often Fluxy wakes up (in minutes)
- **quietHours** — No wake-ups during this window (respects your sleep)

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

- **schedule** — Standard cron expression (minute, hour, day, month, weekday)
- **task** — What to tell the agent when the cron fires
- **oneShot** — If true, the cron is automatically removed after it runs once

## What happens when they fire

1. Fluxy wakes up and reads its memory files
2. Processes the task or pulse check
3. If it has something to tell you, it sends a push notification
4. Goes back to sleep until the next trigger

## Examples

- *"Check my calendar every morning at 9am and summarize my day"*
- *"Every Friday at 5pm, generate a weekly report"*
- *"Every hour, check if any API endpoints are down"*

You can edit these files directly, or ask Fluxy to set up crons for you through the chat.
