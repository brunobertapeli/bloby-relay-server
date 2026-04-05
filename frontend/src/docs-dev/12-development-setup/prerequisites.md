---
title: "Prerequisites"
---

## 1. Prerequisites

### Node.js

Node.js **>= 18** is required (`"engines": { "node": ">=18" }` in
`package.json`). The project is tested with Node 22. Install from
<https://nodejs.org/> or use a version manager (`nvm`, `fnm`, `volta`).

Verify:

```bash
node -v    # v18.x or higher
npm -v     # ships with Node
```

### Git

Git is required to clone the repository and is used by the CLI to detect
development mode (it checks for `PKG_ROOT/.git`).

### Platform-specific requirements

| Platform | Notes |
|----------|-------|
| **Windows** | PowerShell 5.1+ or Windows Terminal. `curl.exe` must be available (ships with Windows 10+). `tar` must be available (ships with Windows 10 1803+). |
| **macOS** | Xcode Command Line Tools (`xcode-select --install`) for native modules (`better-sqlite3`). Homebrew is recommended but not required. |
| **Linux** | `build-essential` (gcc, g++, make) and `python3` for compiling `better-sqlite3`. On Debian/Ubuntu: `sudo apt install build-essential python3`. |

### API keys

To use the AI chat features you need at least one provider key. These are
configured through the dashboard after first launch, not as environment
variables.

| Provider | Required? | How to obtain |
|----------|-----------|---------------|
| **Anthropic** | Recommended | <https://console.anthropic.com/> -- or use the built-in OAuth flow (`bloby` supports Claude Agent SDK with OAuth tokens) |
| **OpenAI** | Optional | <https://platform.openai.com/api-keys> |
| **Ollama** | Optional | Install Ollama locally (<https://ollama.com/>) -- no key needed, uses `baseUrl` |

---
