---
title: "npm Scripts"
---

| Script           | Command                                                  | Purpose                                                                 |
| ---------------- | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| `dev`            | `concurrently "tsx watch supervisor/index.ts" "vite"`    | Start supervisor with file watching + Vite dev server for the dashboard |
| `build`          | `vite build && vite build --config vite.chat.config.ts` | Build both dashboard and chat SPA for production                        |
| `build:chat`     | `vite build --config vite.chat.config.ts`               | Build only the chat SPA                                                 |
| `start`          | `node --import tsx/esm supervisor/index.ts`              | Start the supervisor in production mode                                 |
| `postinstall`    | `node scripts/postinstall.js`                            | Copy source to `~/.morphy/`, install deps, build chat UI                 |
| `dev:workspace`  | `vite`                                                   | Vite dev server for the dashboard only (no supervisor)                  |
| `dev:docs`       | `cd ./docs && npx fumapress`                             | Preview the documentation site locally                                  |
| `sync:pi-models` | `tsx scripts/sync-pi-models.ts`                          | Regenerate the Pi model catalog from a sibling `pi-main` checkout       |
| `prepublishOnly` | `vite build --config vite.chat.config.ts`                | Build the chat SPA before the package is published                     |

---
