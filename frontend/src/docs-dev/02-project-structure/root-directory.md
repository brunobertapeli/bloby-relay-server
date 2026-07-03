---
title: "Root Directory"
---

```plain
morphyagent/
  bin/              CLI entry point -- the `morphy` command
  supervisor/       Core supervisor process -- orchestrates everything
  worker/           Worker API -- database, auth, prompt assembly, REST endpoints (mounted in-process by the supervisor)
  shared/           Shared utilities -- config, paths, logging, AI providers, relay client
  workspace/        Agent-editable workspace -- the user's app lives here
  scripts/          Installation scripts (npm postinstall, curl installer)
  dist-chat/        Pre-built chat UI bundles (production output of vite.chat.config.ts)
```

Runtime data (config, database) does not live in the repo: it is stored in `~/.morphy` (see `shared/paths.ts`).

### Top-level files

| File                   | Purpose                                                                                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`         | npm package manifest. Declares `morphyagent` (v0.3.x), the `morphy` bin command, scripts, and all dependencies. ESM (`"type": "module"`). Requires Node >= 18.                                       |
| `package-lock.json`    | Deterministic dependency lockfile.                                                                                                                                                                   |
| `tsconfig.json`        | Root TypeScript configuration. Targets ES2022, ESNext modules, bundler resolution. Defines path aliases `@server/*` and `@client/*`.                                                                 |
| `vite.config.ts`       | Vite configuration for the **dashboard** (workspace/client). Roots at `workspace/client/`, builds to `dist/`, proxies `/api` to the supervisor on port 7400 and `/app/api` to the backend on port 7404. |
| `vite.chat.config.ts` | Vite configuration for the **chat SPA** (supervisor/chat). Roots at `supervisor/chat/`, builds to `dist-chat/` with multi-page entry points (`chat.html`, `onboard.html`). Base path is `/bloby/`. |
| `postcss.config.js`    | PostCSS config. Empty plugins block -- Tailwind CSS is handled via `@tailwindcss/vite` plugin, not PostCSS.                                                                                          |
| `components.json`      | shadcn/ui configuration. Uses `new-york` style, Tailwind v4 CSS variables, Lucide icons, and aliases pointing into `workspace/client/src/`.                                                          |
| `.gitignore`           | Ignores `node_modules/`, `dist/`, `dist-chat/`, `data/`, `bot.config.json`, `*.db`, `*.db-journal`, `.env`, and generated harness skill mirrors (`workspace/.codex/`, `workspace/.claude/`).         |
| `.npmignore`           | Excludes `node_modules/`, `.git/`, `.gitignore`, `.env`, `*.db`, `data/`, `@/`, `ARCHITECTURE.md`, `postcss.config.js` from npm publishes.                                                           |
| `README.md`            | User-facing documentation and setup guide.                                                                                                                                                           |

---
