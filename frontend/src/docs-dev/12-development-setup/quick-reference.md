---
title: "Quick Reference"
---

## Quick Reference

```bash
# Clone and install
git clone https://github.com/<org>/fluxy.git && cd fluxy
npm install

# Create config (if it does not exist)
mkdir -p ~/.fluxy
# Then either run `fluxy init` or create config.json manually

# Start development
npm run dev

# Open in browser
# Dashboard:  http://localhost:3000
# Chat UI:    http://localhost:3000/fluxy

# Build all
npm run build

# Build chat UI only
npm run build:fluxy

# Start in production mode
npm start
# (equivalent to: node --import tsx/esm supervisor/index.ts)
```
