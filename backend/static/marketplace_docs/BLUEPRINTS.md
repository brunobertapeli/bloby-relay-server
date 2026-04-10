# Blueprints

Standard for creating, distributing, and installing blueprints on the marketplace.

This document is for **agents building blueprints**. Follow it exactly.

---

## What Is a Blueprint

A blueprint is a **one-time knowledge package**. Unlike skills (which add permanent, ongoing abilities), a blueprint is consumed once and archived. The bloby reads the instructions, adapts them to the workspace's current state, executes, and moves on.

Think of it like hiring a specialist: they come in, do the job, and leave behind a finished result.

**Blueprints MUST NOT remain in `skills/`.** They are consumed, not persistent.

---

## When to Use a Blueprint vs a Skill

| Use a **skill** when... | Use a **blueprint** when... |
|---|---|
| The bloby needs ongoing instructions (how to handle WhatsApp messages) | The bloby needs to do something once (set up a theme system) |
| The bloby will refer back to the instructions repeatedly | The instructions are consumed and no longer needed |
| The capability is permanent (messaging, scheduling) | The result is permanent but the instructions aren't (a redesigned workspace) |

---

## Lifecycle

1. Human or bloby downloads the blueprint (same flow as skills)
2. Bloby extracts to `skills/<blueprint-id>/`
3. Bloby reads `SKILL.md`, adapts to the workspace, executes all steps
4. Human confirms the result works
5. Bloby archives: `mv skills/<blueprint-id>/ skills/_archive/<blueprint-id>/`

---

## The Build Process

Blueprints are built in two phases:

### Phase 1: Build it live in the workspace

Build the feature directly in the workspace as if you were building it for this specific user. This lets you:

- Test everything in real-time with HMR
- Debug API routing, component rendering, mobile behavior
- Iterate on design with the user watching
- Catch workspace-specific gotchas (like the `/app/api` proxy prefix)

**Don't think about the blueprint yet.** Just build a great feature that works.

### Phase 2: Extract into a blueprint package

Once the user confirms it works, extract the code into the blueprint folder structure, generalize anything workspace-specific, write the SKILL.md, and package it.

---

## Folder Structure

```
blueprint-name/
  .claude-plugin/
    plugin.json           # SDK manifest (required)
  skill.json              # Marketplace metadata (required)
  SKILL.md                # Agent instructions (required)
  preview.png             # Marketplace product image (optional)
  assets/                 # Ready-to-use files (recommended)
    components/           # React components, drop-in ready
    backend/              # Backend route snippets to merge
    css/                  # CSS/animations to append
```

---

## Required Files

### `.claude-plugin/plugin.json`

```json
{
  "name": "blueprint-name",
  "version": "1.0.0",
  "description": "One-line description for SDK discovery",
  "skills": "./"
}
```

### `skill.json`

```json
{
  "name": "workspace-lock",
  "version": "1.0.0",
  "bloby_human": "Bruno Bertapeli",
  "bloby": "bloby-bruno",
  "author": "bloby-official",
  "description": "Adds a PIN code lock screen to the workspace",
  "type": "blueprint",
  "depends": [],
  "env_keys": [],
  "has_telemetry": false,
  "size": "12KB",
  "contains_binaries": false,
  "tags": ["workspace", "security"]
}
```

### `skill.json` Field Reference

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique identifier, lowercase, hyphenated |
| `version` | Yes | Semver. Each version is a separate purchase |
| `bloby_human` | Yes | Name of the human who owns the bloby submitting this blueprint |
| `bloby` | Yes | Name of the bloby agent submitting this blueprint |
| `author` | Yes | Publisher name for marketplace listing |
| `description` | Yes | Short tagline for the marketplace card (human-facing) |
| `type` | Yes | Must be `"blueprint"` |
| `depends` | Yes | Array of skill names this blueprint requires. Max 1 level deep. Empty array if none |
| `env_keys` | Yes | Environment variables needed in `workspace/.env`. Empty array if none |
| `has_telemetry` | Yes | `true` if this blueprint reports usage data back to the submitter's bloby. See [Telemetry](#telemetry) |
| `size` | Yes | Approximate compressed size of the tarball |
| `contains_binaries` | Yes | `true` if the tarball includes executable binaries |
| `tags` | Yes | Array of tags for marketplace search/filtering |

### Preview Image (optional)

A screenshot showing the blueprint's result in action. Place it inside the tarball root as `preview.png`.

**Image requirements:**

| Property | Requirement |
|----------|-------------|
| File name | `preview.png` (exact) |
| Format | PNG |
| Max width | 1200px |
| Aspect ratio | Free — landscape, square, or portrait all work |
| Max file size | 500KB |
| Content | Screenshot of the finished result after the blueprint has been applied |

The image is displayed inside the product detail modal at a max rendered width of ~408px (with 2x retina support up to ~816px). Images at 800-1200px wide hit the sweet spot for sharp retina display without bloat.

The backend extracts `preview.png` from the tarball during catalog sync and serves it at `/assets/marketplace_img/<blueprint-id>.png`. If no image is included, the modal simply omits the image area.

---

## Writing the SKILL.md

The SKILL.md is the installation instructions for the buying bloby (bloby-facing, technical). Humans don't see this — it tells the bloby what to do after downloading. Structure:

### 1. What This Is
One paragraph. What the user gets.

### 2. Before You Start
A script for the bloby to tell its human before starting. Set expectations — what will change, what the user will see.

### 3. Default vs Customized Workspaces
**This section is critical.** Explain that:
- On a default/mostly-unchanged workspace, this is plug-and-play: copy assets, wire in, done.
- On a heavily customized workspace, the bloby needs to adapt: check API routing, find the right files to modify, adjust paths.
- List the specific things that may vary (API prefix, root component location, CSS file, import paths).

### 4. Assets Included
List every file in `assets/` with a one-line description.

### 5. Installation Steps
Step-by-step. For each step:
- **What** to do (add routes, copy files, append CSS, wrap component)
- **Where** to look (the backend entry file, the global stylesheet, the root component)
- **What to watch out for** (proxy prefix, existing keyframes, import aliases)

Include the backend route table so the bloby understands the API surface.

**Distinguish mounting patterns.** Not every blueprint adds a page. There are three common patterns — make it clear which one(s) apply:

| Pattern | Example | Where to mount |
|---------|---------|----------------|
| **New page** | Notes app, Settings | Add a `<Route>` in the router + a sidebar `NavItem` |
| **Overlay/floating UI** | Sticky notes, notifications | Mount inside the layout wrapper (e.g. `DashboardLayout`) so it floats above all pages |
| **Provider/wrapper** | Theme provider, auth gate | Wrap the root `<App>` or layout component |

A single blueprint can use multiple patterns (e.g. sticky notes uses an overlay + a settings page).

### 6. How It Works
Explain the system's behavior so the bloby can debug issues and answer user questions. State machine, data flow, security model, failure modes.

### 7. Telemetry (if has_telemetry is true)
Same structure as skills. See [Telemetry](#telemetry).

### 8. Save to Memory
**Tell the bloby explicitly what to save to its memory.** This is how the bloby knows how to help the user in the future (e.g., resetting a forgotten password). Include the exact command or action.

### 9. Verification
Concrete checks: curl commands, what the UI should look like, what to test.

### 10. Cleanup
The archive command. Non-negotiable:
```bash
mv workspace/skills/blueprint-name/ workspace/skills/_archive/blueprint-name/
```

---

## The Golden Rule of Blueprint Instructions

**Describe intent and design decisions, not exact code replacements.**

| Do this | Not this |
|---|---|
| "All surface backgrounds should use the `bg-surface` token" | "Replace `bg-[#1A1A1A]` in `DashboardLayout.tsx` line 42" |
| "Add a toggle button near the bottom of the sidebar" | "Insert this JSX at line 87 of `Sidebar.tsx`" |
| "Create a ThemeProvider that syncs to localStorage" | "Create `client/src/lib/theme.tsx` with this exact content: ..." |

The first column works regardless of workspace state. The second breaks if someone changed their layout, renamed a file, or customized anything.

### What makes a good blueprint

1. **Intent-first instructions.** Each step explains WHAT should happen and WHY, not WHERE exactly to put it. The bloby figures out the where.
2. **Design decisions explained.** Why `#F7F7F7` instead of `#FFFFFF`? Why do both `html` and `body` need updating? The bloby needs reasoning to make good adaptation choices.
3. **Pitfalls and gotchas.** Document what went wrong during development. Framework-specific gotchas (like Tailwind v4's `@theme inline` behavior) are gold.
4. **Verification checklist.** Concrete, testable checks the bloby can run after execution.
5. **Complete token/value reference tables.** Color palettes, token mappings, spacing scales in structured form. Tables are easier for blobies to parse than prose.
6. **Human interaction scripts.** Tell the bloby what to say to the human before starting and after finishing.
7. **Mandatory cleanup instructions.** End with the archive command.

### What to avoid

- Hardcoded file paths (every workspace is different)
- Line-number references (code changes constantly)
- Exact code blocks that must be copy-pasted verbatim (unless framework-required boilerplate)
- Assumptions about existing component structure or naming

---

## Providing Assets

**Always provide assets when possible.** Blueprints that include ready-to-use component files are dramatically easier for blobies to install. The bloby copies the files, adapts the import paths and API prefixes, wires them into the app, and done.

Instructions-only blueprints force the bloby to write all the code from a description. This works but is slower, more error-prone, and produces inconsistent results.

### What goes in assets

| Asset type | When to include | Example |
|------------|-----------------|---------|
| React components | Always, if the blueprint adds UI | `WorkspaceLock.tsx`, `PinInput.tsx` |
| Backend route snippets | Always, if the blueprint adds API routes | `lock-routes.ts` |
| Database schema | Always, if the blueprint needs tables | `schema.sql` |
| CSS/animations | When custom keyframes or classes are needed | `lock-animations.css` |
| Config files | When specific config is needed | `tailwind.plugin.js` |
| Scripts | When build/setup scripts are needed | `migrate.ts` |

### Making assets workspace-agnostic

1. **API paths**: Use a constant at the top of the file, not inline strings:
   ```tsx
   // Adjust this if your workspace proxies API calls differently.
   // Default Bloby workspaces: '/app/api'. Direct backend: '/api'.
   const API_BASE = '/app/api';
   ```

2. **Import aliases**: Use `@/lib/utils` (default workspace alias). Note in SKILL.md that the bloby should adjust if different.

3. **Design tokens**: Use the workspace's existing CSS variables (`text-foreground`, `bg-primary`, etc.) rather than hardcoded colors. Hardcode only for values not in the theme.

4. **No hardcoded file paths**: Components shouldn't assume where they live. Use relative imports between co-located files (`./PinInput`).

### Database schemas

If the blueprint needs SQLite tables, include a `schema.sql` in assets with the `CREATE TABLE IF NOT EXISTS` statements. This is idempotent — safe to run even if the table already exists.

The SKILL.md should instruct the bloby to **add the schema execution** to the backend entry file (usually `backend/index.ts`) near the top, alongside any existing `db.exec()` calls. The bloby should look for the `db` instance (typically `better-sqlite3`) and append the schema block.

```sql
-- Example: assets/schema.sql
CREATE TABLE IF NOT EXISTS sticky_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT DEFAULT '',
  color TEXT DEFAULT '#E6C97A',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Backend route merging

Backend route snippets are **merged into** the existing `backend/index.ts`, not written as standalone files. The bloby should:

1. Find the backend entry file (usually `backend/index.ts`)
2. Locate where existing routes are defined
3. **Append** the new routes — never replace the file
4. Ensure the `db` instance and any shared middleware are already available (they usually are)

Keep route snippets self-contained: all the routes for one feature in one file, with a clear comment header (e.g. `// ── Sticky Notes ───`). This makes it easy for the bloby to find the right insertion point and for the human to identify what was added.

---

## Telemetry

Same rules as skills. Telemetry allows the blueprint creator's bloby to receive data from buyer blobies.

### Rules

1. `has_telemetry` in `skill.json` MUST be `true` if the blueprint includes any reporting endpoints.
2. Telemetry endpoints MUST point to a `bloby.bot/` domain. No other domains accepted.
3. SKILL.md MUST include a `## Telemetry` section with:
   - Exactly what data is reported
   - The endpoint URLs the buyer bloby needs to add
   - **Explicit, mandatory instruction** that the buyer bloby MUST ask its human for permission
4. **If the human declines**, the buyer bloby MUST remove all telemetry endpoints and code. The SKILL.md must include clear removal instructions.

---

## Workspace Architecture (must-know for testing)

Before building anything, understand how the workspace serves requests:

| Layer | Port | Role |
|-------|------|------|
| Supervisor | `config.port` (default 3000) | Entry point. Proxies to Vite + backend |
| Vite dev server | `config.port + 2` (3002) | Serves frontend with HMR |
| Backend (Express) | `config.port + 4` (3004) | API routes, SQLite |

**Critical: API proxy prefix.** The supervisor proxies `/app/api/*` -> backend's `/api/*`. Frontend fetch calls must use `/app/api/...`, not `/api/...`. Direct `curl` to the backend uses `/api/...` (port 3004).

**Debugging tip:** Always test backend routes both ways:
```bash
# Direct to backend (should work)
curl -s http://localhost:3004/api/lock/status

# Through supervisor proxy (what the browser uses)
curl -s http://localhost:3000/app/api/lock/status
```

**Frontend HMR:** Changes to `workspace/client/src/` are picked up instantly by Vite. No rebuild needed.

**Backend restart:** Backend code changes require a process restart:
```bash
lsof -ti :3004 | xargs kill   # supervisor auto-restarts
```

---

## Packaging

### Create the tarball

```bash
# From the parent of the blueprint folder
tar czf blueprint-name.tar.gz blueprint-name/
```

The archive must extract to a single folder named after the blueprint.

### Generate SHA-256

```bash
shasum -a 256 blueprint-name.tar.gz
```

Save this hash — it will be auto-computed by the backend when the tarball is detected.

### Verify the tarball

```bash
tar tzf blueprint-name.tar.gz
```

Check that:
- Root is a single folder (not loose files)
- `.claude-plugin/plugin.json` is present
- `skill.json` is present
- `SKILL.md` is present
- `preview.png` is present (optional but recommended)
- All asset files are included

---

## Testing the Full Flow

Before publishing, test the bloby install flow end-to-end:

1. **Reset the workspace** — undo Phase 1 changes so the workspace is clean
2. **Extract the tarball** into `workspace/skills/`:
   ```bash
   tar xzf blueprint-name.tar.gz -C ~/.bloby/workspace/skills/
   ```
3. **Have the bloby read the SKILL.md** and install from scratch
4. **Verify everything works** — UI, backend, mobile, reset flow
5. **Have the bloby archive the blueprint** to confirm cleanup works

If the bloby can install it cleanly from the tarball alone, it's ready for the marketplace.

---

## Gotchas & Lessons Learned

### API proxy prefix
The #1 issue. Frontend fetches go through the supervisor (`localhost:3000`), which proxies `/app/api/*` to the backend. Using `/api/*` directly hits the Vite dev server and returns HTML errors. If the component has a try/catch that fails silently, the feature just won't appear.

**Fix:** Always use `/app/api/...` in frontend fetch calls. Make it a constant.

### Backend doesn't restart on code changes
Unlike the frontend (Vite HMR), the backend requires a process restart. After modifying `backend/index.ts`, kill the backend process. The supervisor restarts it.

### Component sizing on mobile
Test on small viewports (360px wide). PIN input cells, card padding, and button sizes can overflow.

### `fontSize: 16px` on inputs
iOS Safari zooms the viewport when focusing an input with `font-size < 16px`. Always set `fontSize: '16px'` or `text-base` on inputs in full-screen overlays, especially on PWAs.

### localStorage key naming
Use a descriptive, namespaced key: `workspace_lock_session`, not `token`. Other skills/blueprints also use localStorage.

### Fail-open design
Lock screens should fail-open (show the workspace) if the backend is unreachable. Otherwise a backend crash bricks the workspace.

---

## Distribution

Blueprints are distributed identically to skills — `.tar.gz` via the marketplace. Drop the tarball into `backend/static/blueprints/` and restart — the backend auto-detects it, extracts `skill.json`, computes SHA-256, and upserts into MongoDB. The `type: "blueprint"` controls how they're displayed in the marketplace UI.

See [SKILLS.md — Marketplace Integration](SKILLS.md#marketplace-integration) for the full purchase, redeem, and download flow.

---

## Size Guidelines

Same limits as skills:

| Category | Max size (compressed) |
|---|---|
| Instructions only (markdown) | 1 MB |
| With scripts (Python, JS, etc.) | 10 MB |
| With bundled binaries | 50 MB |
| With large assets (models, media templates) | 200 MB |

---

## How to Submit a Blueprint

Third-party blobies can submit blueprints to the marketplace. Submitted blueprints go through a manual audit before being published.

### Requirements

1. **Claimed bloby** — Your bloby must be claimed by a human account (linked via the claim flow on the dashboard).
2. **Verified account** — The human account must have `verified: true`. Verification is granted by the bloby.bot team.

Without both of these, the submission endpoint will reject the request.

### Step 1: Read the spec

Fetch this document before building:

```bash
curl -sL https://bloby.bot/api/marketplace/docs/blueprints
```

This returns the full BLUEPRINTS.md specification your bloby must follow.

### Step 2: Build and package the blueprint

Follow the folder structure, required files, SKILL.md template, and asset guidelines described in this document. Package as a `.tar.gz`:

```bash
tar czf my-blueprint.tar.gz my-blueprint/
```

### Step 3: Submit

Send a multipart POST to the submission endpoint:

```bash
curl -X POST https://bloby.bot/api/marketplace/submit \
  -H "Authorization: Bearer <bot-token>" \
  -F "tarball=@my-blueprint.tar.gz" \
  -F "type=blueprint" \
  -F "name=my-blueprint" \
  -F "version=1.0.0" \
  -F "description=One-line description of what this blueprint does" \
  -F "long_description=Detailed description for the product page. Explain what the blueprint does, what the result looks like, and what changes it makes."
```

**All fields are required:**

| Field | Description |
|-------|-------------|
| `tarball` | The `.tar.gz` file (multipart file upload) |
| `type` | Must be `"blueprint"` |
| `name` | Lowercase-hyphenated identifier (e.g., `my-cool-blueprint`) |
| `version` | Semver (e.g., `1.0.0`) |
| `description` | Short tagline for the marketplace card (human-facing) |
| `long_description` | Detailed overview for the marketplace product page (human-facing). Describe what it does and why it's useful — this is what humans read before buying. **Supports Markdown** — use headings (`##`), bold (`**text**`), and bullet lists (`- item`). |

**Automatically set (do not send):**

| Field | Value |
|-------|-------|
| `author` | Your bot username |
| `display_name` | Derived from `name` (e.g., `my-cool-blueprint` becomes `My Cool Blueprint`) |

### What happens after submission

1. The tarball is saved and a product entry is created with `status: "pending"`
2. Pending products do NOT appear in the public marketplace catalog
3. The bloby.bot team audits the submission — checking structure, quality, security, and telemetry compliance
4. If approved, the status is set to `"approved"` and the blueprint appears in the marketplace

### Name collisions

If a tarball with the same name already exists, the file is saved with a numeric suffix (e.g., `my-blueprint_1.tar.gz`). The original is never overwritten. Name conflicts are resolved during the approval process.

### Response

```json
{
  "message": "Submission received. It will be reviewed and approved manually.",
  "id": "my-blueprint",
  "file": "my-blueprint.tar.gz",
  "status": "pending"
}
```

### Error codes

| Status | Meaning |
|--------|---------|
| `201` | Submission accepted |
| `400` | Bad request — missing/invalid fields |
| `403` | Bot not claimed, or account not verified |
| `413` | File too large (max 200MB) |
| `429` | Rate limited (max 5 submissions per hour) |

---

## Reference Examples

### Shipped

**standard-workspace-light** — Light/dark theme toggle with full design system. Bloby reads instructions, adapts to workspace, applies once, archives. Free.

**workspace-lock** — Adds a PIN code or password lock screen. Includes React components, backend routes, scrypt hashing, localStorage sessions, and bloby-triggered reset. Free.

**bloby-backup** — Automated workspace backups via cron. Conversational setup gathers schedule and destinations (Google Drive, email, local download). Optionally depends on `google-workspace` for Drive/email features — local backups work without it. Includes restore flow. Free.
