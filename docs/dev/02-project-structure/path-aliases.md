---
title: "Path Aliases"
---

### TypeScript aliases (tsconfig.json)

| Alias       | Maps to                    | Used by                        |
| ----------- | -------------------------- | ------------------------------ |
| `@server/*` | `./server/*`               | Server-side TypeScript imports |
| `@client/*` | `./workspace/client/src/*` | Client-side TypeScript imports |

### Vite aliases (resolved at build time)

| Config file            | Alias | Maps to                 | Used by                                                               |
| ---------------------- | ----- | ----------------------- | --------------------------------------------------------------------- |
| `vite.config.ts`       | `@`   | `workspace/client/src/` | Dashboard components (`@/components/ui/button`, `@/lib/utils`)        |
| `vite.fluxy.config.ts` | `@`   | `supervisor/chat/src/`  | Chat SPA components (`@/components/Chat/InputBar`, `@/hooks/useChat`) |

Both Vite configs alias `@` but they resolve to different directories depending on which build is running. This is intentional -- the chat SPA and dashboard are independent apps with independent source trees.

---
