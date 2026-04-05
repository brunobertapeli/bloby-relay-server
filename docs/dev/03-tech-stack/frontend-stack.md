---
title: "Frontend Stack"
---

Bloby ships **two independent frontend applications**, each with its own Vite config:

### 3a. Dashboard (`workspace/client/` -- `vite.config.ts`)

The main management UI. Full-featured SPA.

| Dependency                     | Version      | Purpose                                      |
| ------------------------------ | ------------ | -------------------------------------------- |
| **react**                      | ^19.2.4      | UI framework                                 |
| **react-dom**                  | ^19.2.4      | DOM renderer                                 |
| **vite**                       | ^7.3.1       | Build tool and dev server                    |
| **@vitejs/plugin-react**       | ^5.1.4       | React Fast Refresh + JSX transform           |
| **tailwindcss**                | ^4.2.0       | Utility-first CSS framework (v4)             |
| **@tailwindcss/vite**          | ^4.2.0       | Vite-native Tailwind integration             |
| **@tailwindcss/postcss**       | ^4.2.0       | PostCSS fallback (present but not active)    |
| **radix-ui**                   | ^1.4.3       | Accessible headless UI primitives            |
| **class-variance-authority**   | ^0.7.1       | Variant-driven component styling (shadcn)    |
| **clsx**                       | ^2.1.1       | Conditional className construction           |
| **tailwind-merge**             | ^3.5.0       | Intelligent Tailwind class deduplication     |
| **zustand**                    | ^5.0.11      | Lightweight state management                 |
| **framer-motion**              | ^12.34.3     | Declarative animations and gestures          |
| **three**                      | ^0.183.1     | 3D rendering engine                          |
| **@react-three/fiber**         | ^9.5.0       | React reconciler for Three.js                |
| **@react-three/drei**          | ^10.7.7      | Helpers and abstractions for R3F             |
| **recharts**                   | ^3.7.0       | Composable charting library                  |
| **lucide-react**               | ^0.575.0     | Icon library (tree-shakeable SVG icons)      |
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

### 3b. Bloby Chat (`supervisor/chat/` -- `vite.bloby.config.ts`)

The embeddable chat interface and onboarding flow. Served under `/bloby/`.

| Dependency                       | Version    | Purpose                              |
| -------------------------------- | ---------- | ------------------------------------ |
| **react**                        | ^19.2.4    | UI framework                         |
| **react-dom**                    | ^19.2.4    | DOM renderer                         |
| **react-markdown**               | ^10.1.0    | Markdown rendering in chat bubbles   |
| **remark-gfm**                   | ^4.0.1     | GitHub Flavored Markdown support     |
| **react-syntax-highlighter**     | ^16.1.0    | Code block syntax highlighting       |
| **framer-motion**                | ^12.34.3   | Chat animations                      |
| **lucide-react**                 | ^0.575.0   | Icons                                |

This build has **two HTML entry points** configured via Rollup:

- `bloby.html` -- the main chat interface.
- `onboard.html` -- the first-run setup wizard.

The base path is `/bloby/` and the output goes to `dist-bloby/`.

### PostCSS Configuration

The `postcss.config.js` is intentionally **empty** -- Tailwind CSS v4 is handled entirely by the `@tailwindcss/vite` plugin, bypassing PostCSS. The config file exists only so tools that probe for it do not error.

### Vite Dependency Pre-bundling

Both Vite configs explicitly pre-bundle heavy dependencies via `optimizeDeps.include` to avoid cold-start waterfall requests:

**Dashboard:** react, react-dom/client, react/jsx-runtime, lucide-react, framer-motion, recharts, zustand, sonner, use-sync-external-store.

**Chat:** react, react-dom/client, react/jsx-runtime, lucide-react, framer-motion, react-markdown, remark-gfm, react-syntax-highlighter (+ Prism One Dark theme), use-sync-external-store.
