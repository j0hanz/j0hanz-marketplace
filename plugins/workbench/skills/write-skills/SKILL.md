---
name: write-skills
description: Use when creating new skills, auditing existing skills, or reviewing skill system for coherence.
---

Skill exists to wrangle determinism out of stochastic system. **Predictability** root virtue; every lever below serve it.

Bold terms each have heading in [`GLOSSARY.md`](GLOSSARY.md). Load it when auditing skill against full vocabulary, or when term below carry more weight than you can place. Given term as argument, answer from that entry alone.

## Invocation

Both choices keep `description` field — format require it. Exposure is switch:

- **Model-invoked** — omit `disable-model-invocation`; write model-facing description carrying trigger branches (pointer rules below apply in full). Agent fire it autonomous, other skills reach it, you still type name. Pay **context load** every turn.
- **User-invoked** — set `disable-model-invocation: true`; `description` become human-facing, one-line summary, trigger lists stripped. Zero context load, spend **cognitive load**: you are index must remember it exist.

Pick model-invocation only when agent must reach skill on own, or another skill must. Fire only by hand: user-invoked, pay no context load.

User-invoked skill expose nothing, so two things follow:

- Multiply past what you remember, cure is **router skill** — one user-invoked skill names others, when reach each. Hint only.
- Reference two user-invoked skills both need can live in neither. Push to **external reference**: plain file outside skill system, any skill point at. (Model-invoked all-reference skill host shared reference itself, since another skill can invoke it.)

## Writing pointers

**Description** is **context pointer** — same rules govern link to disclosed file, one level down. Must-have material behind weakly worded pointer is variance bug: sharpen wording first, inline material only if sharpening fail.

Pointer do two job — state what material is, list **branches** should trigger reaching it. Always-loaded pointer cost every turn, so earn harder pruning than body:

- _Front-load the leading word_ — pointer where it do triggering work.
- _One trigger per branch._ Synonym renaming single branch = **duplication** — "build features using TDD … asks for test-first development" one branch written twice. Collapse them; keep only genuine distinct branches.
- _Draw the boundary._ Where neighbour skill could hijack or get hijacked, "not for X" clause is triage between skills, not **negation** — earns its place.
- _Cut identity body already carry._

## Information hierarchy

Skill built from two content type — **steps** and **reference** — mix freely: all steps, all reference, or both. Core decision: which use, where each sit on **information hierarchy**, ladder ranked by how immediate agent need material:

1. **Steps**, in-file — primary tier: what agent do, in order.
2. **Reference**, in-file — consult on demand. Often legit flat peer-set (every rule of review on one rung), fine arrangement, not smell. _This skill all reference._
3. **Reference**, disclosed — out of `SKILL.md`, reached by **context pointer**, load only when pointer fire. Span sibling file in skill folder (`GLOSSARY.md` here) through **external reference** living outside skill system.

Push too little down, top bloat; push too much, hide material agent actually need. That tension whole decision.

Each step end on **completion criterion**. Make it _checkable_ (agent tell done from not-done?) and, where matter, _exhaustive_ ("every modified model accounted for", not "produce a change list") — vague criterion invite **premature completion**, demanding one drive **legwork**. Demand bind flat reference same way ("every rule applied"), so skill with no steps still carry exhaustiveness bar.

Two boundary hold top rung. Sequence task don't need = **over-prescription**: where several approach valid, state target and constraint, say _why_ rule matter so agent generalise it, let it pick own path. Sequence too fragile for prose belong in **script**.

**Progressive disclosure** move down ladder — out of `SKILL.md` into linked file — so top stay legible. Mechanics: linked `.md` in skill folder, named for what it hold (this skill disclose definitions to `GLOSSARY.md`). **Branch** is cleanest disclosure test: inline what every branch need, push behind pointer what only some branches reach. One class of reference resist disclosure — _gotcha_, fact defy what agent would otherwise assume, stay inline: agent can't recognise moment it would need load it, so pointer to surprise never fire.

Where ladder decide _how far down_ piece sit, **co-location** decide _what sit beside it_ once there: keep concept's definition, rules, caveats under one heading rather than scattered, so reading one part bring neighbours with it.

## When to split

**Granularity** how finely divide skills, each cut spend one of two loads, split only when cut earn it. Two cuts:

- _By invocation_ — split off **model-invoked** skill when have distinct **leading word** should trigger it on own (word you actually use in prompts), or another skill must reach it. Pay **context load** for new always-loaded **description**, so independent reach has to be worth it.
- _By sequence_ — split run of **steps** when steps still ahead (**post-completion steps**) tempt agent rush one in front. Out of view encourage more **legwork** on current task. Reverse hold too: merging sequences expose each step's post-completion steps to what follows.

Splitting hide steps only across real context boundary — user-invoked hand-off, subagent dispatch. Inline model-invoked call leave later steps in context, clear nothing.

Both cuts answer to coherence: one unit of work per skill. Cut too fine, several skills must co-load for single task — descriptions crowd, instructions collide; cut too broad, no description can trigger it precisely.

## Pruning

Keep each meaning in **single source of truth**: one authoritative place, so changing behaviour one-place edit.

Environment source of truth too — `package.json` scripts, config files, directory layout, `--help` output. Skill restating it is **cache**. Cache what agent can't find by looking: unwritten convention, reason behind choice, gotcha no config confess. Leave one-file, one-command lookup to environment, where it can't go stale.

Check every line for **relevance**: still bear on what skill do?

Then hunt **no-ops** sentence by sentence, not just line by line: run no-op test on each sentence in isolation; when one fail, delete whole sentence rather than trim words. Be aggressive — most prose that fail should go, not get rewritten. Test model-relative: two people disagreeing about no-op disagree about default, settle by running skill, not by debate.

## Leading words

**Leading word** compact concept already living in model's pretraining agent think with while running skill (e.g. _lesson_, _fog of war_, _tracer bullets_). Repeat as token, never as sentence — accumulate distributed definition, anchor whole region of behaviour in fewest tokens by recruiting priors model already hold. Coin own only when you define it clearly: made-up word recruit no priors, you pay in definition tokens what pretrained word give free.

Serve predictability twice. In body anchor _execution_: agent reach for same behaviour every time word appear. In pointer anchor _invocation_: when same word live in your prompts, docs, code, agent link shared language to skill, fire it more reliable.

Hunt opportunity refactor skills use leading words. Triad spelled out at three sites (**duplication**), description spending sentence gesture at one idea — each passage beg collapse into single token. Examples include:

- "fast, deterministic, low-overhead" -> _tight_ — one quality restated across phase, into single pretrained word (_tight_ loop).
- "a loop you believe in" -> _red_ — convert fuzzy gate into binary observable state (loop go _red_ on bug, or don't).

Win twice over: fewer tokens, _and_ sharper hook for agent hang thinking on. Assume every skill carry restatements leading words retire — go find them.

## Failure modes

Symptom, then cure:

- **Premature completion** — step end before genuine done, attention slip to _being done_. Sharpen completion criterion first (cheap, local); only if irreducibly fuzzy _and_ rush observed, hide post-completion steps by splitting.
- **Over-prescription** — agent can't adapt when reality differ from steps. State target and constraint instead; genuinely fragile sequence into **script**, step remaining "run it".
- **Duplication** — edit one place, behaviour survive in another. Fold to single source of truth.
- **Sediment** — you core through stale lines to reach live one. Prune on schedule, not on suspicion.
- **Sprawl** — past ~500 lines or ~5k tokens, `SKILL.md` sprawled by definition, even when every line live and unique. Disclose **reference** behind pointers; split by **branch** or sequence so each path carry only what need.
- **No-op** — line change nothing versus default. Delete whole sentence. Weak leading word (_be thorough_ when agent already thorough-ish) is no-op; fix stronger word (_relentless_), not different technique.
- **Menu** — different run pick different option at same fork, predictability die there. Name one default; demote rest to escape hatches, each with condition earning it ("use X; for scanned input, fall back to Y").
- **Negation** — banned behaviour turn up more, not less: _don't think of an elephant_ names elephant. Prompt _positive_ — state target behaviour so banned one never spoken. Keep prohibition only as hard guardrail can't phrase positive, even then pair with what do instead.
