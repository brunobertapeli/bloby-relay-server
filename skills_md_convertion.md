# Skill Format Migration — Cross-Compatible (Claude + Codex)

> **Status (2026-06-10): COMPLETE — with one revision.** Every skill ships the YAML
> frontmatter described below, and all three harnesses now consume it (Claude via the
> `workspace/.claude/skills` mirror + SDK `skills` option, Codex via the
> `workspace/.codex/skills` mirror + `skills/list`, Pi via a system-prompt index — see
> `supervisor/harnesses/skills.ts`). Revision versus the original plan:
> `.claude-plugin/plugin.json` turned out to be read by **nothing** and has been
> **removed from all skills — do not add it to new ones**. SKILL.md frontmatter is the
> single canonical metadata; keep `skill.json` (Morphy marketplace) descriptions in sync
> with it. Mentions of `.claude-plugin` below are historical context only.

## Goal

Make every skill in the Morphy marketplace work with **both** the Claude harness and the new OpenAI/Codex harness, using a single canonical on-disk layout. Today's skills follow the Claude-only convention (a `.claude-plugin/plugin.json` next to a `SKILL.md` that has no YAML frontmatter). Codex rejects them with `"missing YAML frontmatter delimited by ---"`. The migration is small and additive — Claude continues to work; Codex starts working.

## Required change (every skill)

Prepend a YAML frontmatter block to **`SKILL.md`** with two mandatory keys:

```yaml
---
name: <skill-name>
description: <one-paragraph description used for routing>
---
```

That's the entire mandatory change. The rest of `SKILL.md` stays exactly as it is.

### Rules for the frontmatter

| Key | Rule |
|---|---|
| `name` | Must equal the **folder name** of the skill (e.g. `whatsapp` for `workspace/skills/whatsapp/`). Lowercase, hyphenated, no spaces. |
| `description` | Required. Should be **the same string** as the `description` field in `skill.json` so the two never drift. Codex uses this for skill-routing decisions, so the more specific the better. If the existing description is a one-liner, that's fine — leave it. Do not invent new copy. |
| `---` delimiters | Exactly three dashes on their own lines. The opening `---` MUST be the very first line of the file (no blank line, no BOM, no comment before it). |

### Why these two are enough

- `name` lets Codex's router invoke the skill via `$<skill-name>` mentions in user input.
- `description` lets Codex's router decide *when* the skill applies.

## Optional change (richer Codex display) — `SKILL.json`

If a skill wants a nicer presentation in Codex's skill picker (icon, brand color, display name), add a sibling **`SKILL.json`** (capital `SKILL`, NOT the existing lowercase `skill.json`). All keys are optional:

```json
{
  "displayName": "WhatsApp",
  "shortDescription": "Connect a WhatsApp number via QR",
  "iconSmall": "./assets/icon-small.svg",
  "iconLarge": "./assets/icon-large.png",
  "brandColor": "#25D366",
  "defaultPrompt": "Use $whatsapp to send or receive WhatsApp messages."
}
```

| Key | Notes |
|---|---|
| `displayName` | Title-cased human label (e.g. `"WhatsApp"`). Falls back to `name` if omitted. |
| `shortDescription` | One-line tagline (~60 chars). Used in Codex's skill list UI. |
| `iconSmall` / `iconLarge` | Paths relative to the skill folder. Codex resolves them to absolute paths on load. SVG preferred for small, PNG for large (256×256+). |
| `brandColor` | Hex like `"#25D366"`. Codex uses it for accents. |
| `defaultPrompt` | Suggested prompt shown in Codex when the skill is selected. |

Skip `SKILL.json` entirely if you don't have icons/branding to add. The skill works either way.

## What MUST stay unchanged

| File / directory | Why |
|---|---|
| ~~`.claude-plugin/plugin.json`~~ | **Removed 2026-06-10** — nothing reads it. Do not ship it in new skills. |
| `skill.json` (lowercase) | Morphy's own marketplace metadata (`bloby_human`, `morphy`, `tags`, `size`, etc.). |
| Body of `SKILL.md` (everything after the frontmatter) | Both Claude and Codex consume the same instructions. |
| Folder name | Same value as `name` in the new frontmatter and as `name` in `.claude-plugin/plugin.json` / `skill.json`. |
| `SCRIPT.md` (if present) | Used by Morphy's customer-facing channel mode. Untouched. |
| Asset files | Untouched, except they may be referenced from `SKILL.json` iconSmall/iconLarge. |

## Step-by-step procedure (run for every skill)

1. **Open `<skill-folder>/SKILL.md`.**

2. **Read `<skill-folder>/skill.json`** (or `.claude-plugin/plugin.json` if `skill.json` is missing) to grab the canonical `name` and `description`.

3. **Prepend** the YAML frontmatter block to `SKILL.md`. Result must look exactly like:

   ```
   ---
   name: <name from step 2>
   description: <description from step 2>
   ---

   # <existing first heading>
   <rest of file unchanged>
   ```

   Notes:
   - Add **one blank line** between the closing `---` and the first existing line of content.
   - If `description` contains characters that would break YAML (`:`, `#`, `[`, `]`, `{`, `}`, `&`, `*`, `!`, `|`, `>`, single/double quotes, `%`, `@`, backtick, leading whitespace, leading `-`/`?`), wrap the value in **double quotes** and escape any literal `"` as `\"`. Plain ASCII descriptions usually need no quoting.
   - Multiline descriptions: use the YAML folded form. Example:
     ```yaml
     description: >
       First sentence on its own line.
       Second sentence is concatenated with a space.
     ```

4. **(Optional) Create `SKILL.json`** if the skill has icons or wants custom branding. Skip otherwise.

5. **Do NOT** modify `skill.json` (beyond syncing its description), the SKILL.md body, the folder name, `SCRIPT.md`, or any assets.

6. **Validate** (see next section).

## Validation

For each migrated skill, confirm:

1. **Frontmatter parses as YAML.** Run from the skill folder:
   ```bash
   awk '/^---$/{c++; next} c==1{print}' SKILL.md | head -20
   ```
   This prints just the frontmatter block. Confirm it has `name:` and `description:` lines and nothing else weird.

2. **`name` matches the folder name.** From the skill's parent directory:
   ```bash
   for d in */; do
     name=$(awk '/^---$/{c++; next} c==1 && /^name:/ {print $2}' "$d/SKILL.md")
     [ "${d%/}" = "$name" ] || echo "MISMATCH: folder=${d%/} name=$name"
   done
   ```

3. **The body of SKILL.md is unchanged below the frontmatter.** A diff against the prior commit should show *only* the prepended frontmatter block (and exactly one blank line after it).

4. **The harnesses pick it up.** Codex lists the skill via `skills/list` (wired — see `primeWorkspaceSkills` in `supervisor/harnesses/codex.ts`), Claude lists it natively through the `workspace/.claude/skills` mirror, and Pi shows it in the system-prompt index.

## Common pitfalls (do not introduce these)

- **Don't** put anything before the opening `---` (no comment, no BOM, no shebang). Codex reads only frontmatter from the very first line.
- **Don't** rename `SKILL.md` to lowercase or anything else — both providers look for that exact filename.
- **Don't** add a `.claude-plugin/` folder — it was removed 2026-06-10 and nothing reads it.
- **Don't** rename or merge `skill.json` (lowercase Morphy file) and `SKILL.json` (uppercase Codex file). They are different files with different schemas.
- **Don't** move the description into the frontmatter and remove it from `skill.json`. Both (`SKILL.md` frontmatter, `skill.json`) must keep the description in sync.
- **Don't** translate or summarize the existing description. Use the exact same string the skill already ships with.
- **Don't** add fields beyond `name` and `description` to the frontmatter unless the codex schema documents them. Extra unknown fields are likely tolerated but may cause warnings — keep frontmatter minimal.
- **Don't** edit `SCRIPT.md` or any other content under the skill folder. This migration is *only* about discoverability metadata.

## Worked example — `workspace/skills/whatsapp`

### Before
`.claude-plugin/plugin.json`:
```json
{
  "name": "whatsapp",
  "version": "2.0.0",
  "description": "WhatsApp channel via Baileys. QR auth, messaging, voice transcription, channel and business modes.",
  "skills": "./"
}
```

`skill.json`:
```json
{
  "name": "whatsapp",
  "version": "2.0.0",
  "type": "skill",
  "bloby_human": "Bruno Bertapeli",
  ...
  "description": "WhatsApp channel for your agent via Baileys. QR auth, messaging, voice transcription, channel and business modes.",
  "depends": [],
  ...
}
```

`SKILL.md` (first lines):
```markdown
# WhatsApp

## What This Is

Gives your agent a WhatsApp number. Connect via QR code, send and receive messages, …
```

### After
`skill.json` — **unchanged** (description synced to the frontmatter if it drifted).

`SKILL.md` (first lines) — frontmatter prepended; body untouched:
```markdown
---
name: whatsapp
description: WhatsApp channel via Baileys. QR auth, messaging, voice transcription, channel and business modes.
---

# WhatsApp

## What This Is

Gives your agent a WhatsApp number. Connect via QR code, send and receive messages, …
```

(The frontmatter description is the canonical one. If `skill.json`'s description drifted, update it to match the frontmatter. **Do not edit any other content** while doing so.)

### Optional `SKILL.json` for nicer Codex display
```json
{
  "displayName": "WhatsApp",
  "shortDescription": "Connect a WhatsApp number via QR",
  "brandColor": "#25D366",
  "defaultPrompt": "Use $whatsapp to send or receive WhatsApp messages."
}
```

## Final checklist (per skill)

- [ ] `SKILL.md` starts with a valid YAML frontmatter block.
- [ ] `name:` value equals the folder name exactly.
- [ ] `description:` in `skill.json` matches the frontmatter exactly (update if it drifted).
- [ ] No other content of `SKILL.md` was modified.
- [ ] No `.claude-plugin/` folder — it's dead weight, nothing reads it.
- [ ] Folder name, assets, `SCRIPT.md` all untouched.
- [ ] (Optional) `SKILL.json` added for icons/branding — strictly additive.

When every skill in the marketplace passes the checklist above, it loads in all three harnesses: Codex via `skills/list`, Claude via the `workspace/.claude/skills` mirror, Pi via the system-prompt index.
