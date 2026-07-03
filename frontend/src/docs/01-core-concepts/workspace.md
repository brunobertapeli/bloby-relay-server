---
title: The Workspace
---

# The Workspace

Your workspace is a full-stack application that lives at `~/.morphy/workspace/`. You and Morphy share it. You use it, Morphy builds it.

## Structure

```
workspace/
├── client/              # React + Tailwind frontend
│   └── src/App.tsx      # Main app component
├── backend/
│   └── index.ts         # Express API server
├── app.db               # SQLite database
├── .env                 # Backend environment variables
├── MYSELF.md            # Agent identity & personality
├── MYHUMAN.md           # What Morphy knows about you
├── MEMORY.md            # Long-term curated memory
├── PULSE.json           # Periodic wake-up config
├── CRONS.json           # Scheduled tasks
├── tasks/               # Detailed instructions per cron (tasks/<cron-id>.md)
├── memory/              # Daily note files
├── skills/              # Agent skills (SKILL.md folders)
├── MCP.json             # MCP server config (optional)
├── files/               # Uploaded attachments
├── package.json         # The workspace's own npm dependencies
└── node_modules/        # Isolated from the core
```

## Frontend

A React app with Tailwind CSS. This is what you see in the browser: the pages, the components, the UI. Morphy builds and modifies this when you ask for new features.

## Backend

An Express server running on its own port. It handles API routes and talks to the database. When Morphy creates a feature, it wires up the backend automatically. Your backend routes are accessible at `/app/api/`.

## Database

A SQLite database (`app.db`) for your app data. Contacts, notes, habits, whatever you're building lives here.

## One workspace, infinite features

Everything lives in a single workspace. When you ask for a CRM today, a finance tracker tomorrow, and a calorie counter next week, Morphy adds them as modules: a sidebar icon, a new page, a dashboard card. They all coexist.

The workspace can be one big app or a collection of mini apps the agent builds on demand. It's your space. Shape it however you want.

## Public or private

By default, anyone who visits your URL sees the workspace. That URL is `yourname.morphyagent.com` for managed instances and premium handles, or `yourname.open.morphyagent.com` on the free self-hosted tier. You can use it as a public dashboard, a portfolio, or a team hub. Or ask the agent to add authentication so only you (or your team) can access it.

## Boundaries

The workspace is Morphy's home directory and the only place it is instructed to build in. Treat that as a working convention, not a hard sandbox: the agent has broad access to the machine it runs on. One boundary is enforced at runtime. The workspace has its own `package.json` and `node_modules/`, so Morphy can install npm packages freely and nothing it installs can break the supervisor, worker, or chat. If something breaks in the workspace, the chat is always available to ask for fixes. It runs in a separate process, so a broken workspace app cannot take it down.
