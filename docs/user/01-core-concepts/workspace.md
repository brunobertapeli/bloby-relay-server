---
title: The Workspace
---

# The Workspace

Your workspace is a full-stack application that lives at `~/.bloby/workspace/`. You and Bloby share it — you use it, Bloby builds it.

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
├── MYHUMAN.md           # What Bloby knows about you
├── MEMORY.md            # Long-term curated memory
├── PULSE.json           # Periodic wake-up config
├── CRONS.json           # Scheduled tasks
├── memory/              # Daily note files
├── skills/              # Plugins & extensions
├── MCP.json             # MCP server config (optional)
└── files/               # Uploaded attachments
```

## Frontend

A React app with Tailwind CSS. This is what you see in the browser — the pages, the components, the UI. Bloby builds and modifies this when you ask for new features.

## Backend

An Express server running on its own port. It handles API routes and talks to the database. When Bloby creates a feature, it wires up the backend automatically. Your backend routes are accessible at `/app/api/`.

## Database

A SQLite database (`app.db`) for your app data. Contacts, notes, habits — whatever you're building lives here.

## One workspace, infinite features

Everything lives in a single workspace. When you ask for a CRM today, a finance tracker tomorrow, and a calorie counter next week, Bloby adds them as modules — a sidebar icon, a new page, a dashboard card. They all coexist.

The workspace can be one big app or a collection of mini apps the agent builds on demand. It's your sandbox — shape it however you want.

## Public or private

By default, anyone who visits your URL (e.g., `bloby.bot/yourname`) sees the workspace. You can use it as a public dashboard, a portfolio, or a team hub. Or ask the agent to add authentication so only you (or your team) can access it.

## Boundaries

Bloby can only modify files inside `workspace/`. It cannot touch the supervisor, worker, or system files. This keeps the core stable while giving the agent full freedom inside its sandbox. If something breaks in the workspace, the chat is always available to ask for fixes — it runs in a separate, isolated process.
