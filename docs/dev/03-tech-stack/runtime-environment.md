---
title: "Runtime Environment"
---

| Property           | Value                              |
| ------------------ | ---------------------------------- |
| Node.js            | **>= 18** (`engines.node`)         |
| Module system      | **ESM** (`"type": "module"`)       |
| TypeScript         | **^5.9.3** (dev dependency)        |
| TS target          | **ES2022**                         |
| TS module          | **ESNext**                         |
| Module resolution  | **bundler**                        |
| Strict mode        | **true**                           |
| JSX transform      | **react-jsx** (automatic runtime)  |

Bloby runs TypeScript at startup via **tsx ^4.21.0** -- no pre-compilation step in development. The `start` script invokes `node --import tsx/esm supervisor/index.ts` which registers the TSX loader into Node's ESM pipeline. In production builds, Vite handles compilation for the frontend bundles while the server code still runs through tsx at startup.

### Path Aliases

Defined in `tsconfig.json` and mirrored in each Vite config:

| Alias          | Resolves to                      | Used in           |
| -------------- | -------------------------------- | ----------------- |
| `@server/*`    | `./server/*`                     | Server code       |
| `@client/*`    | `./workspace/client/src/*`       | Dashboard UI      |
| `@/*`          | Vite `resolve.alias` per config  | Both UIs          |

The dashboard Vite config maps `@` to `workspace/client/src`. The Bloby chat Vite config maps `@` to `supervisor/chat/src`. These are independent alias namespaces, one per build target.
