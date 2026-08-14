---
name: frontier
description: 'Frontier: chart work too big for one session as a map of tickets. Use when the way from a loose idea to done is not visible yet, or when resuming an existing map. Not for changes that fit one session (write-plan). Not for widening approaches when none exist yet (ideation).'
---

Loose idea arrive too big for one agent session, wrapped in **fog**: way from here to **destination** not visible yet. Finding that way is the work. This skill chart way as **map** of tickets — each resolve one decision, or one thing a decision wait on — then work them until route clear. Every session take what sit at **frontier**: edge of known, decisions takeable right now.

Load [operations](operations.md) before creating, claiming, resolving, or closing any record; it hold record templates and storage protocol. Load [example](example.md) on the first create-round of a map, and before any redraw. Questioning protocol lives in the `grilling` skill — invoke it wherever this skill says [grill](../grilling/SKILL.md).

## Chart, then hand off

Map done when nothing left to decide before someone go do the thing. Pull to just do the work = signal you hit edge of map — hand off there. One exception: an **execution contract** in the map's Notes names allowed work, its completion check, and where evidence lands; under it, `task` tickets may deliver that work — [operations](operations.md) sets the close rule. Without a contract, every ticket resolves into a decision record.

## The map

Map is an **index**, not store: it gist each decision and link ticket holding detail, so decision live in exactly one place. Call every map and ticket by title in everything human read; title wrap the link, so identity and location ride inside name.

## Tickets

Each ticket is child of map and resolve one sharp decision; its body states what it resolves.

Under a tracker profile, blocking use tracker's native dependency relationship — that render frontier _visually_ in tracker's own UI, so human see what takeable without opening map; under local files, `blocked_by` is a frontmatter scan.

### Record invariants

Hold regardless of storage, and each defies what the moment would otherwise suggest:

- A **published** ticket is never deleted — close it with a resolution.
- **Update** edits a ticket's Question body only, never its id or title: the title is the link, and retitling breaks every existing reference.
- Update and re-block both clear any live claim — the question it was claimed under changed.
- A **create-round** that was interrupted is rolled back, not finished: a ticket that never published never joined the route.
- Open, unclaimed tickets with an empty frontier is not finished work.
- Subagents die with the session that launched them.
- Validate the blocker graph again after every redraw: a redraw can add an edge to an already-published ticket, and an added edge can close a cycle.
- Research subagents are delegates; the parent session writes every record.

## Ticket types

Every ticket is **HITL** — human in loop — or **AFK**, driven by agent alone. HITL ticket resolve only through live exchange: agent ask, then wait for human's own words.

- **grilling** (HITL): [grill](../grilling/SKILL.md) proper, pressing one decision until sharp enough to write down. Default.
- **research** (AFK): read to surface fact decision wait on. Need complete **Research context**; resolved by subagent — [research](../research/SKILL.md).
- **prototype** (HITL): [prototype](../prototype/SKILL.md) — a cheap, rough artifact to react to, when "how should it look / behave" is the key question.
- **task** (HITL or AFK): manual work a _decision_ wait on — signing up for service so its API can be judged, provisioning access, moving data so its shape can be seen. In planning mode it earn its place by unblocking decision; under execution contract it may also deliver work inside that scope. Drive it alone; hand the human a precise checklist at the first step needing a credential, a payment, or a consent click, and resume from there. Its resolution record what was done plus any facts later tickets depend on: credential locations, new URLs, row counts.

A **decision ticket** is any HITL ticket whose resolution is a sharp decision — `grilling`, `prototype`, and HITL `task`. The one-per-session cap in [Work the map](#work-the-map) binds those alone.

## Fog of war

Map is _deliberately_ incomplete: chart only what you already see. Beyond live tickets lie **fog of war** — decisions you can tell are coming but can't pin down, because they hang on questions still open. Resolving ticket clear fog ahead of it, graduating whatever has turned sharp into fresh tickets, until way clear and no tickets remain.

**Not yet specified** is where that dim view get written down: suspected question, area to revisit — in scope, just not sharp enough to ticket.

**Fog or ticket?** Test is whether you can state question precisely now — _not_ whether you can answer it now. A question statable precisely is **sharp** — ticket it, even when blocked and you can't act on it. Keep fog coarser: one patch may graduate into several tickets, or none.

## Beyond the destination

Fog only ever gather _toward_ destination, so destination fix scope and work past it is **out of scope**. Scope, not sharpness, land work there. Out-of-scope work stays closed; it returns as fresh effort only when the destination is redrawn.

When existing ticket turn out to sit past destination — mis-scoped while charting, or exposed by resolution — give it out-of-scope resolution and **close it** (closed ticket unambiguously off frontier). Its gist lands under **Out of scope** alone.

## Chart the map

1. **Name the destination.** [Grill](../grilling/SKILL.md) until user confirm what this map finding its way to.
2. **Map the frontier.** Grill again, **breadth-first**: fan out across the whole space, surfacing open decisions and first steps takeable now. A question waiting on another question is a blocking edge, not a thread — ticket it, wire it, move on. **Done when** one further breadth pass over the destination surfaces no decision not already ticketed or written into fog. **If no fog surface** — way already clear, journey small enough for one session — no map needed. Stop and ask user how they want to proceed.
3. **Create the map** once user confirm destination and frontier read right: every section of the map template present, each filled or explicitly empty.
4. **Create every ticket with a sharp question**, through the create-round barrier in [operations](operations.md). Wiring sorts them into frontier and blocked; whatever still can't be stated sharply stays in fog.
5. **Dispatch takeable research** through research dispatch procedure in [operations](operations.md). **Done when** every research ticket the frontier query returned is either dispatched or flagged deadlocked per operations.
6. **Stop.** Charting is one session's work; resolution is the next session's.

Confirm before stopping — either no fog surfaced, no map created, and user asked how to proceed; or: every ticket published open through the barrier, every sharp question carrying a ticket id, and every patch under **Not yet specified** read once against the sharpness test — a patch either graduated to a ticket id or carries the open question it still waits on.

## Work the map

User invoke with map, optionally naming ticket — without one, you pick next decision, not user. A session resolve **at most one decision ticket**; research repeat freely.

1. Load map and [operations](operations.md), and run its load-time recovery — claims and unpublished rounds — before querying frontier. Ticket bodies zoom in later, on demand.
2. **Choose.** If user named ticket, verify it open, unblocked, and unclaimed; if not, surface why and [grill](../grilling/SKILL.md) before selecting another. Otherwise take the first ticket in frontier order. If the frontier is empty yet **Not yet specified** is non-empty, grill the first patch in document order directly into a ticket — fog clears only through ticket resolution, and an empty frontier with fog still hanging is a stuck map, not a finished one.
3. **Clear the research first.** Fan out every `research` ticket on the frontier and finalize returns under [operations](operations.md); the redraw may surface more — repeat until none remain on the frontier, then return to step 2. Each return can change which decision is takeable, so the choice is only valid against a frontier with no research left on it.
4. **Claim the decision ticket and resolve it.** Before putting an answer to the user, open every ticket named in its `blocked_by`, every gist in **Decisions so far** touching its question, and every skill the map's **Notes** name. If in doubt, [grill](../grilling/SKILL.md). HITL end when user confirm answer as written.
5. **Finalize and redraw** under [operations](operations.md).
6. **Close the map** when its gate permit ([operations](operations.md)); else stop, and next session take frontier from here.

Confirm redraw before finishing: every patch removed from **Not yet specified** maps to a new ticket id or an explicit out-of-scope ruling in the round (not merely declared sharp); anything the answer put past destination ruled out of scope rather than resolved on route; every open ticket on the map read against this resolution and recorded as unaffected, updated, re-blocked, or superseded; every open unclaimed ticket reachable from the frontier query.
