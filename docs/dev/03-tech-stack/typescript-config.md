---
title: "TypeScript Configuration"
---

Full `tsconfig.json` breakdown:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",          // Top-level await, private fields, Object.hasOwn
    "module": "ESNext",          // Native ESM import/export
    "moduleResolution": "bundler", // Vite-compatible resolution (no .js extensions needed)
    "esModuleInterop": true,     // CommonJS default import compatibility
    "strict": true,              // All strict checks enabled
    "skipLibCheck": true,        // Skip .d.ts validation for faster builds
    "outDir": "dist",            // Compilation output (not used in dev)
    "rootDir": ".",              // Project root
    "jsx": "react-jsx",         // React 17+ automatic JSX transform
    "types": [],                 // No auto-included @types (explicit imports only)
    "paths": {                   // Path aliases
      "@server/*": ["./server/*"],
      "@client/*": ["./workspace/client/src/*"]
    }
  },
  "include": [
    "server/**/*",
    "workspace/client/src/**/*",
    "workspace/backend/**/*",
    "vite.config.ts"
  ],
  "exclude": ["node_modules", "dist", "data"]
}
```

Notable choices:

- **`"types": []`** prevents auto-inclusion of all `@types/*` packages, avoiding type conflicts between server (Node) and client (DOM) code.
- **`"moduleResolution": "bundler"`** allows imports without `.js` extensions and supports the `exports` field in `package.json`, matching Vite's resolution behavior.
- **`"skipLibCheck": true`** is critical for build speed given the large number of dependencies (React 19, Three.js, Radix UI, etc.).

### Type Definitions (devDependencies)

| Package                                | Version    |
| -------------------------------------- | ---------- |
| `@types/better-sqlite3`               | ^7.6.13    |
| `@types/express`                       | ^5.0.6     |
| `@types/node`                          | ^25.3.0    |
| `@types/qrcode`                        | ^1.5.5     |
| `@types/react`                         | ^19.2.14   |
| `@types/react-dom`                     | ^19.2.3    |
| `@types/react-syntax-highlighter`      | ^15.5.13   |
| `@types/ws`                            | ^8.18.1    |
