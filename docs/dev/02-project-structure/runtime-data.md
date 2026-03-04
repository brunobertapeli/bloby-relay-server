---
title: "Runtime Data"
---

When installed globally (`npm install -g fluxy-bot`) or via the curl installer, Fluxy copies its source to `~/.fluxy/` and operates from there. This directory also stores all runtime data.

```
~/.fluxy/
  config.json               Bot configuration (port, username, AI provider, tunnel mode, relay token)
  memory.db                 SQLite database (conversations, messages, settings, sessions, push subs, trusted devices)
  bin/
    cli.js                  Symlinked CLI entry point
    cloudflared             Cloudflare Tunnel binary (downloaded on first tunnel start)
    cloudflared.exe         Windows variant of the above
  workspace/                Cloned from package's workspace/ on first install (preserved on upgrades)
    client/                 Dashboard source (agent-editable)
    backend/                Backend source (agent-editable)
    MYSELF.md               Agent identity
    MYHUMAN.md              User notes
    MEMORY.md               Long-term memory
    PULSE.json              Pulse config
    CRONS.json              Cron tasks
    skills/                 Agent skills
    files/                  Uploaded files (audio, images, documents)
    app.db                  User's app database (created by workspace/backend/index.ts)
    .env                    User's environment variables (manually parsed by backend)
    .backend.log            Backend stdout/stderr log (reset on each restart)
  tools/                    (installer-only) Bundled Node.js if system Node was unavailable
    node/                   Local Node.js installation
  supervisor/               Application code (overwritten on upgrade)
  worker/                   Application code (overwritten on upgrade)
  shared/                   Application code (overwritten on upgrade)
  scripts/                  Application code (overwritten on upgrade)
  dist-fluxy/               Pre-built chat UI (overwritten on upgrade)
  node_modules/             Production dependencies (installed by postinstall)
  package.json              Package manifest (overwritten on upgrade)
  tsconfig.json             TypeScript config (overwritten on upgrade)
  vite.config.ts            Dashboard Vite config (overwritten on upgrade)
  vite.fluxy.config.ts      Chat Vite config (overwritten on upgrade)
  postcss.config.js         PostCSS config (overwritten on upgrade)
  components.json           shadcn/ui config (overwritten on upgrade)
```

### Upgrade behavior

The `postinstall.js` script distinguishes between:

- **Code directories** (`bin/`, `supervisor/`, `worker/`, `shared/`, `scripts/`) and **code files** (`package.json`, `tsconfig.json`, `vite.config.ts`, etc.) -- **always overwritten** on upgrade.
- **Workspace** (`workspace/`) -- **only copied on first install**. This preserves the user's custom dashboard, backend code, memory files, uploaded files, and database across upgrades.

### Database schema (`memory.db`)

| Table                | Purpose                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `conversations`      | Chat conversation metadata (id, title, model, session_id, timestamps)                         |
| `messages`           | Individual chat messages (id, conversation_id, role, content, token counts, model, timestamp) |
| `settings`           | Key-value settings store (password hash, 2FA secret, onboard status, VAPID keys, etc.)        |
| `sessions`           | Authentication sessions (token, created_at, expires_at)                                       |
| `push_subscriptions` | Web Push subscription endpoints and keys                                                      |
| `trusted_devices`    | Remembered devices for 2FA bypass (token, label, expiry, last seen)                           |

---
