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

1. Edit `supervisor/chat/fluxy-main.tsx` for top-level chat behavior
2. Add components in `supervisor/chat/src/components/`
3. If the feature needs to persist data, use the WebSocket sidecar channel (not HTTP POST from the iframe)
4. Rebuild: `npm run build:fluxy`
5. Restart the dev server and verify the feature works in the chat iframe

### Adding a New Skill

1. Create the skill directory structure:

```
workspace/skills/my-skill/
  .claude-plugin/
    plugin.json
  skills/
    my-tool.ts   # or whatever the skill implementation requires
```

1. Write the plugin manifest (`plugin.json`):

```json
{
  "name": "my-skill",
  "version": "1.0.0",
  "description": "What this skill does."
}
```

1. Skills are auto-discovered. Restart the agent (send a new chat message) and the skill will be loaded.

### Modifying the System Prompt

1. Edit `worker/prompts/fluxy-system-prompt.txt`
2. Use `$BOT` for the agent's name and `$HUMAN` for the user's name (substituted at runtime)
3. The prompt is read fresh on every agent turn -- no restart needed
4. Test by sending a chat message and observing the agent's behavior

### Adding a New Database Table

1. Add the `CREATE TABLE IF NOT EXISTS` to the `SCHEMA` string in `worker/db.ts`
2. Add query functions (CRUD) as named exports in `worker/db.ts`
3. Import the query functions in `worker/index.ts`
4. Add API routes that use the query functions
5. The table is created automatically on worker startup (via `db.exec(SCHEMA)`)
