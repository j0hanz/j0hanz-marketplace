# Plan 023: Sync the groundwork catalog description with the manifest

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 4e32151..HEAD -- .claude-plugin/marketplace.json site/src/data/marketplace.json README.md plugins/groundwork/.claude-plugin/plugin.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live file before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `4e32151`, 2026-11-17

## Why this matters

The catalog's `groundwork` entry carries a hand-paraphrased description; the plugin's own manifest carries a different, richer one. `npm run validate` compares only names (plus name/version/description against the Antigravity manifest), so the two texts can drift forever unnoticed. One of them is displayed on the site and in the README's generated plugin region; the other in Claude Code's plugin listing. Making them identical removes a whole class of future drift. Same fix was chosen for the telltale plugin in an earlier audit round (see `plans/README.md`, "Catalog and manifest descriptions diverged").

## Current state

`plugins/groundwork/.claude-plugin/plugin.json` — the manifest, the richer text (its `description` value):

```
The thinking before the code: relentless grilling of a plan, a domain model kept in GLOSSARY.md and ADRs, deep-module design vocabulary, architecture reviews that surface deepening opportunities, throwaway prototypes that settle a logic or layout question, and research against primary sources.
```

`.claude-plugin/marketplace.json` — the catalog. Lines 82–87 today:

```json
{
  "name": "groundwork",
  "source": "./plugins/groundwork",
  "description": "The thinking before the code: grill a plan, keep the domain model in GLOSSARY.md and ADRs, design deep modules, surface deepening opportunities, prototype logic and layouts, research primary sources",
  "category": "development"
},
```

The catalog's description is the paraphrase to replace. The manifest text wins (it is the one Claude Code surfaces and the one the `.antigravity-plugin` manifest must also match — it already does).

Generated files: `npm run site:data` rebuilds `site/src/data/marketplace.json` from the catalog and rewrites the README's generated regions (`<!-- install:start -->`, `<!-- copilot:start -->`, `<!-- antigravity:start -->`, `<!-- plugins:start -->`). Never hand-edit those regions (repo CLAUDE.md).

## Commands you will need

| Purpose                | Command             | Expected on success                                                      |
| ---------------------- | ------------------- | ------------------------------------------------------------------------ |
| Rebuild generated data | `npm run site:data` | exit 0; rewrites `site/src/data/marketplace.json` + README regions       |
| Full validation        | `npm run validate`  | exit 0                                                                   |
| Full pre-merge gate    | `npm run check`     | exit 0 (its `typecheck` step chains `site:data` again — must stay clean) |

`npm run validate` and `npm run check` need `claude` on PATH (repo CLAUDE.md). A failure pointing at a path outside `plugins/groundwork/` or the generated files is pre-existing noise for this plan: report it, do not chase it.

## Scope

**In scope** (the only files you should modify):

- `.claude-plugin/marketplace.json` (the `groundwork` entry's `description` only)
- `site/src/data/marketplace.json` and `README.md` — but only by running `npm run site:data`, never by hand
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):

- `plugins/groundwork/.claude-plugin/plugin.json` and `plugins/groundwork/.antigravity-plugin/plugin.json` — the source of the winning text; they stay byte-identical. No version bump: the plugin's own files do not change in this plan.
- Other catalog entries and their descriptions.
- The site components (`site/src/components/…`) — they render whatever data `site:data` emits.

## Git workflow

- Branch: `groundwork/plan-023-catalog-sync`
- One commit. Subject style, matching `git log`:
  `chore(groundwork): sync catalog description with the manifest`
- End the commit message with:
  `Co-Authored-By: Claude Code <noreply@anthropic.com>`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Replace the catalog description

In `.claude-plugin/marketplace.json`, in the `groundwork` entry, replace the `description` value with the manifest's description, copied byte-for-byte from `plugins/groundwork/.claude-plugin/plugin.json`:

```json
"description": "The thinking before the code: relentless grilling of a plan, a domain model kept in GLOSSARY.md and ADRs, deep-module design vocabulary, architecture reviews that surface deepening opportunities, throwaway prototypes that settle a logic or layout question, and research against primary sources.",
```

The text contains no double quotes, so no JSON escaping is needed. Keep the JSON valid: one line, surrounding entries unchanged.

**Verify**: `node -p "require('./.claude-plugin/marketplace.json').plugins.find(p=>p.name==='groundwork').description === require('./plugins/groundwork/.claude-plugin/plugin.json').description"` → prints `true`.

### Step 2: Regenerate the site data

Run `npm run site:data`. It rewrites `site/src/data/marketplace.json` and the README's generated regions from the catalog.

**Verify**: `git diff --name-only` lists only `.claude-plugin/marketplace.json`, `site/src/data/marketplace.json`, `README.md` (plus nothing else). The README diff is confined to the generated regions.

### Step 3: Validate

**Verify**: `npm run validate` → exit 0, or failures only on paths unrelated to this change (report those as-is). Then `npm run check` → exit 0, or failures only in the same pre-existing places.

## Test plan

No new tests. `scripts/site-catalog.test.mjs` and `scripts/site-capability.test.mjs` already run under `npm test` against the generated data; Step 3's `npm run check` runs them. The equality check in Step 1 is the regression guard for the drift this plan removes.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] The Step 1 `node -p` equality check prints `true`
- [ ] `npm run site:data` exits 0 and `git diff --name-only` shows only the three expected files
- [ ] `npm run check` exits 0, or fails only on pre-existing items outside this change
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The catalog or manifest excerpts in "Current state" do not match the live files (drift since `4e32151`).
- `npm run site:data` rewrites anything beyond `site/src/data/marketplace.json` and the README's generated regions — that means the catalog or other plugins drifted; report, don't untangle.
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Future description edits: change the manifest first, then copy the text into the catalog, then run `npm run site:data` — `npm run validate` will not catch the divergence for you.
- Reviewer: confirm `plugins/groundwork/.claude-plugin/plugin.json` and `.antigravity-plugin/plugin.json` are byte-identical to their pre-plan state (they must not be touched).
- Deferred: making `validate` compare catalog vs manifest descriptions — that is a marketplace-wide lint change, not this plan.
