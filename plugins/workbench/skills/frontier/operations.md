# Frontier operations

One session own one map at time, sole writer of that map and every ticket on it.

## Records

**Map** and its **tickets** = records with stable id, title, status, link. Every ticket child of one map. Storage = [Local files](#local-files) unless a [tracker profile](#tracker-profiles) override syntax.

### The map

One per effort, written complete on creation — map has no create-round, so no barrier.

```markdown
---
kind: frontier-map
id: M-01
title: <human-facing map title>
status: open
created: <UTC ISO 8601>
---

## Destination

<what reaching the end of this map looks like. One or two lines; every session orients to it before choosing a ticket.>

## Notes

<domain; skills every session should consult; standing preferences for this effort>

<!-- Omit unless this map carries execution:
### Execution contract

- Scope: <the work task tickets may deliver>
- Completion: <the observable check every delivered task must pass>
- Evidence: <where the check result or artifact is recorded>
-->

## Decisions so far

<!-- one line per closed ticket on the route, title-linked and em-dashed to the answer -->

- [<closed ticket title>](link) — <one-line gist of the answer>

## Not yet specified

<!-- in-scope fog you can't ticket yet; graduates as the frontier advances -->

## Out of scope

<!-- ruled beyond the destination; closed, never graduates -->

## Superseded

<!-- closed tickets a later decision invalidated; link each ticket and its replacement -->

<!-- Omit until the map closes:
## Closure record

<next handoff, plus any execution-contract evidence>
-->
```

### Tickets

```markdown
---
kind: frontier-ticket
id: T-01
title: <human-facing ticket title>
map: M-01
status: initializing # initializing | open | in-progress | closed
type: grilling # grilling | research | prototype | task
priority: 100
blocked_by: []
claimed: # UTC ISO 8601 while in-progress, else empty
---

## Question

<what this ticket resolves — the decision for `grilling`, the fact a decision waits on for `research`, the work plus the decision it unblocks for `task` and `prototype`>

<!-- Priority 100 is the default and needs no line. Any other priority states its
reason here: "Priority 10: the token lifetime gates rotation, library choice, and
key provisioning." -->
```

`research` ticket add one section, above resolution:

```markdown
## Research context

<the decision this research unblocks; exact starting sources or locations; scope and evidence constraints>
```

Answer land later as `## Resolution`. Assets made while resolving live in effort directory's `assets/`, linked from resolution that made them.

## Create a round of tickets

Tickets created in **create-rounds**: charting round, plus one redraw round per resolution. A create-round is a transaction — written, validated, then **committed** in one flip, so the map never carries half a round.

1. **Allocate every id in round up front**, in a fixed order — ascending priority, then alphabetical title — so the id tiebreak in frontier order is deterministic, and so a ticket can name a blocker created after it.
2. **Write each ticket complete** — title, type, priority, question, research context if any, `blocked_by` — status `initializing`, which the frontier query excludes. Blockers written into the ticket itself are what make a crashed round self-describing.
3. **Validate graph**: every blocker exist as child of this map, no ticket block itself, no cycles.
4. **Commit**: flip every ticket in round to `open`.

On map load, recover any `initializing` tickets found, by round:

- **Round fully written** — every ticket in it complete — validate and commit.
- **Round interrupted** — a partially-written ticket, or a graph that fails validation — **roll it back**: close each `initializing` ticket in it, with no resolution and no gist.

## Order the frontier

**Frontier** = every open child ticket whose blockers all closed and no live claim hold. Sort by:

1. `priority`, ascending — lower first;
2. id, ascending.

Every ticket need positive integer priority; backfill a missing or invalid one with `100` before it enter query. Deviate from `100` only with a reason recorded in the ticket, so two agents produce the same order from the same map.

Open, unclaimed tickets with an empty frontier is a **deadlock**: repair missing references, self-blocks, cycles, then rerun query. For a cycle, break the edge from the highest-id ticket.

## Claim a ticket

Claim before any work: set ticket in-progress, stamp claim time. Reread the ticket after claiming — another writer may have updated its Question since you selected it.

Claim = resume marker, not lease. On map load, before frontier query:

- in-progress **decision** ticket = this effort's live ticket — resume it. Release only if user name different one: set `open`, clear `claimed`.
- in-progress **research** ticket returns to `open`, `claimed` cleared, so the ticket re-dispatches on the next fan-out.

## Resolve and redraw

Resolution record answer, evidence behind it, and any **material uncertainty** — a leftover significant enough to reopen, not noise. HITL preserve user's confirmed answer in their terms; AFK carry the citations the subagent returned. Material uncertainty reopen as **new** ticket linking closed one — closed ticket stay closed.

Every closed ticket that published get exactly one linked one-line gist on map, in section its classification name:

| Classification | Resolution also records                                            | Map section      |
| -------------- | ------------------------------------------------------------------ | ---------------- |
| Decided        | —                                                                  | Decisions so far |
| Delivered      | the contract's completion check, its result, and the evidence link | Decisions so far |
| Out of scope   | classification, rationale, evidence                                | Out of scope     |
| Superseded     | rationale, and the replacement ticket                              | Superseded       |

`task` close as **Delivered** only under execution contract, and only once its completion check passed.

Finalize one resolution in this order, so a crash leaves the map behind the tickets rather than ahead of them — the next session's reconcile can repair a missing gist, but cannot invent a resolution for a ticket the redraw already superseded:

1. Record resolution, close ticket.
2. Add its linked gist to section its classification require, creating section if absent.
3. **Redraw**: create the round's new tickets through the barrier above, clear graduated fog from **Not yet specified**, rule newly out-of-scope work out, and read **every open ticket on the map** against this resolution — recording each as unaffected, updated, re-blocked, or superseded. **Update** edits a ticket's Question body only. **Re-block** changes `blocked_by` edges on a published ticket.
4. Evaluate closure gate.

Before finalizing anything, reconcile from a fresh map read: every published closed ticket has exactly one gist, and every gist a closed ticket. Repair map before recording new work.

## Close the map

Close only after fresh read show nothing left to decide before someone go do the thing, every child ticket closed, no ticket left `initializing`, **Not yet specified** empty. Add closure record — next handoff plus any execution-contract evidence — then set map closed.

Name the next executable handoff per [plan](../plan/SKILL.md): [write-specs](../write-specs/SKILL.md) where behavior still need fixing, otherwise [write-plan](../write-plan/SKILL.md). Add a [write-adr](../write-adr/SKILL.md) handoff alongside it for any decision outliving the map. Link the artifact where one already exist — it land beside map, in same effort directory.

## Research dispatch

Dispatch every `research` ticket the frontier query returned, in one fan-out: the query already assert they mutually independent, since dependency between two would be a blocker edge. Dispatch only tickets carrying complete `## Research context`. A `research` ticket on the frontier with incomplete context blocks the fan-out: [grill](../grilling/SKILL.md) to complete its context; if the question turns out to need the user's judgement rather than lookup, convert it to `grilling`; if nothing waits on it any more, close it out of scope.

Parent session claim each ticket before dispatch. Give each subagent map reference, its ticket reference, that context section — [research](../research/SKILL.md) governs what it returns. If a subagent returns an error, empty, or uncitable result, reopen the ticket to `open` (claim cleared), note the failure as a one-line addition to `## Research context`, and re-dispatch on the next frontier pass.

Under a map the fan-out is a barrier: wait for every return, since the redraw needs all of them. Before finalizing a return, open every citation in it and check it matches the claim it supports. Then finalize each ticket (record resolution, close, add its gist) but skip the per-ticket redraw — redraw once after all are finalized, since a redraw between returns can block a ticket a later return would have closed. Requery frontier before the next fan-out.

## Tracker profiles

A repo may override provider syntax with `<repo>/frontier/profiles/<provider>.md` (frontmatter `kind: frontier-profile`, `provider: <id>`), mapping these records onto a real tracker's issues, labels, dependency links — however that tracker is reached, MCP server included. Where that file exists, load it after this one; ordering, claim, resolution, and closure rules above hold regardless.

## Local files

Storage unless a profile override. One **effort directory** under the convention [write-specs](../write-specs/SKILL.md#referencing) defines, shared with every artifact this effort later produce — the map creates it, so its date is the day charting began:

```text
docs/plan/YYYY-MM-DD-<name>/
  <name>.map.md
  tickets/T-01-<slug>.md
  assets/<what it is>
```

Allocate next id by scanning inside effort directory: ticket from `tickets/`, map always `M-01`.

Paths are relative to the file holding the link; the map sits one level above its tickets, so depth differs by one ([depth table](../write-specs/SKILL.md#referencing)):

```markdown
map to ticket [<ticket title>](tickets/T-01-<slug>.md)
ticket to map [<map title>](../<name>.map.md)
ticket to ticket [<other ticket title>](T-05-<slug>.md)
map to sibling [`<name>.spec.md`](<name>.spec.md)
```
