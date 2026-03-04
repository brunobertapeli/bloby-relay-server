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
vite build && vite build --config vite.fluxy.config.ts
```

1. **Dashboard build** (`vite.config.ts`):
   - Root: `workspace/client/`
   - Output: `dist/` (relative to project root)
   - Builds the dashboard single-page app

2. **Chat UI build** (`vite.fluxy.config.ts`):
   - Root: `supervisor/chat/`
   - Base path: `/fluxy/`
   - Output: `dist-fluxy/` (relative to project root)
   - Builds two HTML entry points:
     - `fluxy.html` -- the main chat interface
     - `onboard.html` -- the onboarding/setup wizard
   - These static files are served by the supervisor at `/fluxy/*`

### `npm run build:fluxy`

```bash
npm run build:fluxy
```

Builds only the chat UI:

```
vite build --config vite.fluxy.config.ts
```

### Build artifact locations

| Build | Config file | Source directory | Output directory |
|-------|------------|-----------------|------------------|
| Dashboard | `vite.config.ts` | `workspace/client/` | `dist/` |
| Chat UI | `vite.fluxy.config.ts` | `supervisor/chat/` | `dist-fluxy/` |

The `dist/` directory (dashboard build) is referenced by `tsconfig.json` in
`"outDir": "dist"` and is excluded from TypeScript compilation.

The `dist-fluxy/` directory is what gets shipped in the npm package and is
copied to `~/.fluxy/dist-fluxy/` during installation. At runtime, the supervisor
serves these files for any request matching `/fluxy/*`.

---
