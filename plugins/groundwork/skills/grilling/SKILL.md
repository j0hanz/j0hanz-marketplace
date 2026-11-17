---
name: grilling
description: Use when the user wants a plan, decision, or idea stress-tested, asks to be grilled or interviewed about it, or uses any 'grill' trigger phrase.
---

Interview user relentlessly until shared understanding. Map as **design tree**: every decision branches into decisions hanging off it.

Work tree in **rounds**. **Frontier** = every decision whose prerequisites already settled: questions askable _now_ without guessing unheard answers. Ask whole frontier in one round: number each question, give recommended answer. Then wait for user answers before next round.

Ask each round via **AskUserQuestion** tool (Copilot: `ask_user`): one question per decision, two to four short options, recommended option first with `(Recommended)` at end of label and reasoning in its `description`. Tool takes four questions per call; send bigger round as consecutive calls.

Use markdown when tool unavailable or question has no short options. Round holding any such question goes whole in markdown; don't split one round across tool and markdown. Format markdown round like so:

```
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>

---

❓ **Q2** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

In markdown, word each question so "yes" accepts recommended answer. Bare "yes" accepts every recommendation in round; user overrides one by its Q-number.

Each answered round reshapes tree: settled decisions push frontier outward, unblock dependent questions. Recompute frontier, ask next round. Question depending on another still-open question in this round belongs to _later_ round, not this one.

Finding _facts_ is your job, never user's: don't ask user for anything you could look up. Quick fact (one file, one search, one command)? Look it up yourself. Longer reading (docs, several sources, unfamiliar code)? Call Skill tool with `groundwork:research` so it reads in background. Don't block: running research = unsettled prerequisite, so only questions downstream of it wait for its report; ask rest of frontier now. _Decisions_ are user's: put each to them, wait.

Decision user can't settle on paper (state model must be felt, layout must be seen)? Offer to answer it with `groundwork:prototype`, then resume tree with verdict.

Session done when frontier empty: every branch of design tree visited, nothing silently assumed. User stops early? Also done; remaining branches stay open.

Close with **decision list**: numbered, one line per settled decision with user's answer, then each open branch marked `open`. User confirms list as written; fix any line they dispute, show it again. Don't act until confirmed. Calling skill works from that list.
