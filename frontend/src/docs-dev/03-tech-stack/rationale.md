---
title: "Why These Choices"
---

### Why Express v5 over v4 (or Fastify, Hono, etc.)

Express v5 adds native async error handling -- `async` route handlers that throw or return rejected promises automatically forward errors to the error middleware without needing `try/catch` wrappers or `express-async-errors`. This eliminates an entire class of unhandled promise rejection bugs. The Express ecosystem (middleware, tutorials, community knowledge) is unmatched, and v5 is the natural upgrade path. Fastify or Hono would require rewriting all middleware patterns for marginal performance gains that do not matter in a single-user agent server.

### Why SQLite over PostgreSQL

Morphy is a **self-hosted, single-user** application designed to run on everything from a Raspberry Pi to a cloud VM. PostgreSQL imposes:

- A separate daemon to install, configure, and keep running.
- Memory overhead (minimum ~30 MB RSS) that matters on low-resource devices.
- Network-based access patterns that add latency for every query.

SQLite with WAL mode gives:

- Zero-config operation -- the database is a single file at `~/.morphy/memory.db`.
- Microsecond query latency (in-process, no network hop).
- Portable backups -- copy one file.
- `better-sqlite3`'s synchronous API means no callback/promise overhead per query.

For a single-user agent with a few thousand conversations, SQLite is faster, simpler, and more reliable.

### Why Vite over webpack

- **Speed**: Vite's native ESM dev server serves modules on-demand. No bundling during development. Cold start is sub-second even with heavy dependencies (Recharts, Framer Motion).
- **Dual config**: Vite's config format makes it trivial to build two independent apps (dashboard + chat) from the same project with clean separation.
- **Tailwind v4**: The `@tailwindcss/vite` plugin integrates natively, bypassing PostCSS entirely.
- **HMR**: Vite's HMR is attached directly to the supervisor's HTTP server (`hmr: { server: hmrServer }`), so hot reload rides the same connection as everything else -- including the Morphy relay -- without extra WebSocket ports.

### Why Zustand over Redux

Zustand is 1 KB minified. Redux Toolkit is ~12 KB. For a single-user dashboard with moderate state complexity, Redux's boilerplate (slices, reducers, actions, selectors, middleware) provides no benefit. Zustand stores are plain functions:

```typescript
const useStore = create((set) => ({
  count: 0,
  increment: () => set((s) => ({ count: s.count + 1 })),
}));
```

No providers, no wrappers, no context. Zustand v5 ships as a pure ESM package with first-class TypeScript support.

### Why React 19

React 19 ships the new `use()` hook, improved server-client serialization primitives, and `ref` as a prop (no more `forwardRef`). Morphy uses `react-jsx` automatic transform so there is no `import React from 'react'` boilerplate. The v19 concurrent renderer also improves streaming UI updates during agent token-by-token responses.

### Why http.createServer for the Supervisor (not Express)

The supervisor does not serve typical HTTP routes -- it is a **reverse proxy** and **WebSocket gateway**. Express adds overhead that provides no value here:

- Routing is simple prefix-matching (`/api/*`, `/bloby/*`, everything else).
- The supervisor never parses request bodies itself: `/api/*` requests are handed to the in-process worker Express app (`createWorkerApp()` in `worker/index.ts`) with no proxy hop, and everything else is piped untouched to the dashboard Vite dev server or the user's backend.
- WebSocket upgrade handling requires raw access to the `http.Server` instance.
- Vite's HMR WebSocket attaches directly to the server (requires `hmr: { server }`).

Using raw `http.createServer` keeps the supervisor lean, avoids double-parsing request bodies, and gives full control over the upgrade pipeline.

### Why Tailwind CSS v4

Tailwind v4 runs as a Vite plugin (`@tailwindcss/vite`), eliminating PostCSS from the pipeline entirely. CSS is processed at the Vite transform layer, which is faster and integrates with Vite's dependency graph for accurate HMR. The v4 engine also uses a Rust-based compiler (Oxide) for significantly faster builds compared to v3's JavaScript-based PostCSS plugin.

### Why the Claude Agent SDK over raw API calls

The raw Anthropic API (also in `shared/ai.ts`) supports streaming text, but not **tool use**. The Claude Agent SDK provides:

- Full tool execution loop with automatic multi-turn orchestration.
- File system tools (Read, Write, Edit, Glob, Grep) that the agent uses to modify workspace files.
- Skill and MCP server support for extensibility.
- Session resumption via `session_id` for conversation continuity across process restarts.
- Abort controller support for user-initiated stop.

OpenAI gets the same treatment through its own harness (`supervisor/harnesses/codex.ts`), which drives a `codex app-server` subprocess with full tool use. The raw API path in `shared/ai.ts` remains for the Ollama provider, which stays chat-only in Morphy's current architecture.

### Why Framer Motion (and no 3D stack)

UI animation across the dashboard and chat (sidebar transitions, the chat input bar, the image lightbox, the login screen) runs on Framer Motion's declarative `motion` components. Earlier builds carried Three.js and React Three Fiber for 3D dashboard elements; those dependencies were removed. A WebGL renderer adds megabytes of JavaScript and real GPU/CPU load for what was decorative motion, which matters on the low-resource devices Morphy targets. Framer Motion springs and CSS transforms deliver the same polish at a fraction of the cost.
