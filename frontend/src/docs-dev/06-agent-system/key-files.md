---
title: "Key Files"
---

## Appendix: Key File Paths

| File | Purpose |
|------|---------|
| `supervisor/bloby-agent.ts` | Agent harness dispatcher: routes each call to the active provider's harness |
| `supervisor/harnesses/claude.ts` | Claude Agent SDK harness (provider `anthropic`) |
| `supervisor/harnesses/codex.ts` | Codex app-server harness (provider `openai`) |
| `supervisor/harnesses/pi/` | Pi harness (provider `pi`) |
| `supervisor/harnesses/skills.ts` | Shared skill plumbing consumed by all harnesses |
| `supervisor/harnesses/attachment-policy.ts` | Shared attachment-ingestion policy for all harnesses |
| `supervisor/scheduler.ts` | Pulse and Cron scheduler |
| `supervisor/index.ts` | Supervisor process: HTTP server, WebSocket, routing |
| `supervisor/file-saver.ts` | Attachment persistence to disk |
| `shared/ai.ts` | Provider-agnostic streaming-chat layer (fallback for providers without a harness) |
| `shared/config.ts` | Configuration loading and persistence |
| `shared/paths.ts` | Canonical path definitions |
| `worker/index.ts` | In-process Express API app (`createWorkerApp()`), mounted by the supervisor |
| `worker/db.ts` | SQLite database schema and queries |
| `worker/claude-auth.ts` | Claude OAuth PKCE flow |
| `worker/codex-auth.ts` | Codex OAuth PKCE flow (paste-back, credentials in `~/.codex/auth.json`) |
| `worker/prompts/prompt-assembler.ts` | System prompt assembly: base prompt plus dynamic fragments per harness |
| `worker/prompts/bloby-system-prompt.txt` | Base system prompt template (Claude; `-codex.txt` and `-pi.txt` variants exist per harness) |
| `workspace/MYSELF.md` | Agent identity file |
| `workspace/MYHUMAN.md` | User profile file |
| `workspace/MEMORY.md` | Curated long-term memory |
| `workspace/PULSE.json` | Pulse scheduler configuration |
| `workspace/CRONS.json` | Cron task definitions |
| `workspace/MCP.json` | MCP server configuration |
| `workspace/memory/YYYY-MM-DD.md` | Daily note files |
| `workspace/tasks/{id}.md` | Detailed cron task instructions |
| `workspace/skills/` | Skill folders (`SKILL.md` with name+description frontmatter) |
