---
title: "Getting Started"
---

### Fork and Clone

```bash
# Fork the repo on GitHub, then:
git clone https://github.com/<your-username>/bloby.git
cd bloby
npm install
```

### Development Environment Setup

Follow the full setup procedure in [12-development-setup.md](./12-development-setup.md). In short:

```bash
npm run dev        # Starts supervisor (tsx watch) + Vite dev server concurrently
```

This launches the supervisor on port 3000, worker on 3001, Vite on 3002 (or 5173 standalone), and backend on 3004.

### Understanding the Codebase

Before making changes, familiarize yourself with the architecture by reading the dev-docs in order. Key documents:

- Process architecture and how supervisor/worker/backend relate
- Database schema and migration pattern (`worker/db.ts`)
- Chat UI isolation model (`supervisor/chat/ARCHITECTURE.md`)
- Tunnel and relay system
