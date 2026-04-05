---
title: "Development Workflow"
---

## 7. Development Workflow

### Editing supervisor code (`supervisor/*.ts`, `shared/*.ts`)

- `tsx watch` detects the change and restarts the entire supervisor process.
- All child processes (worker, backend, Vite) are stopped and respawned.
- Full restart takes 2-5 seconds.
- All WebSocket connections are dropped; the chat UI and dashboard reconnect
  automatically.

**Tip:** If you only need to test an API change in the worker, consider editing
the worker files and restarting manually rather than relying on `tsx watch`
(which restarts on *supervisor* file changes).

### Editing worker code (`worker/*.ts`)

- The worker is **not independently watched** by `tsx watch`. Changes to
  `worker/*.ts` do not trigger an automatic restart.
- To pick up changes, either:
  - Touch/save any `supervisor/*.ts` file to trigger a full restart.
  - Manually kill and restart the dev server (`Ctrl+C` then `npm run dev`).
- Alternatively, run the worker in isolation:
  `WORKER_PORT=3001 node --import tsx/esm worker/index.ts`

### Editing dashboard code (`workspace/client/src/**`)

- Vite HMR picks up changes instantly. No restart needed.
- Component state is preserved across edits (React Fast Refresh).
- CSS changes (Tailwind) are applied without a page reload.
- The Vite dev server proxies `/api/*` to the worker and `/app/api/*` to the
  user backend, so dashboard code can call APIs during development.

### Editing user backend code (`workspace/backend/**`)

- The supervisor watches `workspace/backend/` with `fs.watch({ recursive: true })`.
- Changes to `.ts`, `.js`, or `.json` files trigger an automatic restart of
  **only the backend process** (1-second debounce).
- Changes to `workspace/.env` also trigger a backend restart.
- You can also force a restart by creating a `workspace/.restart` file (the
  supervisor consumes and deletes it).

### Editing chat UI code (`supervisor/chat/src/**`)

- The chat UI is **not live-reloaded** in the default `npm run dev` setup. It
  is served as pre-built static files from `dist-bloby/`.
- After editing chat UI code, rebuild:

  ```bash
  npm run build:bloby
  ```

  Then refresh the browser (the supervisor serves static files with
  `Cache-Control: no-cache` for `.html` files).

- For a live-reloading dev experience on the chat UI, run its Vite dev server
  directly:

  ```bash
  npx vite --config vite.bloby.config.ts
  ```

  This starts on a separate port with HMR. Note that the chat UI expects API
  routes to be available at the same origin, so you need the supervisor running
  in parallel.

### Testing changes

There is no automated test suite as of the current version. Testing is manual:

1. **API testing:** Use `curl` or a tool like Postman against
   `http://localhost:3000/api/*`.
2. **Dashboard testing:** Open `http://localhost:3000` in a browser.
3. **Chat UI testing:** Open `http://localhost:3000/bloby` in a browser.
4. **Backend testing:** Hit `http://localhost:3000/app/api/*` endpoints.
5. **WebSocket testing:** The chat UI connects via
   `ws://localhost:3000/bloby/ws`. Browser DevTools (Network tab, WS filter)
   shows message traffic.

---
