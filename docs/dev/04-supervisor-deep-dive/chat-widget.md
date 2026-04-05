---
title: "Chat Widget"
---

The widget is a self-contained vanilla JavaScript IIFE (Immediately Invoked Function
Expression) that injects a floating chat bubble and slide-out panel into any page.
It is served directly by the supervisor at `/bloby/widget.js` (line 220) and is
also injected into the `RECOVERING_HTML` fallback page (line 92).

### 9.1 Structure

The widget creates four DOM elements:

1. **Style block** (lines 8-21): Inline CSS injected into `<head>`. Defines the
   fixed-position bubble (bottom-right, 60px circle), backdrop overlay, and
   slide-out panel (480px wide, slides from right).

2. **Backdrop** (lines 23-25): A semi-transparent overlay (`rgba(0,0,0,0.4)`) that
   appears when the panel is open. Clicking it closes the panel.

3. **Panel** (lines 29-36): A fixed-position container that holds an iframe pointing
   to `/bloby/`. Slides in/out using CSS `transform: translateX()` with a
   cubic-bezier easing curve.

4. **Bubble** (lines 39-69): The floating action button. On non-Safari browsers, it
   displays a looping muted WebM video (`/bloby_tilts.webm`). On Safari/iOS (which
   lack WebM alpha channel support), it falls back to a static PNG image
   (`/bloby_frame1.png`). Safari detection uses user-agent sniffing (line 45).

### 9.2 Interaction

- **Toggle** (lines 74-79): Clicking the bubble opens the panel and hides the bubble.
  Clicking the backdrop closes the panel and shows the bubble.
- **Escape key** (lines 85-87): Closes the panel if open.
- **Duplicate prevention** (line 2): The widget checks for an existing
  `#bloby-widget` element and bails out immediately if found.

### 9.3 Cross-Frame Communication

The widget communicates with the iframe via `postMessage` (lines 97-115):

- `bloby:close` -- The chat iframe requests the panel to close.
- `bloby:install-app` -- The chat iframe requests PWA installation. If a deferred
  install prompt is available (captured via `beforeinstallprompt` at lines 90-94),
  it is shown. Otherwise, the widget sends `bloby:show-ios-install` back to the
  iframe to display manual iOS installation instructions.
- `bloby:onboard-complete` -- Re-shows the bubble after initial onboarding.

### 9.4 HMR Persistence

The widget checks `sessionStorage` for a `bloby_widget_open` flag on load (lines
118-123). If set, it automatically re-opens the panel. This preserves the open state
across Vite HMR reloads so the chat panel is not disrupted during development.

### 9.5 Onboarding Awareness

On load (lines 126-141), the widget fetches `/api/settings` to check if onboarding
is complete. If not, the bubble is hidden until the iframe sends a
`bloby:onboard-complete` message.
