---
name: grilling
description: Grill the user relentlessly to settle every decision only they can make. Use on any 'grill' phrasing, or when a task needs the user own judgement to proceed. Not for facts a source can answer (research), or for a look-and-behavior question a rough artifact settles (prototype).
---

Interview the user relentlessly. Write the decisions to a file as a **map** — one node per decision, each naming what it waits on. Under a caller that already keeps a map, work in that one.

Work the map in **rounds**. The **frontier** is every decision whose prerequisites are already settled. Ask the whole frontier in one round — a round is one user round-trip, and splitting it costs a turn per split for no new information. Then wait for the user's answers before the next round.

Write each question as markdown:

```
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

Where every question in the round is a closed choice of four or fewer short options, ask the round through the **AskUserQuestion** tool instead.

Finding _facts_ is your job — dispatch [research](../research/SKILL.md); put only the _decisions_ to the user. Every question in a round has been checked against the material first. A running dispatch is an unsettled prerequisite, so only the questions downstream of it wait; ask the rest of the frontier now.

Done when every decision on the map is settled, a re-read of the map surfaces no new prerequisites, and the user has confirmed the answers as written. What a caller gets back is the map: every decision with the user's answer on it.
