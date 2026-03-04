---
title: "Scheduler"
---

## Part 1: Scheduler

Source file: `supervisor/scheduler.ts`

### 1.1 Architecture Overview

The scheduler is an in-process `setInterval` loop that runs inside the supervisor Node.js process. It does not spawn separate processes or threads. Every **60 seconds** (`60_000 ms`) the `tick()` function fires and evaluates two independent rule sets:

1. **Pulse** -- a simple interval-based heartbeat that wakes the agent periodically.
2. **Crons** -- standard cron-expression jobs that trigger the agent at precise times.

Both systems ultimately call the same internal function, `triggerAgent()`, which invokes the Claude Agent SDK via `startFluxyAgentQuery()` (defined in `supervisor/fluxy-agent.ts`). The agent receives a synthetic prompt -- either `<PULSE/>` or `<CRON>{id}</CRON>` -- that tells it which scheduled event woke it up.

The scheduler is started by the supervisor during boot and stopped on shutdown:

```typescript
// supervisor/index.ts -- startup
startScheduler({
    broadcastFluxy,
    workerApi,
    restartBackend: async () => {
        resetBackendRestarts();
        await stopBackend();
        spawnBackend(backendPort);
    },
    getModel: () => loadConfig().ai.model,
});

// supervisor/index.ts -- shutdown
stopScheduler();
```

The `SchedulerOpts` interface defines the four dependencies injected from the supervisor:

| Option           | Type                                     | Purpose                                                       |
| ---------------- | ---------------------------------------- | ------------------------------------------------------------- |
| `broadcastFluxy` | `(type: string, data: any) => void`      | Sends a WebSocket message to all connected Fluxy chat clients |
| `workerApi`      | `(path, method?, body?) => Promise<any>` | Calls the worker HTTP API (conversations, push, onboard)      |
| `restartBackend` | `() => void`                             | Restarts the workspace backend after file-tool mutations      |
| `getModel`       | `() => string`                           | Returns the currently configured AI model identifier          |

### 1.2 The PULSE System

#### Configuration -- `PULSE.json`

File path: `workspace/PULSE.json`

```json
{
    "enabled": true,
    "intervalMinutes": 30,
    "quietHours": {
        "start": "23:00",
        "end": "07:00"
    }
}
```

The `PulseConfig` TypeScript interface:

```typescript
interface PulseConfig {
    enabled: boolean;
    intervalMinutes: number;
    quietHours: { start: string; end: string };
}
```

| Field              | Type    | Default   | Description                                                            |
| ------------------ | ------- | --------- | ---------------------------------------------------------------------- |
| `enabled`          | boolean | `false`   | Master switch. When `false`, pulses never fire.                        |
| `intervalMinutes`  | number  | `30`      | Minimum minutes between pulses.                                        |
| `quietHours.start` | string  | `"23:00"` | Start of quiet window (24-hour `HH:MM`). No pulses during this window. |
| `quietHours.end`   | string  | `"07:00"` | End of quiet window.                                                   |

If the file is missing or cannot be parsed, the scheduler falls back to a safe default: `{ enabled: false, intervalMinutes: 30, quietHours: { start: '23:00', end: '07:00' } }`.

#### How Intervals Work

The scheduler tracks `lastPulseTime` as a Unix timestamp in memory (initialized to `Date.now()` at startup, so no pulse fires immediately). On every tick:

```plain
elapsed = now - lastPulseTime
intervalMs = pulse.intervalMinutes * 60 * 1000

if (elapsed >= intervalMs) -> fire pulse
```

This means the first pulse fires `intervalMinutes` after the supervisor starts. Subsequent pulses fire at least `intervalMinutes` apart.

#### Quiet Hours

Quiet hours support overnight spans (e.g. 23:00 to 07:00). The implementation converts the current time and both boundaries into "minutes since midnight" and correctly handles the wrap-around case where `start > end`:

```typescript
if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
} else {
    // Wraps midnight: 23:00-07:00
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}
```

When quiet hours are active, the pulse check is skipped entirely -- the `lastPulseTime` is **not** updated, so the next pulse fires immediately once quiet hours end (since the elapsed time will exceed the interval).

#### What Happens on a Pulse

When a pulse fires, the scheduler calls:

```typescript
triggerAgent('<PULSE/>', 'pulse');
```

This:

1. Creates a conversation ID in the form `pulse-{timestamp}`.
2. Retrieves (or creates) the user's current DB conversation via `workerApi('/api/context/current')`.
3. Fetches the bot name from `workerApi('/api/onboard/status')`.
4. Calls `startFluxyAgentQuery()` with prompt `<PULSE/>` and the current model.
5. The agent's system prompt already contains the full contents of `PULSE.json`, `CRONS.json`, `MYSELF.md`, `MYHUMAN.md`, and `MEMORY.md` -- so the agent has full context about why it was woken and what it knows about its user.

The agent can then decide what to do: check in with the user, summarize recent activity, run maintenance, etc. The agent communicates back through `<Message>` blocks in its response (see Section 1.5).

#### Use Cases

- Periodic check-ins ("Good morning, here is your day ahead")
- Proactive monitoring (the agent can use tools to inspect the workspace)
- Reminders and follow-ups based on `MEMORY.md` content
- Health checks on the workspace backend or database

### 1.3 The CRON System

#### Configuration -- `CRONS.json`

File path: `workspace/CRONS.json`

The file contains a JSON array of cron job definitions. When empty:

```json
[]
```

A populated example:

```json
[
    {
        "id": "morning-standup",
        "schedule": "0 9 * * 1-5",
        "task": "Run the daily standup skill and report to the user",
        "enabled": true
    },
    {
        "id": "one-time-reminder",
        "schedule": "30 14 15 3 *",
        "task": "Remind user about the deployment deadline",
        "enabled": true,
        "oneShot": true
    }
]
```

The `CronConfig` TypeScript interface:

```typescript
interface CronConfig {
    id: string;
    schedule: string;
    task: string;
    enabled: boolean;
    oneShot?: boolean;
}
```

| Field      | Type    | Required | Description                                                                                 |
| ---------- | ------- | -------- | ------------------------------------------------------------------------------------------- |
| `id`       | string  | Yes      | Unique identifier. Also used to locate the optional task file at `workspace/tasks/{id}.md`. |
| `schedule` | string  | Yes      | Standard 5-field cron expression (parsed by `cron-parser`).                                 |
| `task`     | string  | Yes      | Human-readable description of what the cron should do.                                      |
| `enabled`  | boolean | Yes      | Master switch for this individual cron.                                                     |
| `oneShot`  | boolean | No       | If `true`, the cron is automatically removed after it fires once.                           |

#### Cron Expression Parsing

Cron expressions are parsed using the `cron-parser` library (`CronExpressionParser.parse()`). Standard five-field format:

```plain
minute  hour  day-of-month  month  day-of-week
  0       9       *           *       1-5
```

The scheduler does NOT use `cron-parser` for "next occurrence" scheduling. Instead, on every tick it calls `cronMatchesNow()`, which:

1. Parses the expression.
2. Calls `interval.prev().toDate()` to get the most recent time the expression matched.
3. Compares year, month, date, hour, and minute of the previous match against `now`.
4. If they are identical, the cron matches the current minute.

This approach means the cron is evaluated once per tick (every 60 seconds), tolerates slight timing drift, and avoids the complexity of tracking the next-fire time.

#### Deduplication

A `Map<string, number>` called `lastCronRuns` tracks when each cron ID last fired. A cron only fires if its last run was more than 60 seconds ago:

```typescript
const lastRun = lastCronRuns.get(cron.id) || 0;
const oneMinuteAgo = now - 60_000;
if (lastRun < oneMinuteAgo) {
    lastCronRuns.set(cron.id, now);
    // fire
}
```

This prevents double-firing if the tick happens to straddle the same minute boundary.

#### Task Files

When a cron fires, the scheduler looks for an optional task-detail file at `workspace/tasks/{id}.md`. If found, its content is appended to the agent prompt:

```typescript
let cronPrompt = `<CRON>${cron.id}</CRON>`;
// If tasks/{id}.md exists:
cronPrompt += `\n<CRON_TASK_DETAIL>\n${taskContent}\n</CRON_TASK_DETAIL>`;
```

This allows cron jobs to carry rich, multi-line instructions without cramming them into `CRONS.json`.

#### One-Shot Crons

When `oneShot` is `true`:

1. The cron fires normally.
2. An `onComplete` callback is registered and passed to `triggerAgent()`.
3. After the agent query completes (on `bot:done`), the one-shot cron is removed from `CRONS.json` and its task file (`workspace/tasks/{id}.md`) is deleted.
4. Removal is deferred until agent completion so the agent can still read `CRONS.json` during its turn.

Additionally, on every tick the scheduler runs a cleanup pass that detects expired one-shot crons -- crons whose schedule has no future occurrences. These are removed immediately:

```typescript
const cleaned = crons.filter((c) => {
    if (c.oneShot && cronIsExpired(c.schedule)) {
        // remove task file, return false to filter out
        return false;
    }
    return true;
});
```

#### Execution Model

When a cron fires:

1. `triggerAgent(cronPrompt, cron.id, onComplete?)` is called.
2. A conversation ID is created: `cron-{id}-{timestamp}`.
3. The agent receives the prompt `<CRON>{id}</CRON>` (optionally with `<CRON_TASK_DETAIL>`).
4. The agent has access to all memory files, workspace tools, and skills.
5. On completion, if file tools were used (`Write`, `Edit`), the workspace backend is restarted.

### 1.4 Scheduler Lifecycle

#### Startup

```typescript
export function startScheduler(opts: SchedulerOpts) {
    schedulerOpts = opts;
    lastPulseTime = Date.now(); // prevents immediate pulse on startup
    intervalHandle = setInterval(tick, 60_000);
    log.info('[scheduler] Started -- checking every 60s');
}
```

Key points:

- `lastPulseTime` is set to `Date.now()` so the first pulse fires only after `intervalMinutes` elapse.
- `lastCronRuns` map starts empty, so crons that match the current minute on startup will fire.
- The config files (`PULSE.json`, `CRONS.json`) are re-read from disk on **every tick**, not cached. This means changes to the config take effect within 60 seconds without restarting.

#### The Tick

Each tick executes in this order:

1. Read `PULSE.json` from disk.
2. If pulse is enabled and not in quiet hours and interval has elapsed, fire pulse.
3. Read `CRONS.json` from disk.
4. For each enabled cron with a valid id and schedule:
    - Check if the schedule matches the current minute.
    - Check deduplication (last run was > 60s ago).
    - If both pass, fire the cron.
5. Run one-shot cleanup: remove expired one-shots from disk.

#### State Management

Module-level state (all reset on `stopScheduler()`):

| Variable         | Type                             | Purpose                                    |
| ---------------- | -------------------------------- | ------------------------------------------ |
| `lastPulseTime`  | `number`                         | Unix timestamp of last pulse fire          |
| `lastCronRuns`   | `Map<string, number>`            | Map of cron ID to last-fire Unix timestamp |
| `intervalHandle` | `ReturnType<typeof setInterval>` | Handle for the 60-second interval timer    |
| `schedulerOpts`  | `SchedulerOpts \| null`          | Injected dependencies from supervisor      |

#### Shutdown

```typescript
export function stopScheduler() {
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
    }
    schedulerOpts = null;
    log.info('[scheduler] Stopped');
}
```

Called from the supervisor's `shutdown()` function alongside worker, backend, tunnel, and Vite teardown.

### 1.5 Push Notifications and Message Delivery

When the agent completes a scheduled turn (pulse or cron), the `triggerAgent()` function processes its response for `<Message>` blocks. This is the mechanism by which the autonomous agent communicates with the user.

#### Message Extraction

The agent's full response text is scanned with a regex:

```typescript
const messageRegex = /<Message(?:\s+([^>]*))?>(([\s\S]*?))<\/Message>/g;
```

Each `<Message>` block can have an optional `title` attribute:

```xml
<Message title="Good Morning">Here is your daily summary...</Message>
```

#### Delivery Pipeline

For each extracted message, three things happen in parallel:

1. **Database persistence** -- The message is saved to the user's conversation in the DB via `workerApi('/api/conversations/{id}/messages', 'POST', ...)` with `role: 'assistant'`.

2. **WebSocket broadcast** -- The message is broadcast to all connected Fluxy chat clients as a `chat:sync` event:

    ```typescript
    broadcastFluxy('chat:sync', {
        conversationId: dbConvId,
        message: {
            role: 'assistant',
            content: messageContent,
            timestamp: msgTimestamp,
        },
    });
    ```

    This makes the message appear in real-time for any user who has the chat open.

3. **Push notification** -- A web push notification is sent via `workerApi('/api/push/send', 'POST', ...)`:

    ```typescript
    {
      title: titleMatch?.[1] || botName,  // from <Message title="..."> or agent name
      body: messageContent.slice(0, 200), // first 200 chars
      tag: `fluxy-{label}`,              // e.g. "fluxy-pulse" or "fluxy-morning-standup"
      url: '/',
    }
    ```

    The push notification reaches the user even when the browser tab is closed or the device is locked. The service worker (embedded in `supervisor/index.ts` as `SW_JS`) handles the `push` event, shows the notification with vibration, and on click focuses or opens the Fluxy chat.

#### Backend Restart After File Mutations

If the agent used file-writing tools (`Write` or `Edit`) during its scheduled turn, the scheduler restarts the workspace backend:

```typescript
if (eventData.usedFileTools) {
    log.info(`[scheduler] File tools used -- restarting backend`);
    restartBackend();
}
```

This ensures that any code changes the agent made to `workspace/backend/` take effect immediately.

---
