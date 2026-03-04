---
title: "Configuration Files"
---

### 3.1 TypeScript Configuration (`tsconfig.json`)

```json
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "ESNext",
        "moduleResolution": "bundler",
        "esModuleInterop": true,
        "strict": true,
        "skipLibCheck": true,
        "outDir": "dist",
        "rootDir": ".",
        "jsx": "react-jsx",
        "types": [],
        "paths": {
            "@server/*": ["./server/*"],
            "@client/*": ["./workspace/client/src/*"]
        }
    },
    "include": [
        "server/**/*",
        "workspace/client/src/**/*",
        "workspace/backend/**/*",
        "vite.config.ts"
    ],
    "exclude": ["node_modules", "dist", "data"]
}
```

Key decisions:

- **ES2022 target** -- allows top-level await, modern class features, and private fields.
- **ESNext module** with **bundler resolution** -- Vite-compatible module resolution.
- **`types: []`** -- prevents auto-including all `@types/*` packages; types are explicitly imported.
- **Path aliases** -- `@server/*` maps to `./server/*`, `@client/*` maps to `./workspace/client/src/*`.

### 3.2 Vite Configuration (Dashboard) -- `vite.config.ts`

- **Root:** `workspace/client/`
- **Build output:** `dist/` (relative to root, resolves to project root `dist/`)
- **Dev server port:** 5173
- **Proxy rules:** `/api` to `http://localhost:3000` (supervisor/worker), `/app/api` to `http://localhost:3004` (user backend, strips `/app/api` prefix)
- **Alias:** `@` maps to `workspace/client/src/`
- **Plugins:** React (via `@vitejs/plugin-react`), Tailwind CSS (via `@tailwindcss/vite`)
- **Watch ignores:** Database files (`*.db*`), log files, `files/` directory, `.env`, `backend/` directory
- **Optimized deps:** React, React DOM, Lucide, Framer Motion, Recharts, Zustand, Sonner

### 3.3 Vite Configuration (Chat SPA) -- `vite.fluxy.config.ts`

- **Root:** `supervisor/chat/`
- **Base path:** `/fluxy/` (all assets served under this prefix)
- **Build output:** `dist-fluxy/`
- **Multi-page:** Two entry points -- `fluxy.html` (chat) and `onboard.html` (wizard)
- **Alias:** `@` maps to `supervisor/chat/src/`
- **Plugins:** Same as dashboard (React + Tailwind)
- **Optimized deps:** React, Lucide, Framer Motion, React Markdown, Remark GFM, React Syntax Highlighter

### 3.4 PostCSS Configuration -- `postcss.config.js`

Empty plugins object. Tailwind CSS processing is handled entirely by the `@tailwindcss/vite` plugin in both Vite configs. This file exists for tool compatibility (some editors and linters look for it).

### 3.5 shadcn/ui Configuration -- `components.json`

- **Style:** `new-york` (shadcn/ui variant)
- **RSC:** disabled (not using React Server Components)
- **CSS:** `workspace/client/src/styles/globals.css` (Tailwind entry point)
- **Base color:** `neutral`
- **CSS variables:** enabled (uses CSS custom properties for theming)
- **Icon library:** `lucide` (Lucide React)
- **Aliases:** `@/components`, `@/lib/utils`, `@/components/ui`, `@/lib`, `@/hooks`

### 3.6 Environment Variables -- `.env`

The `.env` file lives in `workspace/.env` (gitignored). It is manually parsed by the backend template (`workspace/backend/index.ts`) without a `dotenv` dependency. Common variables include API keys and custom configuration for the user's app.

---
