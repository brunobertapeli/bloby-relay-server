---
title: "Dashboard"
---

# Dashboard App

The dashboard is the main user-facing frontend application. It lives in `workspace/client/` and is the app that the AI agent actively modifies at runtime -- writing new components, updating styles, and rebuilding via Vite. It uses React 19, Vite, Tailwind CSS v4, and shadcn/ui components.

## Vite Configuration

The dashboard's Vite config is at the project root: `vite.config.ts`.

```ts
export default defineConfig({
  root: 'workspace/client',
  resolve: {
    alias: { '@': path.resolve(__dirname, 'workspace/client/src') },
  },
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/app/api': {
        target: 'http://localhost:3004',
        rewrite: (path) => path.replace(/^\/app\/api/, '') || '/',
      },
      '/api': 'http://localhost:3000',
    },
  },
  plugins: [react(), tailwindcss()],
});
```

Key points:

- **Root** is `workspace/client`, not the project root.
- **Path alias** `@` maps to `workspace/client/src` so imports can use `@/components/ui/button`.
- **Build output** goes to `dist/` at the project root.
- **Proxy rules** forward `/api` to the supervisor (port 3000) and `/app/api` to the user's backend server (port 3004 by default).
- **Dep optimization** pre-bundles `react`, `react-dom/client`, `lucide-react`, `framer-motion`, `recharts`, `zustand`, and `sonner`.
- **File watch ignores** database files (`.db`, `.db-journal`, `.db-wal`), log files, `.env`, and the `backend/` directory to avoid unnecessary rebuilds.

In production (dev mode -- Fluxy always runs in dev mode), the supervisor spawns Vite internally via `createViteServer()` in `supervisor/vite-dev.ts`. It binds to port `supervisor_port + 2` (e.g., 3002 when supervisor is on 3000) and attaches HMR directly to the supervisor's HTTP server so hot-module replacement works transparently through the proxy.

## Entry Point and App Structure

### `index.html`

The HTML shell at `workspace/client/index.html` sets up:

1. **Meta tags** for PWA (`theme-color`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`).
2. A `manifest.json` link for installability.
3. A **global error handler** in a `<script>` block that catches errors outside React's error boundary (e.g., Vite compilation errors, module loading failures). If `#root` is empty, it renders a static fallback telling the user to "ask the agent to fix it."
4. The main React entry (`/src/main.tsx`) loaded as a module.
5. **Service worker registration** (`/sw.js`) with auto-update logic.
6. The **chat widget** script (`/fluxy/widget.js`).

### `src/main.tsx`

Minimal bootstrap -- renders `<App />` inside `React.StrictMode`:

```tsx
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

### `src/App.tsx`

The root component handles three concerns:

1. **Onboarding detection** -- Fetches `/api/settings` on mount. If `onboard_complete !== 'true'`, renders the onboarding wizard as a full-screen iframe (`/fluxy/onboard.html`, z-index 200).

2. **Rebuild overlays** -- Listens for `postMessage` events from the chat iframe:
   - `fluxy:rebuilding` -- Shows a loading overlay with the Fluxy animation.
   - `fluxy:rebuilt` -- Dismisses overlay, triggers `location.reload()`.
   - `fluxy:build-error` -- Shows error text for 5 seconds.
   - `fluxy:hmr-update` -- Logged but not acted on (Vite HMR handles it natively).
   - `fluxy:onboard-complete` -- Hides the onboarding iframe.

3. **Error boundary** -- Wraps the entire layout in `<ErrorBoundary>` with a custom fallback (`DashboardError`) that shows the Fluxy animation and tells the user to use the chat.

The component tree is:

```
<ErrorBoundary fallback={<DashboardError />}>
  <DashboardLayout>
    <DashboardPage />
  </DashboardLayout>
</ErrorBoundary>
```

## Component Hierarchy

### Layout Components (`src/components/Layout/`)

**`DashboardLayout`** -- The app shell. Uses `h-dvh` (dynamic viewport height) for proper mobile display. Contains:

- A mobile header (visible `md:hidden`) with `<MobileNav />` hamburger menu and the Fluxy logo.
- A desktop sidebar (visible `hidden md:flex`).
- The main content area with scrollable `<main>` and a sticky `<Footer>`.
- A health-check poller that pings `/api/health` every 15 seconds and updates the `connected` state passed to `Footer`.

**`Sidebar`** -- 256px-wide sidebar (`w-64`) with:

- Fluxy logo and brand name.
- A time-aware greeting ("Good Morning/Afternoon/Evening").
- Navigation items: Dashboard (active), My Apps (collapsible dropdown), Reports, Research, What Else.
- Uses `lucide-react` icons (`LayoutDashboard`, `AppWindow`, `BarChart3`, `Search`, `HelpCircle`).
- All nav items use the `NavButton` subcomponent with sidebar-specific color tokens.

**`MobileNav`** -- Hamburger menu button that opens a shadcn `Sheet` (slide-in panel from the left) containing the same `Sidebar` component.

**`Footer`** -- Minimal status bar showing a green/red dot with "Connected"/"Disconnected" text based on the health check state.

### Dashboard Page (`src/components/Dashboard/`)

**`DashboardPage`** -- The landing page with:

- A welcome message ("Let's get started").
- Starter suggestion chips ("Build me a CRM", "Create a habit tracker", etc.) that, when clicked, open the chat widget and pre-fill the text input.
- Arrow images pointing to the chat bubble (different positioning for desktop vs mobile).

The suggestion pre-fill uses a clever technique: it finds the textarea inside the widget iframe's panel, uses the native setter prototype to set its value, and dispatches a synthetic `input` event to trigger React's state update.

### Error Boundary (`src/components/`)

**`ErrorBoundary`** -- A class component (React requires class components for error boundaries) that catches render errors in any descendant and displays the provided `fallback` prop instead of crashing the entire page.

### UI Components (`src/components/ui/`)

shadcn/ui components using the "new-york" style variant. All are generated via the shadcn CLI and use Radix UI primitives under the hood. The available components are:

| Component | File | Radix Primitive |
|---|---|---|
| Avatar | `avatar.tsx` | `@radix-ui/react-avatar` |
| Badge | `badge.tsx` | (CVA only) |
| Button | `button.tsx` | `@radix-ui/react-slot` |
| Card | `card.tsx` | (div wrappers) |
| Dialog | `dialog.tsx` | `@radix-ui/react-dialog` |
| DropdownMenu | `dropdown-menu.tsx` | `@radix-ui/react-dropdown-menu` |
| Input | `input.tsx` | (native input) |
| ScrollArea | `scroll-area.tsx` | `@radix-ui/react-scroll-area` |
| Select | `select.tsx` | `@radix-ui/react-select` |
| Separator | `separator.tsx` | `@radix-ui/react-separator` |
| Sheet | `sheet.tsx` | `@radix-ui/react-dialog` |
| Skeleton | `skeleton.tsx` | (div wrapper) |
| Switch | `switch.tsx` | `@radix-ui/react-switch` |
| Tabs | `tabs.tsx` | `@radix-ui/react-tabs` |
| Textarea | `textarea.tsx` | (native textarea) |
| Tooltip | `tooltip.tsx` | `@radix-ui/react-tooltip` |

The shadcn configuration is in `components.json` at the project root:

```json
{
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "css": "workspace/client/src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  },
  "iconLibrary": "lucide"
}
```

## Tailwind CSS v4 Setup

Tailwind v4 is used in CSS-first configuration mode. There is no `tailwind.config.js` -- all theme tokens are defined inline in `src/styles/globals.css` using the `@theme` directive:

```css
@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: #212121;
  --color-foreground: #f5f5f5;
  --color-primary: #3C8FFF;
  --color-primary-foreground: #ffffff;
  --color-destructive: #FD486B;
  --color-sidebar: #1c1c1c;
  --color-sidebar-accent: #282828;
  --radius: 0.75rem;
  /* ... more tokens */
}
```

The Tailwind Vite plugin (`@tailwindcss/vite`) handles processing. Custom utility classes defined in `globals.css`:

- `.text-gradient` -- Brand gradient text (cyan -> purple -> pink).
- `.bg-gradient-brand` -- Same gradient as a background.
- `.glow-border` -- Subtle purple glow box-shadow.
- `.animated-border` -- Spinning conic gradient border animation.
- `.input-glow:focus` -- Purple/cyan glow on focused inputs.

## State Management

The dashboard uses **Zustand** for state management. It is listed as a dependency and pre-bundled in `optimizeDeps.include`. The dashboard's current pages are relatively simple (static layout + health check), so Zustand stores are intended for user-built features. The agent creates Zustand stores as needed when building apps for the user.

## Utility Library

`src/lib/utils.ts` exports the `cn()` helper that combines `clsx` and `tailwind-merge`:

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

This is used throughout all shadcn and custom components for conditional class merging.

## PWA Support

The dashboard is installable as a PWA:

- **`manifest.json`** in `workspace/client/public/` declares `display: "standalone"`, `start_url: "/"`, and the `#212121` theme color.
- **`sw.js`** in `workspace/client/public/` is a minimal service worker that enables installability and handles push notifications. In production, the supervisor serves its own embedded copy of the service worker to ensure it stays in sync with updates.
- **iOS-specific meta tags** in `index.html` (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style: black-translucent`) ensure proper behavior when added to the home screen.

## Key Dependencies

| Package | Version | Purpose |
|---|---|---|
| `react` | ^19.2.4 | UI framework |
| `react-dom` | ^19.2.4 | DOM rendering |
| `vite` | ^7.3.1 | Dev server and bundler |
| `tailwindcss` | ^4.2.0 | Utility-first CSS |
| `@tailwindcss/vite` | ^4.2.0 | Vite plugin for Tailwind v4 |
| `zustand` | ^5.0.11 | Lightweight state management |
| `lucide-react` | ^0.575.0 | Icon library |
| `framer-motion` | ^12.34.3 | Animation library |
| `recharts` | ^3.7.0 | Chart library |
| `sonner` | ^2.0.7 | Toast notifications |
| `radix-ui` | ^1.4.3 | Headless UI primitives (via shadcn) |
| `class-variance-authority` | ^0.7.1 | Variant styles (CVA) |
| `clsx` | ^2.1.1 | Conditional class strings |
| `tailwind-merge` | ^3.5.0 | Merge conflicting Tailwind classes |
