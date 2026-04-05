---
title: "Making Changes"
---

### Adding a New API Endpoint

All platform API endpoints live in `worker/index.ts`. The worker is an Express app.

1. Add your route handler in `worker/index.ts`:

```typescript
app.get('/api/my-feature', (_req, res) => {
  const data = getMyFeatureData(); // from db.ts
  res.json({ data });
});

app.post('/api/my-feature', (req, res) => {
  const { param1, param2 } = req.body;
  if (!param1) return res.status(400).json({ error: 'param1 required' });
  saveMyFeature(param1, param2); // from db.ts
  res.json({ ok: true });
});
```

1. If your endpoint needs database access, add the query functions to `worker/db.ts`:

```typescript
export function getMyFeatureData() {
  return db.prepare('SELECT * FROM my_table ORDER BY created_at DESC').all();
}

export function saveMyFeature(param1: string, param2: string) {
  db.prepare('INSERT INTO my_table (param1, param2) VALUES (?, ?)').run(param1, param2);
}
```

1. Import the new functions in `worker/index.ts`.

2. POST/PUT/DELETE endpoints are automatically auth-gated by the supervisor's auth middleware (Bearer token validation). If your endpoint should be publicly accessible, add its path to the exempt list in the supervisor's auth check.

### Adding a New Supervisor Feature

Supervisor features live in `supervisor/`. Follow the pattern of existing modules:

1. Create a new file: `supervisor/my-feature.ts`
2. Export named functions:

```typescript
import { log } from '../shared/logger.js';

export function startMyFeature(): void {
  log.info('My feature started');
}

export function stopMyFeature(): void {
  log.info('My feature stopped');
}
```

1. Import and wire it up in `supervisor/index.ts` -- in the startup sequence and in the graceful shutdown handler.

### Adding a New Dashboard UI Component

Dashboard components live in `workspace/client/src/`.

- **Pages:** `workspace/client/src/components/Dashboard/` (or create a new page directory)
- **Reusable UI:** `workspace/client/src/components/ui/` (shadcn/ui style components)
- **Layout:** `workspace/client/src/components/Layout/`
- **Utilities:** `workspace/client/src/lib/`

Follow the existing pattern: React functional components with TypeScript, Tailwind CSS for styling, `cn()` utility for conditional classes.

```typescript
import { cn } from '@/lib/utils';

interface MyComponentProps {
  title: string;
  className?: string;
}

export function MyComponent({ title, className }: MyComponentProps) {
  return (
    <div className={cn('p-4 rounded-lg', className)}>
      <h2>{title}</h2>
    </div>
  );
}
```

### Adding a New Chat Feature

Chat components live in `supervisor/chat/`.

- **Main chat logic:** `supervisor/chat/bloby-main.tsx`
- **Shared components:** `supervisor/chat/src/components/`
- **Hooks:** `supervisor/chat/src/hooks/`
- **Utilities:** `supervisor/chat/src/lib/`

After making changes to the chat source, rebuild: `npm run build:bloby`.

Remember the relay constraint documented in `supervisor/chat/ARCHITECTURE.md`: mutations from the chat iframe must go through WebSocket, not HTTP POST. Use the WebSocket sidecar channel for any state-changing operations.

### Adding a New Agent Capability

The agent's capabilities come from three sources:

1. **System prompt** (`worker/prompts/bloby-system-prompt.txt`): Defines the agent's personality, rules, and knowledge of the workspace. Uses `$BOT` and `$HUMAN` placeholders that are replaced at runtime.

2. **Agent SDK tools**: The agent uses the Claude Agent SDK with `permissionMode: 'bypassPermissions'` and a `cwd` of `workspace/`. It gets standard tools (Read, Write, Edit, Bash, etc.) by default.

3. **Skills** (`workspace/skills/`): Plugin-style extensions. Each skill is a directory with a `.claude-plugin/plugin.json` file:

```
workspace/skills/my-skill/
  .claude-plugin/
    plugin.json      # { "name": "my-skill", "version": "1.0.0", "description": "..." }
  skills/
    # skill implementation files
```

Skills are auto-discovered at agent query time -- any folder in `workspace/skills/` with a valid plugin.json is loaded.

1. **MCP servers** (`workspace/MCP.json`): External tool servers in the Model Context Protocol format:

```json
{
  "server-name": {
    "command": "npx",
    "args": ["-y", "some-mcp-server"],
    "env": { "API_KEY": "..." }
  }
}
```

### Adding a Database Table or Column

All schema lives in `worker/db.ts`.

**New table:** Add the `CREATE TABLE IF NOT EXISTS` statement to the `SCHEMA` constant at the top of the file. Use the existing patterns:

```sql
CREATE TABLE IF NOT EXISTS my_table (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**New column on an existing table:** Add a migration block in `initDb()` after the schema creation:

```typescript
// Migration: add my_column if missing
const myCols = db.prepare("PRAGMA table_info(my_table)").all() as { name: string }[];
if (!myCols.some((c) => c.name === 'my_column')) {
  db.exec('ALTER TABLE my_table ADD COLUMN my_column TEXT');
}
```

This pattern ensures backward compatibility -- existing databases get the new column added on startup, new databases get it from the schema.

Then add the corresponding query functions:

```typescript
export function getMyData(id: string) {
  return db.prepare('SELECT * FROM my_table WHERE id = ?').get(id);
}
```
