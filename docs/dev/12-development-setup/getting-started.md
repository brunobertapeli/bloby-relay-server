---
title: "Getting Started"
---

## 2. Getting Started (for Contributors)

### Clone the repository

```bash
git clone https://github.com/<org>/fluxy.git
cd fluxy
```

### Install dependencies

```bash
npm install
```

#### What `npm install` does -- the postinstall script

The file `scripts/postinstall.js` runs automatically after `npm install`. In
**production** (installed via `npm install -g fluxy-bot`), postinstall performs
several steps:

1. Copies all code directories (`bin/`, `supervisor/`, `worker/`, `shared/`,
   `scripts/`) to `~/.fluxy/`.
2. Copies code files (`package.json`, `vite.config.ts`, `vite.fluxy.config.ts`,
   `tsconfig.json`, `postcss.config.js`, `components.json`) to `~/.fluxy/`.
3. Copies the `workspace/` template to `~/.fluxy/workspace/` **only on first
   install** (so user files, uploads, and databases are never overwritten).
4. Runs `npm install --omit=dev` inside `~/.fluxy/`.
5. Copies the pre-built chat UI from `dist-fluxy/` to `~/.fluxy/dist-fluxy/`,
   or builds it with `npm run build:fluxy` if the pre-built copy is absent.
6. Creates a `fluxy` symlink in `/usr/local/bin/` or `~/.local/bin/` (Unix), or
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
repository directory, not in `~/.fluxy/`.

### Understanding `~/.fluxy/` vs the repo directory

| Context | Working directory | Config location |
|---------|------------------|-----------------|
| **Development** (`.git` present) | The cloned repo root | `~/.fluxy/config.json` |
| **Production** (global install) | `~/.fluxy/` | `~/.fluxy/config.json` |

The detection logic lives in `bin/cli.js`:

```js
const IS_DEV = fs.existsSync(path.join(REPO_ROOT, '.git'));
const ROOT = IS_DEV ? REPO_ROOT : DATA_DIR;  // DATA_DIR = ~/.fluxy
```

In development mode, the supervisor reads source files from the repo. The config
file (`config.json`), the database (`memory.db`), and CLoudflare binaries always
live in `~/.fluxy/` regardless of mode.

Key paths (from `shared/paths.ts`):

| Constant | Value | Purpose |
|----------|-------|---------|
| `PKG_DIR` | Repo root (dev) or `~/.fluxy` (prod) | Base for all code lookups |
| `DATA_DIR` | `~/.fluxy/` | Config, database, cloudflared binary |
| `WORKSPACE_DIR` | `<PKG_DIR>/workspace/` | User's dashboard app, backend, files |
| `paths.config` | `~/.fluxy/config.json` | Runtime configuration |
| `paths.db` | `~/.fluxy/memory.db` | SQLite database for conversations, sessions |

### Setting up config.json

On first launch, `fluxy init` (or `fluxy start`) creates a default
`~/.fluxy/config.json`:

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

For development, you can create this file manually, or run `fluxy init` once and
cancel the tunnel setup. All fields are configured through the dashboard
onboarding flow at `http://localhost:3000/fluxy` after first start.

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
