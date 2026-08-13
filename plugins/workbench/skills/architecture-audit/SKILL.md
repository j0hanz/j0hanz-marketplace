---
name: architecture-audit
description: Rank a repo's structural debt by churn. Not for a diff's structure (qc), readability (clean-code), correctness (bug-hunt), or an effort already scoped (frontier). Route from plan when unsure.
disable-model-invocation: true
---

# Architecture Audit

Whole repo, read-only, upstream of the chain.

## Steps

### 1. Bound it

- **Zones** — the units the repo already declares: workspace packages, apps, top-level source directories, whatever the manifests and entry points name. Take the repo's own division. Inventing a better one is a finding, not a method.
- **Churn** — `git log --since=1.year --format= --name-only | sort | uniq -c | sort -rn | head -40`, rolled up per zone. The count is the point; the pipe is whatever your shell spells.
- **Excluded** — generated trees, vendored dependencies, and applied migrations carry no architecture to audit. Name them once here and they stay named.

**Done when** every zone sits on the map with a churn count, and every excluded tree is named with the reason that excluded it.

### 2. Probe

Fan out [research](../research/SKILL.md) in directory mode, one dispatch per zone, its question being which of the [shapes](#shapes) appear and where. A zone too big for one read splits by subdirectory before it gets skimmed.

Direction is the one thing a probe cannot see: a cycle between two zones is invisible from inside either. Walk the cross-zone imports yourself. Ownerless concept is cross-zone the same way — a probe flags local duplication, but only the merge in step 3 can confirm no owner elsewhere.

Probes return candidates, never rankings.

**Done when** every zone carries a probe return or a written skip, every cross-zone import edge has a direction recorded, and every candidate cites a `file:line` a probe actually opened.

### 3. Price, then rank

Give each candidate the restructure that takes it out, against [the bar](#the-bar). A candidate whose only move fails the bar is dropped here — save the gate-4 case, which [the bar](#the-bar) routes to write-adr rather than drops. Reporting a dropped one anyway leaves a complaint where a finding was promised.

Merge before ranking: the same tangle seen from two zones is one finding.

Then order by what the move buys against the churn it disturbs. Strict order, no ties, no tiers — a list where three things are "high priority" is the list you already had.

**Done when** every surviving finding carries a move that clears all four gates of [the bar](#the-bar), a file count for its blast radius, and a position no other finding shares.

### 4. Report

Chat is the deliverable. Follow [the report](#the-report).

**Done when** the table reads in one screen, every finding below it carries its sketch and its `file:line` evidence, and Coverage names every zone that went unread.

## Shapes

Four, each with the check that settles it.

**Middleman** — a hop you pay to cross that hands back nothing. _Check_: delete it in your head and put its body at the call sites. If nothing reappears — no rule duplicated, no caller newly forced to know something — the boundary was holding air. A chain of them is the acute form: three hops to reach the one line doing work.

**Pool** — one module absorbing change that belongs to several. _Check_: read the commits touching it and group them by what they were for.

**Ownerless concept** — a rule the domain has and the code does not: the same validation, rounding, or status transition written at N call sites, no module whose name it is. _Check_: grep the vocabulary the concept travels under — its constant, its magic string, its regex — and count the files that know it. Knowledge living in more than two places has no owner. The move is often not a new module; one caller usually half-owns it already.

**Wrong direction** — an import running against the repo's own gradient: a low module reaching up, a cycle between zones, or a caller reaching past a package's front door into its internals. _Check_: the edge itself, then the door. `import x/internal/y` where `import x` exists names a boundary that is not real.

## The bar

A move reaches the report by clearing all four.

- **Net deletion** — it takes out more than it puts in. A move whose product is a new layer is next year's finding.
- **Two, or it is not a seam** — propose a boundary only where something already varies twice; production plus a test counts as two.
- **Churn, or it does not ship** — code nobody touches earns no restructure.
- **Recorded decisions outrank the audit** — read `docs/adr/` before calling a boundary wrong. Where the friction is real regardless, the finding is a decision to reopen ([write-adr](../write-adr/SKILL.md)), not a defect.

## The report

Open with the whole shape in one table, rank order:

| #   | Finding | Zone | Move | Files |
| :-- | :------ | :--- | :--- | :---- |

Then one section per finding, same order, each carrying:

- what is there now, cited at `file:line`
- the move, in one sentence
- the size of the move — single build, or a process, network, or third-party contract it crosses
- the shape before and the shape after, as a sketch — the arrows are the whole content, six lines a side at most

  ```text
  before                          after
   api      ──► rounds it          api      ──┐
   jobs     ──► rounds it          jobs     ──┼──► money.total()
   checkout ──► rounds it          checkout ──┘
   (rule in three places)          (rule in one)
  ```

- its cost — files touched, what sits broken while it lands — and what it stops costing
- for the top finding alone, the move you rejected and why.

Close with **Coverage**: zones read, zones skipped with why, and anything taken from a manifest rather than opened.

## Handing off

Where it goes depends on how much of the list gets taken.

| What the list turns into                     | Goes to                              |
| :------------------------------------------- | :----------------------------------- |
| One finding, worth doing now                 | [write-plan](../write-plan/SKILL.md) |
| Several, spanning sessions                   | [frontier](../frontier/SKILL.md)     |
| A boundary that turns out to be a decision   | [write-adr](../write-adr/SKILL.md)   |
| A move whose shape is still an open question | [grilling](../grilling/SKILL.md)     |
