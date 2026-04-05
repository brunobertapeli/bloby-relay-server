---
title: "Quick Reference"
---

## Quick Reference

```bash
# Clone and install
git clone https://github.com/<org>/bloby.git && cd bloby
npm install

# Create config (if it does not exist)
mkdir -p ~/.bloby
# Then either run `bloby init` or create config.json manually

# Start development
npm run dev

# Open in browser
# Dashboard:  http://localhost:3000
# Chat UI:    http://localhost:3000/bloby

# Build all
npm run build

# Build chat UI only
npm run build:bloby

# Start in production mode
npm start
# (equivalent to: node --import tsx/esm supervisor/index.ts)
```
