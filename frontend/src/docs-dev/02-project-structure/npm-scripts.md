---
title: "npm Scripts"
---

| Script        | Command                                                  | Purpose                                                                 |
| ------------- | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| `dev`         | `concurrently "tsx watch supervisor/index.ts" "vite"`    | Start supervisor with file watching + Vite dev server for the dashboard |
| `build`       | `vite build && vite build --config vite.bloby.config.ts` | Build both dashboard and chat SPA for production                        |
| `build:bloby` | `vite build --config vite.bloby.config.ts`               | Build only the chat SPA                                                 |
| `start`       | `node --import tsx/esm supervisor/index.ts`              | Start the supervisor in production mode                                 |
| `postinstall` | `node scripts/postinstall.js`                            | Copy source to `~/.bloby/`, install deps, build chat UI                 |

---
