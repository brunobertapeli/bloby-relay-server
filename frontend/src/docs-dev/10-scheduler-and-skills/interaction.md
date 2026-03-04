---
title: "Scheduler-Skills Interaction"
---

## How Scheduler and Skills Interact

The scheduler and skills system are designed to work together. A typical pattern:

1. **Define a skill** in `workspace/skills/` that encodes domain knowledge (e.g., how to generate a standup report).
2. **Define a cron** in `CRONS.json` that fires at the desired time (e.g., `"0 9 * * 1-5"` for weekday mornings).
3. **Optionally create a task file** at `workspace/tasks/{cron-id}.md` with detailed instructions.
4. When the cron fires, the scheduler triggers the agent with `<CRON>{id}</CRON>`.
5. The agent receives all skills as plugins. If the cron task aligns with a skill's activation criteria, the agent applies that skill's instructions.
6. The agent's response is parsed for `<Message>` blocks, which are delivered via WebSocket and push notification.

This architecture means the agent can autonomously perform complex, domain-specific tasks on a schedule, communicate results to the user even when they are not actively using the app, and make workspace changes that take effect immediately through backend restarts.
