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

One-shot crons are automatically removed from `CRONS.json` after they fire. The removal is deferred until the agent query completes, so the agent can still read `CRONS.json` during its turn. Expired one-shots (schedule entirely in the past) are cleaned up too.

A cron can also carry `paused: true` (toggled via `/api/crons/pause`); paused crons neither fire nor advance state. If a task file exists at `workspace/tasks/<id>.md`, its content is injected into the cron prompt as `<CRON_TASK_DETAIL>`.

### Agent Trigger Flow

```plain
tick()
  |
  v
triggerAgent(prompt, label)          supervisor/scheduler.ts
  |
  +-- Build conversation id          (pulse-<ts> or cron-<id>-<ts>)
  +-- startBlobyAgentQuery(...)
  |
  v
On bot:done:
  +-- Extract <mac_push> / <Message> blocks (extractOutboundTags, outbound.ts)
  +-- deliverMac: send each <mac_push> to connected Mac-app sockets
  +-- deliverChat: persist each <Message> to the chat timeline, sync
  |   live clients, and fire a web push notification
  +-- If usedFileTools: restartBackend()
  +-- onTurnComplete: flush any queued self-update
```

Delivery goes through `outbound.ts`, the same parser and delivery path interactive turns use, so `<mac_push>` and `<Message>` behave identically on every kind of turn.

---
