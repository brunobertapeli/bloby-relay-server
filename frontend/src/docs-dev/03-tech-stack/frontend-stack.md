---
title: "Frontend Stack"
---

Morphy ships **two independent frontend applications**, each with its own Vite config:

### 3a. Dashboard (`workspace/client/` -- `vite.config.ts`)

The main management UI. Full-featured SPA.

| Dependency                     | Version      | Purpose                                      |
| ------------------------------ | ------------ | -------------------------------------------- |
| **react**                      | ^19.2.4      | UI framework                                 |
| **react-dom**                  | ^19.2.4      | DOM renderer                                 |
| **vite**                       | ^8.0.3       | Build tool and dev server                    |
| **@vitejs/plugin-react**       | ^6.0.1       | React Fast Refresh + JSX transform           |
| **tailwindcss**                | ^4.2.0       | Utility-first CSS framework (v4)             |
| **@tailwindcss/vite**          | ^4.2.0       | Vite-native Tailwind integration             |
| **react-router**               | ^7.13.2      | Client-side routing                          |
| **radix-ui**                   | ^1.4.3       | Accessible headless UI primitives            |
| **class-variance-authority**   | ^0.7.1       | Variant-driven component styling (shadcn)    |
| **clsx**                       | ^2.1.1       | Conditional className construction           |
| **tailwind-merge**             | ^3.5.0       | Intelligent Tailwind class deduplication     |
| **zustand**                    | ^5.0.11      | Lightweight state management                 |
| **framer-motion**              | ^12.34.3     | Declarative animations and gestures          |
| **recharts**                   | ^3.7.0       | Composable charting library                  |
| **driver.js**                  | ^1.4.0       | Guided product tours (workspace onboarding)  |
| **lucide-react**               | ^1.7.0       | Icon library (tree-shakeable SVG icons)      |
| **sonner**                     | ^2.0.7       | Toast notification system                    |
| **date-fns**                   | ^4.1.0       | Date utility functions                       |

**shadcn/ui Configuration** (`components.json`):

| Setting        | Value          |
| -------------- | -------------- |
| Style          | `new-york`     |
| RSC            | `false`        |
| TSX            | `true`         |
| Base color     | `neutral`      |
| CSS variables  | `true`         |
| Icon library   | `lucide`       |

CSS globals live at `workspace/client/src/styles/globals.css`. Component aliases follow the standard shadcn layout: `@/components/ui`, `@/lib/utils`, `@/hooks`.

### 3b. Morphy Chat (`supervisor/chat/` -- `vite.chat.config.ts`)

The embeddable chat interface and onboarding flow. Served under `/bloby/`.

| Dependency                       | Version    | Purpose                                        |
| -------------------------------- | ---------- | ---------------------------------------------- |
| **react**                        | ^19.2.4    | UI framework                                   |
| **react-dom**                    | ^19.2.4    | DOM renderer                                   |
| **streamdown**                   | ^2.5.0     | Streaming-safe Markdown rendering in chat bubbles |
| **@streamdown/code**             | ^1.1.1     | Code block syntax highlighting for streamdown  |
| **framer-motion**                | ^12.34.3   | Chat animations                                |
| **lucide-react**                 | ^1.7.0     | Icons                                          |

This build has **two HTML entry points** configured via `rolldownOptions`:

- `chat.html` -- the main chat interface.
- `onboard.html` -- the first-run setup wizard.

The base path is `/bloby/` and the output goes to `dist-chat/`.

### PostCSS Configuration

The `postcss.config.js` is intentionally **empty** -- Tailwind CSS v4 is handled entirely by the `@tailwindcss/vite` plugin, bypassing PostCSS. The config file exists only so tools that probe for it do not error.

### Vite Dependency Pre-bundling

Both Vite configs explicitly pre-bundle heavy dependencies via `optimizeDeps.include` to avoid cold-start waterfall requests:

**Dashboard:** react, react-dom, react-dom/client, react/jsx-runtime, react-router, driver.js, lucide-react, framer-motion, recharts, zustand, sonner, radix-ui, class-variance-authority, clsx, tailwind-merge, use-sync-external-store.

**Chat:** react, react-dom/client, react/jsx-runtime, lucide-react, framer-motion, streamdown, @streamdown/code, use-sync-external-store.
