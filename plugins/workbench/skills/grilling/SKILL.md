---
name: grilling
description: Grill the user on every decision only they can make. Use when asked to grill, or when a task needs the user's own judgement. Not for facts a source can answer (research) or options not yet generated (ideation).
---

Grill the user relentlessly. Write the decisions to a **map** — one node per decision, each naming its prerequisite — at `docs/plan/YYYY-MM-DD-<name>/<name>.map.md`, in the per-change directory [write-specs](../write-specs/SKILL.md#referencing) defines. Where the change already has that directory, the map goes in it.

Under [frontier](../frontier/SKILL.md), write no map and no record of your own: frontier's map and tickets hold every decision, and frontier writes them through its own operations. Hand back each confirmed answer, and each new prerequisite as a sharp question.

Work the map in **rounds**. A decision is **settled** once the user has answered it. The **frontier** is every unsettled decision whose prerequisites are all settled. Ask the whole frontier in one round — a round is one user round-trip, and splitting it costs a turn per split for no new information.

Write each question as markdown:

```
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

Where the round holds four or fewer questions, each a closed choice of two to four short options, ask it through the **AskUserQuestion** tool (Copilot: `ask_user`) instead — four questions per call is the tool's limit. Put your recommended option first and end its label with `(Recommended)`; the tool has no slot for the ➡️ line. A larger round stays markdown.

Finding _facts_ is your job — dispatch [research](../research/SKILL.md); put only the _decisions_ to the user. Every question in a round has been checked against the material first. A running dispatch is an unsettled prerequisite, so only the questions downstream of it wait; ask the rest of the frontier now.

Done when every decision on the map is settled, a re-read of the map surfaces no new prerequisites, and the user has confirmed the answers as written. What a caller gets back is the map: every decision with the user's answer on it — under frontier, the answers and new prerequisites handed back.

## Handing off

A decision that outlives the effort goes to [write-adr](../write-adr/SKILL.md). If the map is fogged — too many sessions to hold — [frontier](../frontier/SKILL.md) owns it.
