---
title: "Build Outputs"
---

| Build command                              | Input               | Output                         | Purpose                                       |
| ------------------------------------------ | ------------------- | ------------------------------ | --------------------------------------------- |
| `vite build`                               | `workspace/client/` | `dist/`                        | Production dashboard bundle                   |
| `vite build --config vite.chat.config.ts` | `supervisor/chat/`  | `dist-chat/`                  | Production chat SPA bundle                    |
| `npm run build`                            | Both                | Both `dist/` and `dist-chat/` | Full production build (runs both in sequence) |
| `npm run build:chat`                      | Chat only           | `dist-chat/`                  | Rebuild chat SPA only                         |

Both `dist/` and `dist-chat/` are gitignored. `dist-chat/` is built at publish time (the `prepublishOnly` script runs `vite build --config vite.chat.config.ts`) and shipped in the npm package through the `files` allowlist, so users get a pre-built chat UI without needing to run a build step.

---
