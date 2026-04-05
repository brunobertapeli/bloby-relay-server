---
title: "Getting Started"
---

## 2. Getting Started (for Contributors)

### Clone the repository

```bash
git clone https://github.com/<org>/bloby.git
cd bloby
```

### Install dependencies

```bash
npm install
```

#### What `npm install` does -- the postinstall script

The file `scripts/postinstall.js` runs automatically after `npm install`. In
**production** (installed via `npm install -g bloby-bot`), postinstall performs
several steps:

1. Copies all code directories (`bin/`, `supervisor/`, `worker/`, `shared/`,
   `scripts/`) to `~/.bloby/`.
2. Copies code files (`package.json`, `vite.config.ts`, `vite.bloby.config.ts`,
   `tsconfig.json`, `postcss.config.js`, `components.json`) to `~/.bloby/`.
3. Copies the `workspace/` template to `~/.bloby/workspace/` **only on first
   install** (so user files, uploads, and databases are never overwritten).
4. Runs `npm install --omit=dev` inside `~/.bloby/`.
5. Copies the pre-built chat UI from `dist-bloby/` to `~/.bloby/dist-bloby/`,
   or builds it with `npm run build:bloby` if the pre-built copy is absent.
6. Creates a `bloby` symlink in `/usr/local/bin/` or `~/.local/bin/` (Unix), or
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
repository directory, not in `~/.bloby/`.

### Understanding `~/.bloby/` vs the repo directory

| Context | Working directory | Config location |
|---------|------------------|-----------------|
| **Development** (`.git` present) | The cloned repo root | `~/.bloby/config.json` |
| **Production** (global install) | `~/.bloby/` | `~/.bloby/config.json` |

The detection logic lives in `bin/cli.js`:

```js
const IS_DEV = fs.existsSync(path.join(REPO_ROOT, '.git'));
const ROOT = IS_DEV ? REPO_ROOT : DATA_DIR;  // DATA_DIR = ~/.bloby
```

In development mode, the supervisor reads source files from the repo. The config
file (`config.json`), the database (`memory.db`), and CLoudflare binaries always
live in `~/.bloby/` regardless of mode.

Key paths (from `shared/paths.ts`):

| Constant | Value | Purpose |
|----------|-------|---------|
| `PKG_DIR` | Repo root (dev) or `~/.bloby` (prod) | Base for all code lookups |
| `DATA_DIR` | `~/.bloby/` | Config, database, cloudflared binary |
| `WORKSPACE_DIR` | `<PKG_DIR>/workspace/` | User's dashboard app, backend, files |
| `paths.config` | `~/.bloby/config.json` | Runtime configuration |
| `paths.db` | `~/.bloby/memory.db` | SQLite database for conversations, sessions |

### Setting up config.json

On first launch, `bloby init` (or `bloby start`) creates a default
`~/.bloby/config.json`:

```json
{
  "port": 3000,
  "username": "",
  "ai": {
    "provider": "",
    "model": "",
    "apiKey": ""
  },
  "tunnel": {
    "mode": "quick"
  },
  "relay": {
    "token": "",
    "tier": "",
    "url": ""
  }
}
```

For development, you can create this file manually, or run `bloby init` once and
cancel the tunnel setup. All fields are configured through the dashboard
onboarding flow at `http://localhost:3000/bloby` after first start.

The `BotConfig` TypeScript interface (in `shared/config.ts`):

```typescript
interface BotConfig {
  port: number;
  username: string;
  ai: {
    provider: 'openai' | 'anthropic' | 'ollama' | '';
    model: string;
    apiKey: string;
    baseUrl?: string;       // For Ollama or custom endpoints
  };
  tunnel: {
    mode: 'off' | 'quick' | 'named';
    name?: string;          // Named tunnel: tunnel name
    domain?: string;        // Named tunnel: your domain
    configPath?: string;    // Named tunnel: path to cloudflared config YAML
  };
  relay: {
    token: string;
    tier: string;
    url: string;
  };
  tunnelUrl?: string;       // Written at runtime by supervisor
}
```

---
