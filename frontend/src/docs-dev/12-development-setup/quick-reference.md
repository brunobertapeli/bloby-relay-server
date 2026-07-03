---
title: "Quick Reference"
---

## Quick Reference

```bash
# Install dependencies (from the project root)
npm install

# Create config (if it does not exist)
mkdir -p ~/.morphy
# Then either run `morphy init` or create config.json manually

# Start development
npm run dev

# Open in browser
# Dashboard:  http://localhost:7400
# Chat UI:    http://localhost:7400/bloby

# Build all
npm run build

# Build chat UI only
npm run build:chat

# Start in production mode
npm start
# (equivalent to: node --import tsx/esm supervisor/index.ts)
```
