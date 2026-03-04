---
title: "Build Outputs"
---

| Build command                              | Input               | Output                         | Purpose                                       |
| ------------------------------------------ | ------------------- | ------------------------------ | --------------------------------------------- |
| `vite build`                               | `workspace/client/` | `dist/`                        | Production dashboard bundle                   |
| `vite build --config vite.fluxy.config.ts` | `supervisor/chat/`  | `dist-fluxy/`                  | Production chat SPA bundle                    |
| `npm run build`                            | Both                | Both `dist/` and `dist-fluxy/` | Full production build (runs both in sequence) |
| `npm run build:fluxy`                      | Chat only           | `dist-fluxy/`                  | Rebuild chat SPA only                         |

The `dist/` directory is gitignored. The `dist-fluxy/` directory is committed to git and included in the npm package so that users get a pre-built chat UI without needing to run a build step.

---
