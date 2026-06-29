---
title: "Common Tasks"
---

### Adding a New API Endpoint (End-to-End)

1. Define query functions in `worker/db.ts` if database access is needed
2. Add the Express route in `worker/index.ts`
3. If the endpoint should skip auth, add its path to the supervisor's auth-exempt list in `supervisor/index.ts`
4. Call the endpoint from the appropriate client:
   - From the dashboard: `fetch('/api/my-endpoint')` (proxied via Vite in dev, via supervisor in prod)
   - From the chat iframe: `fetch('/api/my-endpoint')` for GET; WebSocket message for POST/PUT/DELETE
5. Test via browser and check the worker's terminal output

### Adding a New Dashboard Page

1. Create a new component directory: `workspace/client/src/components/MyPage/`
2. Create the page component: `workspace/client/src/components/MyPage/MyPage.tsx`
3. Wire it into the router/navigation in `workspace/client/src/App.tsx`
4. Add any needed API calls using `fetch('/api/...')`
5. Verify HMR picks up the changes in the browser

### Adding a New Chat Feature

1. Edit `supervisor/chat/chat-main.tsx` for top-level chat behavior
2. Add components in `supervisor/chat/src/components/`
3. If the feature needs to persist data, use the WebSocket sidecar channel (not HTTP POST from the iframe)
4. Rebuild: `npm run build:chat`
5. Restart the dev server and verify the feature works in the chat iframe

### Adding a New Skill

1. Create the skill directory structure:

```
workspace/skills/my-skill/
  SKILL.md       # the skill definition
  references/    # optional supporting files
```

1. Write `SKILL.md` with YAML frontmatter -- `name` must match the folder name, `description` tells the agent when to use the skill:

```markdown
---
name: my-skill
description: What this skill does and when to use it.
---

# My Skill

Instructions for the agent...
```

1. No plugin manifest is needed. All three harnesses (Claude, Codex, Pi) pick the skill up automatically on the next session.

### Modifying the System Prompt

1. Edit `worker/prompts/bloby-system-prompt.txt`
2. Use `$BOT` for the agent's name and `$HUMAN` for the user's name (substituted at runtime)
3. The prompt is read fresh on every agent turn -- no restart needed
4. Test by sending a chat message and observing the agent's behavior

### Adding a New Database Table

1. Add the `CREATE TABLE IF NOT EXISTS` to the `SCHEMA` string in `worker/db.ts`
2. Add query functions (CRUD) as named exports in `worker/db.ts`
3. Import the query functions in `worker/index.ts`
4. Add API routes that use the query functions
5. The table is created automatically on worker startup (via `db.exec(SCHEMA)`)
