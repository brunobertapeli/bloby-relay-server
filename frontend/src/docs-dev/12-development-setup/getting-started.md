---
title: "Getting Started"
---

## 2. Getting Started

### Get the source

All development happens inside the `morphyagent` source tree. Open a shell at its
root before running any of the commands below.

### Install dependencies

```bash
npm install
```

#### What `npm install` does -- the postinstall script

The file `scripts/postinstall.js` runs automatically after `npm install`. In
**production** (installed via `npm install -g morphy`), postinstall performs
several steps:

1. Copies all code directories (`bin/`, `supervisor/`, `worker/`, `shared/`,
   `scripts/`) to `~/.morphy/`.
2. Copies code files (`package.json`, `vite.config.ts`, `vite.chat.config.ts`,
   `tsconfig.json`, `postcss.config.js`, `components.json`) to `~/.morphy/`.
3. Copies the `workspace/` template to `~/.morphy/workspace/` **only on first
   install** (so user files, uploads, and databases are never overwritten).
4. Runs `npm install --omit=dev` inside `~/.morphy/`.
5. Copies the pre-built chat UI from `dist-chat/` to `~/.morphy/dist-chat/`,
   or builds it with `npm run build:chat` if the pre-built copy is absent.
6. Creates a `morphy` symlink in `/usr/local/bin/` or `~/.local/bin/` (Unix), or
   relies on npm's bin linking (Windows).

However, **in development**, the postinstall script **does nothing**. It detects
the `.git` directory and exits immediately:

```js
// Dev guard: don't interfere with development
if (fs.existsSync(path.join(PKG_ROOT, '.git'))) {
  process.exit(0);
}
```

This means the cloned repo is self-contained. You work directly in the
repository directory, not in `~/.morphy/`.

### Understanding `~/.morphy/` vs the repo directory

| Context | Working directory | Config location |
|---------|------------------|-----------------|
| **Development** (`.git` present) | The cloned repo root | `~/.morphy/config.json` |
| **Production** (global install) | `~/.morphy/` | `~/.morphy/config.json` |

The detection logic lives in `bin/cli.js`:

```js
const IS_DEV = fs.existsSync(path.join(REPO_ROOT, '.git'));
const ROOT = IS_DEV ? REPO_ROOT : DATA_DIR;  // DATA_DIR = ~/.morphy
```

In development mode, the supervisor reads source files from the repo. The config
file (`config.json`) and the database (`memory.db`) always live in `~/.morphy/`
regardless of mode.

Key paths (from `shared/paths.ts`):

| Constant | Value | Purpose |
|----------|-------|---------|
| `PKG_DIR` | Repo root (dev) or `~/.morphy` (prod) | Base for all code lookups |
| `DATA_DIR` | `~/.morphy/` | Config and database |
| `WORKSPACE_DIR` | `<PKG_DIR>/workspace/` | User's dashboard app, backend, files |
| `paths.config` | `~/.morphy/config.json` | Runtime configuration |
| `paths.db` | `~/.morphy/memory.db` | SQLite database for conversations, sessions |

### Setting up config.json

On first launch, `morphy init` (or `morphy start`) creates a default
`~/.morphy/config.json`:

```json
{
  "port": 7400,
  "username": "",
  "ai": {
    "provider": "",
    "model": "",
    "apiKey": ""
  },
  "tunnel": {
    "mode": "relay"
  },
  "relay": {
    "token": "",
    "tier": "",
    "url": ""
  }
}
```

For development, you can create this file manually, or run `morphy init` once to
generate it. All fields are configured through the dashboard onboarding flow at
`http://localhost:7400/bloby` after first start.

The `BotConfig` TypeScript interface (in `shared/config.ts`):

```typescript
interface BotConfig {
  port: number;             // Base port (default 7400)
  username: string;
  ai: {
    provider: 'openai' | 'anthropic' | 'ollama' | 'pi' | '';
    model: string;
    apiKey: string;
    baseUrl?: string;       // For Ollama or custom endpoints
  };
  tunnel: {
    // 'relay' = persistent carrier into the bot's Durable Object (default).
    // 'off'   = no tunnel (managed/hosted bots reached directly).
    mode: 'off' | 'relay';
    name?: string;          // legacy (unused; retained for old configs)
    domain?: string;        // legacy (unused)
    configPath?: string;    // legacy (unused)
  };
  relay: {
    token: string;
    tier: string;
    url: string;
  };
  tunnelUrl?: string;       // Written once at runtime; the carrier URL is derived and stable
}
```

---
