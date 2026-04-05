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
vite build && vite build --config vite.bloby.config.ts
```

1. **Dashboard build** (`vite.config.ts`):
   - Root: `workspace/client/`
   - Output: `dist/` (relative to project root)
   - Builds the dashboard single-page app

2. **Chat UI build** (`vite.bloby.config.ts`):
   - Root: `supervisor/chat/`
   - Base path: `/bloby/`
   - Output: `dist-bloby/` (relative to project root)
   - Builds two HTML entry points:
     - `bloby.html` -- the main chat interface
     - `onboard.html` -- the onboarding/setup wizard
   - These static files are served by the supervisor at `/bloby/*`

### `npm run build:bloby`

```bash
npm run build:bloby
```

Builds only the chat UI:

```
vite build --config vite.bloby.config.ts
```

### Build artifact locations

| Build | Config file | Source directory | Output directory |
|-------|------------|-----------------|------------------|
| Dashboard | `vite.config.ts` | `workspace/client/` | `dist/` |
| Chat UI | `vite.bloby.config.ts` | `supervisor/chat/` | `dist-bloby/` |

The `dist/` directory (dashboard build) is referenced by `tsconfig.json` in
`"outDir": "dist"` and is excluded from TypeScript compilation.

The `dist-bloby/` directory is what gets shipped in the npm package and is
copied to `~/.bloby/dist-bloby/` during installation. At runtime, the supervisor
serves these files for any request matching `/bloby/*`.

---
