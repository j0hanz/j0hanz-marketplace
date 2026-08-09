---
name: writing-skills
description: Reference for writing and editing skills well — the vocabulary and principles that make a skill predictable.
disable-model-invocation: true
argument-hint: '[term]'
---

A skill exists wrangle determinism out of stochastic system. **Predictability** — agent take same _process_ every run, not same output — root virtue; every lever below serve it.

**Bold terms** defined in [`GLOSSARY.md`](GLOSSARY.md); look up there for full meaning.

## Invocation

Two choice, trade different cost:

- A **model-invoked** skill keep **description**, so agent fire it autonomous _and_ other skills reach it (can still type name too). Contribute **context load** — description sit in window every turn. Mechanics: omit `disable-model-invocation`, write model-facing description with rich trigger phrasing ("Use when the user wants…, mentions…").
- A **user-invoked** skill strip description from agent reach: only you, typing name, invoke it — no other skill can. Zero context load, but spend **cognitive load**: _you_ are index must remember it exist. Mechanics: set `disable-model-invocation: true`; `description` become human-facing — one-line summary, trigger lists stripped.

Pick model-invocation only when agent must reach skill on own, or another skill must. If only ever fire by hand, make user-invoked, pay no context load.

When user-invoked skills multiply past what you remember, piled-up cognitive load cured by **router skill**: one user-invoked skill names others, when reach for each.

## Writing the description

Model-invoked **description** do two job — state what skill is, list **branches** should trigger it. Every word increase **context load**, so description earn even harder pruning than body:

- **Front-load skill's leading word** — description where it do invocation work.
- **One trigger per branch.** Synonym renaming single branch = **duplication** — "build features using TDD … asks for test-first development" one branch written twice. Collapse them; keep only genuine distinct branches.
- **Draw the boundary.** Where neighbour skill could hijack or get hijacked, "not for X" clause is triage between skills, not **negation** — earns its place.
- **Cut identity already in body.** Keep description to triggers, plus any "when another skill needs…" reach clause.

## Information hierarchy

Skill built from two content type — **steps** and **reference** — mix freely: skill can be all steps, all reference, or both. Core decision: which use, where each sit on **information hierarchy**, ladder ranked by how immediate agent need material:

1. **In-skill step** — ordered action in `SKILL.md`, primary tier: what agent do, in order. Each step end on **completion criterion**, condition tell agent work done. Make it _checkable_ (agent tell done from not-done?) and, where matter, _exhaustive_ ("every modified model accounted for", not "produce a change list") — vague criterion invite **premature completion**.
2. **In-skill reference** — definition, rule, or fact in `SKILL.md`, consult on demand. Often legit flat peer-set (every rule of review on one rung) — fine arrangement, not smell. _This skill all reference._
3. **External reference** — reference pushed out of `SKILL.md` into separate file, reached by **context pointer**, load only when pointer fire. (Span _disclosed_ reference — sibling file like `GLOSSARY.md`, still part of skill — through fully **external reference** living outside skill system, any skill can point at.)

Two boundary police top rung. Sequence task don't need = **over-prescription** — where several approach valid, state target and constraint, let agent pick own path. Sequence too fragile for prose belong in **script**: bundled code run identical every run, step remaining "run it".

Demanding completion criterion drive thorough **legwork** — digging agent do within work — whether skill has steps or not, since "every rule applied" bind flat reference just as "every step done" bind sequence.

Push too little down, top bloat; push too much, hide material agent actually need. That tension whole decision.

**Progressive disclosure** move down ladder — out of `SKILL.md` into linked file — top stay legible. Mechanics: linked `.md` file in skill folder, named for what it hold (this skill discloses full definitions to `GLOSSARY.md`). Some skills used more than one way, each distinct way **branch** — different runs take different paths through skill. Branching cleanest disclosure test: inline what every branch need, push behind pointer what only some branches reach. One class of reference resist disclosure: _gotcha_ — fact defy what agent would otherwise assume — stay inline, agent can't recognise moment would need load it. **Context pointer**'s _wording_, not target, decide when and how reliably agent reach material.

Where ladder decide _how far down_ piece sit, **co-location** decide _what sit beside it_ once there: keep concept's definition, rules, caveats under one heading rather than scattered, so reading one part bring neighbours with it.

## When to split

**Granularity** how finely divide skills, each cut spend one of two loads, split only when cut earn it. Two cuts:

- **By invocation** — split off **model-invoked** skill when have distinct **leading word** should trigger it on own, or another skill must reach it. Pay **context load** for new always-loaded **description**, so independent reach has to be worth it.
- **By sequence** — split run of **steps** when steps still ahead (step's **post-completion steps**) tempt agent rush one in front (**premature completion**). Keep out of view encourage agent do more **legwork** on current task.

Both cuts answer to coherence: one unit of work per skill. Cut too fine, several skills must co-load for single task — descriptions crowd, instructions collide; cut too broad, no description can trigger it precisely.

## Pruning

Keep each meaning in **single source of truth**: one authoritative place, so changing behaviour one-place edit.

Check every line for **relevance**: still bear on what skill do?

Then hunt **no-ops** sentence by sentence, not just line by line: run no-op test on each sentence isolation, when one fail, delete whole sentence rather than trim words. Be aggressive — most prose that fail should go, not get rewritten.

## Leading words

**Leading word** compact concept already living in model's pretraining agent think with while running skill (e.g. _lesson_, _fog of war_, _tracer bullets_). Repeat throughout text (though not necessary - strong leading word might need only once), accumulate distributed definition, anchor whole region of behaviour in fewest tokens, by recruit priors model already hold.

Serve predictability twice. In body anchor _execution_: agent reach for same behaviour every time word appear. In description anchor _invocation_: when same word live in prompts, docs, code, agent link shared language to skill, fire it more reliable.

Hunt opportunity refactor skills use leading words. Triad spelled out at three sites (**duplication**), description spending sentence gesture at one idea — each passage beg **collapse** into single token. Examples include:

- "fast, deterministic, low-overhead" -> _tight_ — one quality restated across phase — into single pretrained word (_tight_ loop).
- "a loop you believe in" -> _red_ — convert fuzzy gate into binary observable state (loop go _red_ on bug, or don't).

Win twice over: fewer tokens, _and_ sharper hook for agent hang thinking on. Assume every skill carry restatements leading words retire — go find them.

## Failure modes

Use these diagnose issues user may have with skill.

- **Premature completion** — end step before genuine done, attention slip to _being done_. Defence, in order: sharpen completion criterion first (cheap, local); only if irreducibly fuzzy _and_ rush observed, hide post-completion steps by splitting (sequence cut).
- **Over-prescription** — steps dictated where task tolerate variation, agent lose room to adapt, recover, or find better path. State target and constraints instead; sequence genuine too fragile for prose belong in **script**.
- **Duplication** — same meaning in more than one place. Cost maintenance and tokens, inflate meaning's prominence on ladder past real rank.
- **Sediment** — stale layers settle because adding feel safe, removing feel risky. Default fate of any skill without pruning discipline.
- **Sprawl** — skill simply too long, even when every line live and unique. Hurt readability, maintainability, waste tokens. Checkable bound: past ~500 lines or ~5k tokens, `SKILL.md` sprawled by definition. Cure is ladder: disclose **reference** behind pointers, split by **branch** or sequence so each path carry only what need.
- **No-op** — line model already obey by default, pay load say nothing. Test: change behaviour versus default? Weak leading word (_be thorough_ when agent already thorough-ish) is no-op; fix stronger word (_relentless_), not different technique.
- **Menu** — alternatives offered as equals ("use X, Y, or Z"), each run pick differently, predictability die at fork. Name one default; demote rest to escape hatches with condition earning them.
- **Negation** — steer by prohibition backfire: _don't think of an elephant_ names elephant, make it more available, not less. Prompt the **positive** — state target behaviour so banned one never spoken; keep prohibition only as hard guardrail can't phrase positive, even then pair with what do instead. Body steering only: boundary drawn in **description** ("not for spreadsheets") triage between skills, not negation — keep those.
