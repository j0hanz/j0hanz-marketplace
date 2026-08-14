---
name: ideation
description: Ideate the soft problem — widen to a **field** of candidate approaches, then cull to the ones nothing kills. Use when no options are on the table yet, or when a lone approach has never faced a rival. Not for picking among options already on the table (grilling), facts a source settles (research), or a look-and-behavior question a spike settles (prototype).
---

# Ideation

Widen, then cull. Generate a **field** of candidate approaches wider than the problem looks to have, then kill every one something already rules out. What comes out is the **live set** — survivors, each carrying the one thing that would end it.

Ideation makes the options and stops. Putting a fork to the user is [grilling](../grilling/SKILL.md), and one skill doing both fires as whichever the phrasing happens to favour.

## Steps

### 1. Widen past the default

The first approaches out are the **default** — what the problem's own vocabulary suggests, and what any agent produces cold. They are the bar the field has to beat, not entries in it.

Run all four generators; each cuts on an axis the others cannot reach:

- **Drop a constraint** — take what everyone assumes fixed (the database, the framework, the deadline, the budget) and build as if it were not.
- **Move the seam** — same behavior, cut elsewhere: build time against run time, client against server, one shared place against every caller.
- **Invert** — delete instead of add, push the work to the caller instead of the callee, make the bad state unrepresentable instead of handled.
- **Steal** — something in this repo, or a system in the world, already solves this shape. Name it and port the shape, not the code.

**Done when** every generator has been run and the field holds at least one candidate the default did not produce.

### 2. Cull to the live set

Give every candidate its **killer**: the single thing that, if true, ends it. A drawback shrinks a candidate; a killer removes it. Then fire or route each killer by what it waits on:

- **Known true right now** — the candidate is killed.
- **A fact** — the candidate waits on a [research](../research/SKILL.md) dispatch that reads while you cull the rest; its killer fires or clears when the report lands.
- **A preference** — the candidate stays live; that preference is the user's to state.

A killed candidate stays on the page with what killed it. Delete it and the next session generates it again, unkilled.

Two candidates one killer takes out are **twins** — one bet written twice. Keep the sharper one; the other was never a second option. Twins differing only in how they look or feel are the exception, and both survive: a human's eye separates what no killer can.

**Done when** every candidate carries a killer, every killer is fired or routed, every dispatch has returned, and no two survivors are twins.

### 3. Hand the live set over

The live set is written under the decision it answers — the map node in [grilling](../grilling/SKILL.md), or the ticket that raised it under [frontier](../frontier/SKILL.md). With neither open, it becomes the first node of the map grilling opens next. Say which survivor you would take and why. Each survivor goes on the page with its killer and its cost — what taking it would give up.

- **One survivor** — nothing left to decide; its behavior goes to [write-specs](../write-specs/SKILL.md).
- **Two or more** — [grilling](../grilling/SKILL.md) puts them to the user as one round.
- **Survivors differing only in how they look or feel** — [prototype](../prototype/SKILL.md); no argument settles that.
- **None** — widen once more, against the constraint that killed them all. Still none, and the problem as stated has no way through: report that constraint and stop.

**Done when** the next skill is named and every survivor is on the page with its killer and what it costs — or, with no survivors after the second widen, the blocking constraint is reported in their place.

## What ideation declines

The design document. Ideation ends on a set, never on prose that reads as settled: behavior goes to [write-specs](../write-specs/SKILL.md), a decision outliving the effort to [write-adr](../write-adr/SKILL.md), the route to [write-plan](../write-plan/SKILL.md).
