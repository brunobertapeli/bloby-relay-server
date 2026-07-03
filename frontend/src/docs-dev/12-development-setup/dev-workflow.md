---
title: "Development Workflow"
---

## 7. Development Workflow

### Editing supervisor code (`supervisor/*.ts`, `shared/*.ts`)

- `tsx watch` detects the change and restarts the entire supervisor process.
- The backend child process is torn down and respawned; the in-process worker
  and the Vite dev server come back up with the supervisor.
- Full restart takes 2-5 seconds.
- All WebSocket connections are dropped; the chat UI and dashboard reconnect
  automatically.

### Editing worker code (`worker/*.ts`)

- The worker runs **in-process** inside the supervisor: `worker/index.ts`
  exports `createWorkerApp()`, which the supervisor mounts on its own HTTP
  server. There is no separate worker process and no worker port.
- Because `worker/index.ts` is part of the supervisor's import graph, `tsx
  watch` picks up changes to `worker/*.ts` and restarts the whole supervisor,
  exactly as it does for `supervisor/*.ts` edits.
- There is no way to reload just the worker; a worker edit is a full restart.

### Editing dashboard code (`workspace/client/src/**`)

- Vite HMR picks up changes instantly. No restart needed.
- Component state is preserved across edits (React Fast Refresh).
- CSS changes (Tailwind) are applied without a page reload.
- The supervisor serves `/api/*` from the in-process worker and proxies
  `/app/api/*` to the user backend, so dashboard code can call both during
  development.

### Editing user backend code (`workspace/backend/**`)

- The supervisor watches `workspace/backend/` with `fs.watch({ recursive: true })`.
- Changes to `.ts`, `.js`, or `.json` files trigger an automatic restart of
  **only the backend process** (1-second debounce).
- Changes to `workspace/.env` also trigger a backend restart.
- You can also force a restart by creating a `workspace/.restart` file (the
  supervisor consumes and deletes it).

### Editing chat UI code (`supervisor/chat/src/**`)

- The chat UI is **not live-reloaded** in the default `npm run dev` setup. It
  is served as pre-built static files from `dist-chat/`.
- After editing chat UI code, rebuild:

  ```bash
  npm run build:chat
  ```

  Then refresh the browser (the supervisor serves static files with
  `Cache-Control: no-cache` for `.html` files).

- For a live-reloading dev experience on the chat UI, run its Vite dev server
  directly:

  ```bash
  npx vite --config vite.chat.config.ts
  ```

  This starts on a separate port with HMR. Note that the chat UI expects API
  routes to be available at the same origin, so you need the supervisor running
  in parallel.

### Testing changes

There is no automated test suite as of the current version. Testing is manual:

1. **API testing:** Use `curl` or a tool like Postman against
   `http://localhost:7400/api/*`.
2. **Dashboard testing:** Open `http://localhost:7400` in a browser.
3. **Chat UI testing:** Open `http://localhost:7400/bloby` in a browser.
4. **Backend testing:** Hit `http://localhost:7400/app/api/*` endpoints.
5. **WebSocket testing:** The chat UI connects via
   `ws://localhost:7400/bloby/ws`. Browser DevTools (Network tab, WS filter)
   shows message traffic.

---
