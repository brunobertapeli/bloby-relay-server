---
title: "PR Guidelines"
---

### Branch Naming

Use descriptive branch names with a prefix indicating the type of change:

```
feat/add-file-upload-api
fix/tunnel-reconnect-race
refactor/split-worker-routes
docs/add-mcp-setup-guide
chore/update-dependencies
```

### Commit Messages

Write clear commit messages that explain what changed and why. Keep the subject line under 72 characters. Use the imperative mood.

```
# Good
Add file upload endpoint to worker API
Fix tunnel health check false positives on macOS
Refactor scheduler to support cron expressions

# Bad
updated stuff
fix
WIP
```

For multi-line commit messages, add a blank line after the subject and then a body with more detail:

```
Fix tunnel health check false positives on macOS

The health check was probing the tunnel URL directly, which fails on
macOS due to DNS/firewall restrictions. Changed to probe localhost
instead -- if the local server responds and cloudflared is running,
the tunnel is alive.
```

### What to Include in a PR Description

- **What** changed (brief summary)
- **Why** this change is needed (problem statement or feature request)
- **How** it was implemented (design decisions, trade-offs)
- **How to test** (manual steps to verify the change)
- **Screenshots** if the change affects UI

### Review Process

1. Ensure your branch is up to date with `main`
2. Run `npm run build` locally to verify both builds succeed (dashboard + chat)
3. Test your changes manually on at least one platform
4. If you changed `supervisor/chat/` source, run `npm run build:fluxy` and include the updated `dist-fluxy/` in your commit
5. Open a PR against `main` with a clear description
6. Address review feedback with new commits (do not force-push during review)

### Checklist Before Submitting

- [ ] Code compiles with no TypeScript errors
- [ ] `npm run build` completes successfully
- [ ] Manual testing confirms the feature works
- [ ] No hardcoded ports or paths
- [ ] No database logic in the supervisor
- [ ] No new default exports (use named exports)
- [ ] Import paths use `.js` extension for server-side ESM imports
- [ ] If chat UI was modified, `dist-fluxy/` is rebuilt and included
- [ ] Commit messages are descriptive and in imperative mood
