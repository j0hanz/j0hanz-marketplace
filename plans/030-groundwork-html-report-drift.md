# Plan 030: The architecture report guide agrees with its own example and its template

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8b0fefe..HEAD -- plugins/groundwork/skills/improve-codebase-architecture/`
> If either in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live files before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `8b0fefe`, 2026-11-23

## Why this matters

The groundwork plugin's `improve-codebase-architecture` skill has an agent write an HTML report. It follows `HTML-REPORT.md` and copies the `report.html` template. The guide disagrees with itself and with the template in three places. First, it says "Prefer `flowchart TD`", because a wide left-to-right graph scrolls sideways in a narrow pane, but its only flowchart example opens with `flowchart LR`. Agents copy examples over rules, so reports get the sideways-scrolling graphs the rule exists to prevent. Second, the guide says each core-sample band scales at `0.75rem` per count, while the template's CSS uses `0.7rem`. Third, the template styles a `.caps` class that the guide never lists and no markup uses. After this plan, the example follows the rule, the documented scale matches the CSS, and the template carries no dead selector.

## Current state

Files (both under `plugins/groundwork/skills/improve-codebase-architecture/`):

- `HTML-REPORT.md`: the guide the agent follows to fill the report.
- `report.html`: the template the agent copies; holds the stylesheet and the Mermaid loader.
- `SKILL.md` (same folder): points at both. Do not change it.

`HTML-REPORT.md:160` (indented two spaces; it continues the list item above it):

```text
  Each band scales at `0.75rem` per count, capped at 14. If any module in figure passes 14, divide every count in that figure by same factor so heights still compare. Both bands use same unit, so proportion tells truth. Text inside core = its label.
```

`HTML-REPORT.md:172`:

```text
Use `flowchart` when point is "X calls Y calls Z, look at mess". Prefer `flowchart TD`: wide `LR` graph scrolls sideways in pane. Use `sequenceDiagram` for "before: 6 round-trips; after: 1"; carries no leak or seam marks, so caption names them. Start each diagram with `accTitle` and `accDescr` so screen readers get name.
```

`HTML-REPORT.md:183-185` (start of the flowchart example):

```text
<pre class="mermaid">
flowchart LR
  accTitle: Order intake before
```

`report.html:109-115`:

```text
      .label,
      .caps,
      dt,
      figure h3 {
        font: 600 var(--small) / 1.4 var(--font-display);
        color: var(--text-muted);
      }
```

`report.html:338` and `report.html:347` (the core-sample bands; these are the truth and stay unchanged):

```text
        block-size: max(0.375rem, calc(min(var(--iface), 14) * 0.7rem));
        block-size: max(0.375rem, calc(min(var(--impl), 14) * 0.7rem));
```

`grep -rn "caps" plugins/groundwork` matches only `report.html:110`, so `.caps` has no user.

Conventions: the skill prose is deliberately terse, with articles dropped ("Each band scales at…"). This was a whole-plugin rewrite in commit `bf15c28`. Keep that voice, and do not add articles or "fix" the grammar anywhere. The template is formatted by Prettier with 6-space indentation inside `<style>`.

## Commands you will need

| Purpose      | Command                                                | Expected on success                                                                            |
| ------------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Format check | `npx prettier --check plugins/groundwork`              | `All matched files use Prettier code style!`                                                   |
| Plugin check | `claude plugin validate ./plugins/groundwork --strict` | `✔ Validation passed` (skip if `claude` is not on PATH; an `ICON_MISSING` warning is expected) |
| Full gate    | `npm run check`                                        | exit 0 (see STOP conditions)                                                                   |

The groundwork plugin has no tests of its own; the greps in the steps are the checks.

## Scope

**In scope** (the only files you should modify):

- `plugins/groundwork/skills/improve-codebase-architecture/HTML-REPORT.md`: lines 160 and 184 only.
- `plugins/groundwork/skills/improve-codebase-architecture/report.html`: line 110 only.
- `plans/README.md`: this plan's status row.

**Out of scope** (do NOT touch):

- The `0.7rem` values in `report.html`: the CSS is what renders, so the guide changes to match it, not the other way round.
- The pinned Mermaid import (`mermaid@11.4.1`): pinned by design.
- Any other prose in `HTML-REPORT.md` or `SKILL.md`, including the compressed grammar.
- Plugin versions in `.claude-plugin/plugin.json` and `.antigravity-plugin/plugin.json`: the maintainer bumps them separately, and the two must stay equal.
- `plugins/workbench/`: it has its own `architecture-audit` skill; leave it alone.

## Git workflow

- Branch: `groundwork/plan-030-html-report-drift`.
- One commit, e.g. `docs(groundwork): align HTML report guide with its example and template`. Use the `writeup:commit` skill if available.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Make the flowchart example follow the TD rule

In `HTML-REPORT.md`, change line 184 from `flowchart LR` to `flowchart TD`. Change nothing else in the example: the `linkStyle 2` index counts edges in source order, and direction does not affect it.

**Verify**: `grep -n "flowchart LR" plugins/groundwork/skills/improve-codebase-architecture/HTML-REPORT.md` prints nothing, and `grep -c "^flowchart TD$" plugins/groundwork/skills/improve-codebase-architecture/HTML-REPORT.md` prints `1`.

### Step 2: Match the documented band scale to the CSS

In `HTML-REPORT.md:160`, change `` `0.75rem` `` to `` `0.7rem` ``. Keep the two-space indent at the start of the line.

**Verify**: `grep -c "0.75rem" plugins/groundwork/skills/improve-codebase-architecture/HTML-REPORT.md` prints `0`, and `grep -c "scales at .0.7rem. per count" plugins/groundwork/skills/improve-codebase-architecture/HTML-REPORT.md` prints `1`.

### Step 3: Drop the unused `.caps` selector

In `report.html`, delete line 110 (`      .caps,`). The rule now starts `.label,` then `dt,` then `figure h3 {`.

**Verify**: `grep -rn "caps" plugins/groundwork` prints nothing.

### Step 4: Format and validate

Run the Format check and Plugin check commands from the table.

**Verify**: each gives its expected result. If Prettier reports a file, run `npx prettier --write <that file>` and confirm with `git diff` that it changed only whitespace.

## Test plan

There is no test suite for this plugin's prose. The greps in Steps 1-3 pin each fix. Optionally, open a copy of `report.html` in a browser, paste the flowchart example from `HTML-REPORT.md` into `<main>`, and confirm the graph renders top to bottom with the `PricingClient` edge in red.

## Done criteria

- [ ] `grep -n "flowchart LR" plugins/groundwork/skills/improve-codebase-architecture/HTML-REPORT.md` prints nothing
- [ ] `grep -c "0.75rem" plugins/groundwork/skills/improve-codebase-architecture/HTML-REPORT.md` prints `0`
- [ ] `grep -rn "caps" plugins/groundwork` prints nothing
- [ ] `git diff --stat` lists only `HTML-REPORT.md`, `report.html` and `plans/README.md`, with 2 and 1 changed lines in the two skill files
- [ ] `npx prettier --check plugins/groundwork` exits 0
- [ ] `npm run check` exits 0, or fails only on checks outside `plugins/groundwork` that also fail on `main` at `8b0fefe` (record which in the status row)

## STOP conditions

Stop and report back (do not improvise) if:

- Line 184 of `HTML-REPORT.md` is not `flowchart LR`, or line 160 does not hold `` `0.75rem` ``, or line 110 of `report.html` is not `.caps,`.
- `grep -rn "caps" plugins/groundwork` matches anything other than `report.html:110` before Step 3. Something now uses the class, so it is no longer dead.
- `npm run check` fails on a check inside `plugins/groundwork`.

## Maintenance notes

- When the core-sample CSS in `report.html` changes its scale, update the number in `HTML-REPORT.md:160` in the same commit. Nothing checks the pair automatically.
- Any new example in `HTML-REPORT.md` should obey the rules stated beside it. Agents copy the example before they apply the rule.
- Deferred from the same audit, not planned: `research/SKILL.md:19` and `improve-codebase-architecture/SKILL.md:14` name only `docs/adr/`, though `domain-modeling` supports per-context ADR folders via `GLOSSARY-MAP.md`. The same text also sits in two places (the ADR criteria in `domain-modeling/SKILL.md` and `ADR-FORMAT.md`, the seam rules in `codebase-design/SKILL.md` and `DEEPENING.md`).
