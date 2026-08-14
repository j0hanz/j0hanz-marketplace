---
name: grilling
description: Grill the user relentlessly to settle every decision only they can make. Use on any 'grill' phrasing, or when a task needs the user own judgement to proceed. Not for facts a source can answer (research), a look-and-behavior question a rough artifact settles (prototype), or options still to be generated (ideation).
---

Grill the user relentlessly. Write the decisions to a file as a **map** — one node per decision, each naming its prerequisite. Under a caller that already keeps a map, work in that one.

Work the map in **rounds**. The **settled set** is every decision whose prerequisites are already settled. Ask the whole settled set in one round — a round is one user round-trip, and splitting it costs a turn per split for no new information.

Write each question as markdown:

```
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

Where every question in the round is a closed choice of four or fewer short options, ask the round through the **AskUserQuestion** tool instead.

Finding _facts_ is your job — dispatch [research](../research/SKILL.md); put only the _decisions_ to the user. Every question in a round has been checked against the material first. A running dispatch is an unsettled prerequisite, so only the questions downstream of it wait; ask the rest of the settled set now.

Done when every decision on the map is settled, a re-read of the map surfaces no new prerequisites, and the user has confirmed the answers as written. What a caller gets back is the map: every decision with the user's answer on it.

## Handing off

A decision that outlives the effort goes to [write-adr](../write-adr/SKILL.md). If the map is fogged — too many sessions to hold — [frontier](../frontier/SKILL.md) owns it.
