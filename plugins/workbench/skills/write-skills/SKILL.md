---
name: write-skills
description: Author a new skill or audit an existing one — frontmatter, trigger description, and body. Use when asked to write, add, fix, or audit a skill, when a skill never fires, or when it fires at the wrong moment. Not for the hook handler and its registration block (write-hooks), or the plugin manifest and marketplace catalog around them.
---

Every lever in this skill serves one goal: **predictability**.

Each bold term has its own heading in [`GLOSSARY.md`](GLOSSARY.md). Load it on every audit, and while writing whenever a bold term below is unclear. When given a term as an argument, answer from that entry alone.

## Invocation

Both choices keep the `description` field, because the format requires it. Exposure is the switch:

- **Model-invoked** — omit `disable-model-invocation` and write a model-facing description that carries the trigger branches (the pointer rules below apply in full). The agent fires it on its own, other skills can reach it, and you can still type its name. You pay **context load** on every turn.
- **User-invoked** — set `disable-model-invocation: true`; the `description` becomes human-facing, a one-line summary with the trigger lists stripped. It costs zero context load and spends **cognitive load** instead: you are the index and must remember that it exists.

Pick model-invocation only when the agent must reach the skill on its own, or another skill must. A skill fired only by hand is user-invoked and pays no context load.

A user-invoked skill exposes nothing, so two things follow:

- When user-invoked skills multiply past what you can remember, the cure is a **router skill**: one user-invoked skill that names the others and says when to reach for each. It can only hint.
- Reference that two user-invoked skills both need can live in neither. Push it to an **external reference**: a plain file outside the skill system that any skill can point at. (A model-invoked skill made entirely of reference can host shared reference itself, since another skill can invoke it.)

_Gotcha_: frontmatter must parse as strict YAML. Wrap a `description` that contains `: ` in single quotes, doubling any `'` inside. Unquoted, Claude Code still loads the skill, but Copilot CLI silently drops it.

## Writing pointers

The **description** is a **context pointer**, and the same rules govern a link to a disclosed file one level down. Must-have material behind a weakly worded pointer is a variance bug: sharpen the wording first, and inline the material only if sharpening fails.

A pointer does two jobs: it states what the material is, and it lists the **branches** that should trigger reaching it. An always-loaded pointer costs something every turn, so it must earn harder pruning than the body:

- _Front-load the leading word_ — put it where it does the triggering work.
- _One trigger per branch._ Renaming a single branch with synonyms is **duplication** — "build features using TDD … asks for test-first development" is one branch written twice. Collapse them and keep only genuinely distinct branches.
- _Draw the boundary._ Where a neighbouring skill could hijack this one or be hijacked by it, a "not for X" clause is triage between skills, not **negation**, and earns its place.
- _Cut identity the body already carries._
- _Name the material; spend the rest on branches._ A pointer that summarises the steps behind it gets acted on in place of the material, so one clause says what the material is and every other word lists a branch.

## Information hierarchy

A skill is built from two content types — **steps** and **reference** — which mix freely: all steps, all reference, or both. The core decision is which to use and where each sits on the **information hierarchy**, a ladder ranked by how immediately the agent needs the material:

1. **Steps**, in-file — the primary tier: what the agent does, in order.
2. **Reference**, in-file — consulted on demand. _This skill is all reference._
3. **Reference**, disclosed — moved out of `SKILL.md`, reached by a **context pointer**, and loaded only when the pointer fires. It ranges from a sibling file in the skill folder (`GLOSSARY.md` here) to an **external reference** living outside the skill system.

Push too little down and the top bloats; push too much and you hide material the agent actually needs. That tension is the whole decision.

Each step ends on a **completion criterion**. Make it _checkable_ (can the agent tell done from not-done?) and, where it matters, _exhaustive_ ("every modified model accounted for", not "produce a change list"). A vague criterion invites **premature completion**; a demanding one drives **legwork**. Demand binds flat reference the same way ("every rule applied"), so a skill with no steps still carries an exhaustiveness bar.

Two boundaries hold the top rung. A sequence the task doesn't need is **over-prescription**: where several approaches are valid, state the target and the constraint, say _why_ the rule matters so the agent can generalise it, and let it pick its own path. A sequence too fragile for prose belongs in a **script**.

**Progressive disclosure** moves material down the ladder — out of `SKILL.md` into a linked file — so the top stays legible. The mechanics: a linked `.md` in the skill folder, named for what it holds (this skill discloses its definitions to `GLOSSARY.md`). The **branch** is the cleanest disclosure test: inline what every branch needs, and push behind a pointer what only some branches reach. One class of reference resists disclosure — the _gotcha_, a fact that defies what the agent would otherwise assume — and stays inline: the agent can't recognise the moment it would need to load it, so a pointer to a surprise never fires.

Where the ladder decides _how far down_ a piece sits, **co-location** decides _what sits beside it_ once it is there: keep a concept's definition, rules, and caveats under one heading rather than scattered, so reading one part brings its neighbours with it.

Give an output format as a template to fill rather than prose describing it — the agent pattern-matches a concrete structure more reliably than a description of one.

## When to split

**Granularity** is how finely you divide skills. Each cut spends one of two loads, so split only when the cut earns it. There are two cuts:

- _By invocation_ — split off a **model-invoked** skill when it has a distinct **leading word** that should trigger it on its own (a word you actually use in prompts), or when another skill must reach it. You pay **context load** for the new always-loaded **description**, so the independent reach has to be worth it.
- _By sequence_ — split a run of **steps** when the steps still ahead (**post-completion steps**) tempt the agent to rush the one in front. Keeping them out of view encourages more **legwork** on the current task. The reverse holds too: merging sequences exposes each step's post-completion steps to what follows.

Splitting hides steps only across a real context boundary — a user-invoked hand-off or a subagent dispatch. An inline model-invoked call leaves the later steps in context and clears nothing.

Both cuts answer to coherence: one unit of work per skill. Cut too fine, and several skills must co-load for a single task — descriptions crowd and instructions collide. Cut too broad, and no description can trigger the skill precisely.

## Pruning

Check every line for relevance.

Then hunt **no-ops** sentence by sentence, not just line by line: run the no-op test on each sentence in isolation, and when one fails, delete the whole sentence rather than trimming words. Be aggressive — most prose that fails should go, not get rewritten. The test is model-relative: two people who disagree about a no-op disagree about the default, so settle it by running the skill, not by debate.

Cut every **cache** line whose lookup is cheap.

## Leading words

Hunt for chances to refactor skills to use leading words. A triad spelled out at three sites (**duplication**), or a description spending a sentence to gesture at one idea — each such passage begs to collapse into a single token. Examples:

- "fast, deterministic, low-overhead" -> _tight_ — one quality restated across a phrase, collapsed into a single pretrained word (a _tight_ loop).
- "a loop you believe in" -> _red_ — a fuzzy gate converted into a binary observable state (the loop goes _red_ on the bug, or it doesn't).

This wins twice over: fewer tokens, _and_ a sharper hook for the agent to hang its thinking on. Assume every skill carries restatements that leading words can retire — go find them.

## Failure modes

Symptom, then cure:

- **Premature completion** — a step ends before it is genuinely done, because attention slips to _being done_. Sharpen the completion criterion first (cheap, local); only if it is irreducibly fuzzy _and_ the rush is observed, hide the post-completion steps by splitting.
- **Over-prescription** — the agent can't adapt when reality differs from the steps. State the target and the constraint instead; move a genuinely fragile sequence into a **script**, leaving a step that says "run it".
- **Duplication** — you edit one place, and the behaviour survives in another. Fold it to a single source of truth.
- **Sediment** — you have to core through stale lines to reach the live one. Prune on a schedule, not on suspicion.
- **Sprawl** — past ~500 lines or ~5k tokens, a `SKILL.md` has sprawled by definition, even when every line is live and unique. Disclose **reference** behind pointers; split by **branch** or by sequence so each path carries only what it needs.
- **No-op** — a line that changes nothing versus the default. Delete the whole sentence. A weak leading word (_be thorough_ when the agent is already thorough-ish) is a no-op; fix it with a stronger word (_relentless_), not a different technique.
- **Menu** — different runs pick different options at the same fork, and predictability dies there. Name one default; demote the rest to escape hatches, each with the condition that earns it ("use X; for scanned input, fall back to Y").
- **Negation** — banned behaviour turns up more, not less: _don't think of an elephant_ names the elephant. Prompt _positive_ — state the target behaviour so the banned one is never spoken. Keep a prohibition only as a hard guardrail you can't phrase positively, and even then pair it with what to do instead.

Done when every lever above has been applied — invocation picked, every pointer sharpened, the hierarchy placed, every completion criterion checkable, every output format given as a template, the split decided, every line relevance-checked, no-ops hunted sentence by sentence, every cheap-lookup cache line cut, leading words coined, and every failure mode confirmed absent. The bar binds the whole body, not a subset of sections.
