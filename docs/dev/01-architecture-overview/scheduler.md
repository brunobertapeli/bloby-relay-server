---
title: "Scheduler"
---

The scheduler runs in-process within the supervisor (not a separate child process). It ticks every 60 seconds and checks two configuration files in the workspace.

Source: `supervisor/scheduler.ts`

### PULSE

Configured in `workspace/PULSE.json`:

```json
{
    "enabled": true,
    "intervalMinutes": 30,
    "quietHours": { "start": "23:00", "end": "07:00" }
}
```

When a pulse fires, the scheduler calls `triggerAgent('<PULSE/>', 'pulse')`. The agent receives a `<PULSE/>` prompt and can take proactive action -- check notes, review tasks, update memory, or message the user.

Quiet hours support overnight wrapping (e.g., 23:00-07:00 correctly spans midnight).

### CRON

Configured in `workspace/CRONS.json`:

```json
[
    {
        "id": "weather-check",
        "schedule": "0 9 * * *",
        "task": "Check the weather",
        "enabled": true,
        "oneShot": false
    }
]
```

The scheduler evaluates cron expressions using `cron-parser`. Each cron is checked against the current minute and only fires once per minute (tracked via `lastCronRuns` map).

One-shot crons are automatically removed from `CRONS.json` after they fire. The removal is deferred until the agent query completes, so the agent can still read `CRONS.json` during its turn.

### Agent Trigger Flow

```plain
tick()
  |
  v
triggerAgent(prompt, label)          scheduler.ts:120
  |
  +-- Get or create conversation     (workerApi)
  +-- Fetch bot name for push title  (workerApi)
  +-- startBlobyAgentQuery(...)
  |
  v
On bot:done:
  +-- Extract <Message>...</Message> blocks from response
  +-- Save each message to DB
  +-- broadcastBloby('chat:sync', ...) to all connected clients
  +-- POST /api/push/send for each message (push notification)
  +-- If usedFileTools: restartBackend()
```

---
