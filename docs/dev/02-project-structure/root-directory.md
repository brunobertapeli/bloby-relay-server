---
title: "Root Directory"
---

```plain
bloby/
  bin/              CLI entry point -- the `bloby` command
  supervisor/       Core supervisor process -- orchestrates everything
  worker/           Worker API -- database, auth, AI routing, REST endpoints
  shared/           Shared utilities -- config, paths, logging, AI providers, relay client
  workspace/        Agent-editable workspace -- the user's app lives here
  scripts/          Installation scripts (npm postinstall, curl installer)
  dist-bloby/       Pre-built chat UI bundles (production output of vite.bloby.config.ts)
  data/             Local development data (gitignored, never shipped)
```

### Top-level files

| File                   | Purpose                                                                                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`         | npm package manifest. Declares `bloby-bot` (v0.7.8), the `bloby` bin command, scripts, and all dependencies. ESM (`"type": "module"`). Requires Node >= 18.                                          |
| `package-lock.json`    | Deterministic dependency lockfile.                                                                                                                                                                   |
| `tsconfig.json`        | Root TypeScript configuration. Targets ES2022, ESNext modules, bundler resolution. Defines path aliases `@server/*` and `@client/*`.                                                                 |
| `vite.config.ts`       | Vite configuration for the **dashboard** (workspace/client). Roots at `workspace/client/`, builds to `dist/`, proxies `/api` to worker on port 3000 and `/app/api` to backend on port 3004.          |
| `vite.bloby.config.ts` | Vite configuration for the **chat SPA** (supervisor/chat). Roots at `supervisor/chat/`, builds to `dist-bloby/` with multi-page entry points (`bloby.html`, `onboard.html`). Base path is `/bloby/`. |
| `postcss.config.js`    | PostCSS config. Empty plugins block -- Tailwind CSS is handled via `@tailwindcss/vite` plugin, not PostCSS.                                                                                          |
| `components.json`      | shadcn/ui configuration. Uses `new-york` style, Tailwind v4 CSS variables, Lucide icons, and aliases pointing into `workspace/client/src/`.                                                          |
| `.gitignore`           | Ignores `node_modules/`, `dist/`, `data/`, `bot.config.json`, `*.db`, `*.db-journal`, `.env`.                                                                                                        |
| `.npmignore`           | Excludes `node_modules/`, `.git/`, `.gitignore`, `.env`, `*.db`, `data/`, `@/`, `ARCHITECTURE.md`, `postcss.config.js` from npm publishes.                                                           |
| `README.md`            | User-facing documentation and setup guide.                                                                                                                                                           |

---
