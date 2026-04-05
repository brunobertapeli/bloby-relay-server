---
title: "Coding Standards"
---

### TypeScript Configuration

The project uses strict TypeScript with the following key settings (from `tsconfig.json`):

- **Target:** `ES2022` -- use modern JavaScript features (top-level await, `Array.at()`, etc.)
- **Module:** `ESNext` with `bundler` module resolution
- **Strict mode:** Enabled -- no implicit any, strict null checks, etc.
- **JSX:** `react-jsx` (automatic runtime)

### Import Conventions

**Path aliases** defined in `tsconfig.json`:

```typescript
// Dashboard components (workspace/client/src/*)
import { cn } from '@/lib/utils';               // resolves to workspace/client/src/lib/utils
import { Button } from '@/components/ui/button'; // resolves to workspace/client/src/components/ui/button
```

Note: The `@` alias resolves differently depending on which Vite config is in play:

- `vite.config.ts` (dashboard): `@` = `workspace/client/src/`
- `vite.bloby.config.ts` (chat): `@` = `supervisor/chat/src/`

**Server-side imports** use relative paths with `.js` extensions (required by ESM):

```typescript
// Correct
import { loadConfig } from '../shared/config.js';
import { paths, PKG_DIR } from '../shared/paths.js';
import { log } from '../shared/logger.js';

// Wrong -- missing .js extension
import { loadConfig } from '../shared/config';
```

### Export Patterns

The codebase uses **named exports exclusively**. There are no default exports on the server side.

```typescript
// Correct
export function createConversation(title?: string) { ... }
export function listConversations(limit = 50) { ... }
export const log = { info: ..., warn: ..., error: ..., ok: ... };

// Avoid
export default function createConversation(...) { ... }
```

Client-side React components follow the same convention:

```typescript
// Correct
export function ErrorBoundary({ children }: { children: React.ReactNode }) { ... }

// The one exception: Vite config files use `export default defineConfig(...)` as required by Vite.
```

### Naming Conventions

- **Files:** `kebab-case.ts` for all source files (`bloby-agent.ts`, `file-saver.ts`, `claude-auth.ts`)
- **React components:** `PascalCase.tsx` (`OnboardWizard.tsx`, `ErrorBoundary.tsx`)
- **Functions:** `camelCase` (`spawnWorker`, `loadConfig`, `startBlobyAgentQuery`)
- **Constants:** `UPPER_SNAKE_CASE` for module-level constants (`PKG_DIR`, `DATA_DIR`, `MAX_RESTARTS`, `STABLE_THRESHOLD`)
- **Interfaces/Types:** `PascalCase` (`BotConfig`, `AiProvider`, `ChatMessage`, `RecentMessage`)
- **Database tables:** `snake_case` (`push_subscriptions`, `trusted_devices`)
- **API routes:** REST-style with `/api/` prefix (`/api/conversations`, `/api/settings`, `/api/onboard/status`)

### Error Handling Patterns

**Server-side:** Use try/catch with the shared logger. Never let errors crash the process silently.

```typescript
try {
  const result = await someOperation();
} catch (err) {
  log.error(`Operation failed: ${err instanceof Error ? err.message : err}`);
}
```

**Child process errors:** Log, count restarts, and back off. Reset the counter if the process ran stably for 30 seconds.

```typescript
child.on('exit', (code) => {
  if (intentionallyStopped) return;
  log.warn(`Worker exited unexpectedly (code ${code})`);
  if (Date.now() - lastSpawnTime > STABLE_THRESHOLD) restarts = 0;
  if (restarts < MAX_RESTARTS) {
    restarts++;
    setTimeout(() => spawnWorker(port), 1000 * restarts);
  } else {
    log.error('Worker failed too many times.');
  }
});
```

**Database operations:** The `db.ts` module exports small, focused query functions. Each function handles its own SQL. Callers never write raw SQL -- they call a named function.

**API responses:** All worker API responses set `Cache-Control: no-store, no-cache, must-revalidate` to prevent stale data through the relay/CDN. Return JSON with consistent shapes:

```typescript
// Success
res.json({ ok: true, data: result });

// Error
res.status(400).json({ error: 'Description of what went wrong' });
```

### Port Allocation

Ports are computed from a configurable base port (default 3000):

| Service | Port | Computation |
|---|---|---|
| Supervisor | 3000 | `basePort` |
| Worker | 3001 | `basePort + 1` |
| Vite Dev Server | 3002 | `basePort + 2` |
| User Backend | 3004 | `basePort + 4` |

**Rule: Never hardcode port numbers.** Always compute from the base port or read from environment variables (`WORKER_PORT`, `BACKEND_PORT`).
