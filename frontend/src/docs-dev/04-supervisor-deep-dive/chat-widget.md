---
title: "Chat Widget"
---

The widget is a self-contained vanilla JavaScript IIFE (Immediately Invoked Function
Expression) that injects a floating chat bubble and slide-out panel into a page. It is
served by the supervisor at `/bloby/widget.js` (`supervisor/widget.js`), loaded by the
immortal shell (`supervisor/shell.ts`), and also referenced by the `RECOVERING_HTML`
fallback page. Inside any iframe it no-ops (the shell runs the workspace and
interstitial pages in an iframe, and exactly one bubble must exist, in the top window).

### 9.1 Structure

The widget creates five DOM elements:

1. **Style block**: Inline CSS injected into `<head>` for the backdrop, panel, and
   the bubble's recording pulse animation.

2. **Backdrop** (`#bloby-widget-backdrop`): A semi-transparent overlay
   (`rgba(0,0,0,0.4)`) shown while the panel is open. Clicking it closes the panel.

3. **Panel** (`#bloby-widget-panel`): A fixed-position container (480px wide, full
   width under 480px viewports) holding an iframe pointing to `/bloby/`. It slides
   in/out via CSS `transform: translateX()` with a cubic-bezier easing curve. The
   chat app is ~1 MB of JS, so the iframe `src` is set lazily: on first open, when
   the workspace signals ready, or after an 8-second backstop.

4. **Bubble** (`#bloby-widget-bubble`): A `<canvas>` that renders sprite-sheet
   animations (configs and sheets fetched from `/morphy/`). On a cold load it plays
   a full-screen blob splash, then travels to the bottom-right 60px bubble position.
   Warm loads (splash already seen, or a saved portal token) skip straight to bubble
   mode with a small idle frame. In bubble mode it renders the headphones sprite used
   for voice recording.

5. **Badge** (`#bloby-widget-badge`): An unread-message counter pinned to the bubble.

### 9.2 Interaction

- **Tap**: Tapping the bubble (pointer handlers, not bare `click`) opens the panel
  and hides the bubble. Clicking the backdrop or the chat's close button closes the
  panel and re-shows the bubble.
- **Long-press** (500ms): Starts voice capture with the headphones animation. Audio
  goes through `MediaRecorder` when Whisper is enabled (`whisper_enabled` setting),
  otherwise the Web Speech API; the result is posted to the chat iframe as
  `bloby:voice-record`.
- **Escape key**: Closes the panel if open.
- **Duplicate prevention**: The top-window check described above, plus a guard that
  bails out if a `#bloby-widget` element already exists.

### 9.3 Cross-Frame Communication

The widget communicates with the iframes via `postMessage` (same-origin checked):

- `bloby:close` / `bloby:esc` -- Close the panel (the workspace iframe forwards
  Escape presses so ESC works when focus is inside the user's app).
- `bloby:app-ready` -- The workspace signals readiness; triggers the splash-to-bubble
  transition and schedules the lazy chat load.
- `bloby:new-message` -- Increments the unread badge while the panel is closed.
- `bloby:version-changed` -- The chat detected a newer server version; the widget
  does one full page reload to pick up new bundles.
- `bloby:install-app` -- The chat iframe requests PWA installation. If a deferred
  install prompt is available (captured via `beforeinstallprompt`), it is shown.
  Otherwise the widget sends `bloby:show-ios-install` back to the iframe to display
  manual iOS installation instructions.
- `bloby:onboard-complete` -- Re-shows the bubble after initial onboarding.

### 9.4 HMR Persistence

The widget lives in the immortal shell document, which contains no Vite client and
never reloads: workspace rebuilds, HMR, and interstitial pages all happen inside the
shell's iframe, so an open chat panel survives them untouched. On load the widget
also honors a legacy `sessionStorage` flag (`bloby_widget_open`) that re-opens the
panel if set.

### 9.5 Onboarding Awareness

On load, the widget fetches `/api/settings`. If `onboard_complete` is not `'true'`,
the bubble is hidden (and the splash skipped) until the iframe sends a
`bloby:onboard-complete` message. The same fetch reads the `whisper_enabled` flag
that selects the voice-capture path.
