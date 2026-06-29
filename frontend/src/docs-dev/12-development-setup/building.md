---
title: "Building"
---

## 4. Building

### `npm run build`

```bash
npm run build
```

Runs two Vite builds sequentially:

```
vite build && vite build --config vite.chat.config.ts
```

1. **Dashboard build** (`vite.config.ts`):
   - Root: `workspace/client/`
   - Output: `dist/` (relative to project root)
   - Builds the dashboard single-page app

2. **Chat UI build** (`vite.chat.config.ts`):
   - Root: `supervisor/chat/`
   - Base path: `/bloby/`
   - Output: `dist-chat/` (relative to project root)
   - Builds two HTML entry points:
     - `chat.html` -- the main chat interface
     - `onboard.html` -- the onboarding/setup wizard
   - These static files are served by the supervisor at `/bloby/*`

### `npm run build:chat`

```bash
npm run build:chat
```

Builds only the chat UI:

```
vite build --config vite.chat.config.ts
```

### Build artifact locations

| Build | Config file | Source directory | Output directory |
|-------|------------|-----------------|------------------|
| Dashboard | `vite.config.ts` | `workspace/client/` | `dist/` |
| Chat UI | `vite.chat.config.ts` | `supervisor/chat/` | `dist-chat/` |

The `dist/` directory (dashboard build) is referenced by `tsconfig.json` in
`"outDir": "dist"` and is excluded from TypeScript compilation.

The `dist-chat/` directory is what gets shipped in the npm package and is
copied to `~/.morphy/dist-chat/` during installation. At runtime, the supervisor
serves these files for any request matching `/bloby/*`.

---
