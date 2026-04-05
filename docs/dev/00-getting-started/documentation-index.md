---
title: Documentation Index
---

### Getting Started

| #   | Document                                     | Description                                                                    |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------ |
| 12  | [Development Setup](12-development-setup.md) | Prerequisites, cloning, running in dev mode, building, debugging -- start here |
| 13  | [Contributing](13-contributing.md)           | Code organization principles, coding standards, common tasks, PR guidelines    |

### Architecture & Design

| #   | Document                                             | Description                                                                   |
| --- | ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| 01  | [Architecture Overview](01-architecture-overview.md) | System overview, process model, request flow, data flow, key design decisions |
| 02  | [Project Structure](02-project-structure.md)         | Complete directory tree with annotations for every file and directory         |
| 03  | [Tech Stack](03-tech-stack.md)                       | All technologies with exact versions, rationale for each choice               |

### Core Systems

| #   | Document                                           | Description                                                                         |
| --- | -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 04  | [Supervisor Deep Dive](04-supervisor-deep-dive.md) | HTTP server, reverse proxy, process management, auto-restart, startup/shutdown      |
| 05  | [Worker API](05-worker-api.md)                     | Complete API endpoint reference -- every route, request/response format, middleware |
| 06  | [Agent System](06-agent-system.md)                 | Claude Agent SDK integration, system prompt, memory system, multi-provider AI       |
| 08  | [Database Schema](08-database-schema.md)           | All tables, columns, indexes, CRUD functions, migration strategy                    |

### Features

| #   | Document                                                        | Description                                                               |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 07  | [Frontend: Dashboard & Chat](07-frontend-dashboard-and-chat.md) | Dual frontend architecture, React apps, Vite configs, component hierarchy |
| 09  | [Authentication & Security](09-authentication-and-security.md)  | Password auth, sessions, 2FA/TOTP, OAuth PKCE, WebSocket auth, Web Push   |
| 10  | [Scheduler & Skills](10-scheduler-and-skills.md)                | PULSE/CRON systems, skill plugin architecture, how to create skills       |
| 11  | [Networking & Tunnels](11-networking-and-tunnels.md)            | Port allocation, Cloudflare tunnels, Bloby Relay, reverse proxy internals |
