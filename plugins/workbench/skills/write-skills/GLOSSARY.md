# Glossary — Writing Skills

Definitions for [`write-skills`](SKILL.md), the disclosed reference of that skill. `SKILL.md` carries the decisions and the mechanics; this file carries what each term means.

Terms are grouped by axis: **Invocation** (how a skill is reached), **Information Hierarchy** (how its content is arranged), **Steering** (how the agent's runtime behaviour is shaped), and **Pruning** (how it is kept lean). Each failure mode lives beside the lever that cures it, tagged _failure mode_.

Bold terms in any definition have their own heading here; italics are emphasis only.

## Predictability

The degree to which a skill makes the agent behave the same _way_ every run — the same process, not the same output (a brainstorming skill should _predictably_ diverge; the tokens vary, the behaviour doesn't). The root virtue every other term serves — cost and maintainability are symptoms of it, not rivals.

_Avoid_: consistency, reliability, robustness, output-determinism

## Invocation

How a skill is reached — and the two loads you pay for the choice.

### Model-Invoked

A skill that keeps its **description** exposed, so the agent sees it and fires it on its own — a human can still type its name, so model-invocation always _includes_ user reach. There is no model-only state: the description only ever _adds_ agent discovery and never removes the human's. It pays a permanent **context load** every turn for that discoverability. It is reachable by other skills, since the description that makes it agent-discoverable makes it invocable too. A model-invoked skill whose content is all **reference** is also one home for shared reference: another skill can invoke it, so reference needed by several skills lives in one place.

_Avoid_: ability, tool, capability

### User-Invoked

A skill whose **description** is withheld from the agent — the field stays (the format requires it) but turns human-facing — so it is reachable only by a human typing its name (user-_only_, where **model-invoked** is user-_and-agent_). It trades agent-discoverability for zero **context load**. Because it exposes no description, nothing but a human reaches it: no other skill can fire it.

_Avoid_: procedure, workflow, command

### Description

A skill's machine-readable trigger, and the one **context pointer** a **model-invoked** skill is forced to keep loaded at all times. _Exposure_ is the invocation axis: shown to the agent, the skill is model-invoked (and reachable by other skills too); withheld — the field kept, human-facing only — the skill is **user-invoked**, reachable only by a human. The field is mandatory in the skill format: withholding is a switch, never a deletion. It is the source of a model-invoked skill's **context load**.

_Avoid_: frontmatter, summary

### Context Pointer

A reference held in the agent's context that names some out-of-context material and encodes the condition for reaching it. The **description** is the top-level context pointer (from the context window to the skill); a pointer to a disclosed file is the same object one level down, governed by the same writing rules. The wording, not the target, decides _when_ the agent reaches the material — and _how reliably_.

_Avoid_: link, reference, import

### Context Load

The cost a **model-invoked** skill imposes on the agent's context window — its **description**, always loaded, spends both tokens and attention. It is what **user-invoked** skills escape by exposing no description, and the brake on splitting into more model-invoked skills.

_Avoid_: token cost, context bloat

### Cognitive Load

The cost a **user-invoked** skill imposes on the human — what they must hold in their head: which skills exist, and when to reach for each (the human is the index). It is what **model-invocation** removes by being agent-discoverable, and the brake on splitting into more user-invoked skills. It is not a cost to minimise: it is the price of human agency, and the reason some skills stay user-invoked. Spend it where human judgement matters; remove it where it doesn't.

_Avoid_: human index, burden, overhead

### Router Skill

A **user-invoked** skill whose job is to point at your other user-invoked skills — naming each and when to reach for it — so the human has one skill to remember instead of many. It can only hint, never fire them: user-invoked skills expose no **description**, so nothing but the human reaches them. It is the cure for **cognitive load** when user-invoked skills multiply.

_Avoid_: dispatcher, menu, registry, index, router procedure

### Granularity

How finely you divide skills. Finer division spends one of two loads: more **model-invoked** skills spend **context load** (more descriptions crowd the window and compete for attention); more **user-invoked** skills spend **cognitive load** (more for the human to remember and reach for). Two cuts divide them — by invocation and by sequence — both under a coherence test: one unit of work per skill, scoped to compose with the rest.

_Avoid_: chunking, modularity

## Information Hierarchy

How a skill's content is arranged, and how far down the ladder each piece sits.

### Information Hierarchy Ladder

A skill's content ranked by how immediately the agent needs it — a single ladder produced by two cuts: in-file or behind a pointer, and step or reference. A skill with no **steps** uses just the bottom two rungs — often a legitimately flat peer-set (e.g. every rule of a review on one rung), which is a fine arrangement, not a smell. The hierarchy is independent of invocation: a skill can be model- or user-invoked whether it is all steps, all **reference**, or both. When a skill has steps, in-file reference that should be disclosed buries them and turns attending to them into a coin-flip — a variance lever, not just a legibility one.

_Avoid_: structure, organization, layout

### Steps

The ordered actions the agent performs — when a skill has them, the primary tier of content and the part that earns its place in SKILL.md. Not every skill has them: a skill can be all steps (`tdd`), all **reference** (review), or both, independent of invocation. Every step ends on a **completion criterion**, clear or vague.

_Avoid_: workflow, instructions, choreography

### Reference

Material the agent refers to on demand — definitions, facts, parameters, examples, conditional instructions. When a skill has **steps**, reference is secondary to them; when it has none, reference is its entire content; or it lives outside any skill entirely — see **External Reference**. It is reached via **context pointers** and is the prime candidate for **progressive disclosure**.

_Avoid_: supporting material, docs, background

### External Reference

**Reference** living outside the skill system — a plain file with no **description** and no **steps**, not invocable — that any skill can point at. The home for shared reference that needn't fire on its own.

_Avoid_: doc, resource, knowledge base

### Script

Executable code bundled with a skill — reached like disclosed **reference**, but run rather than read. The strongest **predictability** lever there is: prose **steps** are re-interpreted every run; a script executes identically. When a sequence is fragile — exact order, exact flags, where one reordering breaks it — freeze it here instead of describing it.

_Avoid_: helper, tool, automation

### Progressive Disclosure

Moving **reference** down the ladder — out of SKILL.md, behind a **context pointer** — so the top stays legible. It is not primarily a token optimisation; it is how the **information hierarchy** is protected. It is licensed by the **branch**: material only some paths need can sit behind a pointer without costing the paths that don't.

_Avoid_: lazy loading, chunking

### Co-location

Keeping material the agent needs at once in one place — a concept's definition, rules, and caveats under a single heading, not scattered across the file — so reading one part brings its neighbours with it. There is no formula for the right format of a body of **reference**; the test is that the skill should read like documentation written for the agent, and grouped material reads that way where scattered material doesn't. Distinct from **duplication**: that repeats one meaning in two places, whereas scattering fragments a single meaning across many.

_Avoid_: grouping, clustering, cohesion

### Sprawl

_Failure mode._ A skill that is simply too long — too many lines in SKILL.md — whether or not those lines are stale or repeated. Even an all-live, all-unique skill can sprawl. It costs readability (the agent wades through more before acting, and attention thins across the excess), maintainability (every extra line is one more to keep **relevant**), and tokens. Distinct from **sediment** (length from stale accumulation) and **duplication** (length from repeated meaning) — sprawl is length itself, whatever the cause.

_Avoid_: bloat, length, size, verbosity

## Steering

Levers that shape the agent's runtime behaviour toward **Predictability**.

### Branch

A distinct way a skill can be invoked — a case the skill handles — so different runs take different paths through it. A skill with many steps may carry many branches; a linear one has none.

_Avoid_: path, case, fork

### Leading Word

A compact concept — also called a _Leitwort_ — already living in the model's pretraining, that the agent thinks with while running the skill. It encodes a behavioural principle in the fewest possible tokens by invoking priors the model already holds (e.g. _lesson_, _proximal zone of development_, _fog of war_, _tracer bullets_). Repeated as a token, never as a sentence, it accumulates a distributed definition across the skill and anchors a whole region of behaviour.

It serves **predictability** twice. In the body it anchors _execution_ — the agent reaches for the same behaviour every time the concept appears, and inside flat **reference** it focuses attention on the class of thing to look for, recruiting the right checks each run. In the **description** it anchors _invocation_ — and not only within the skill: when the same word lives in your prompts, docs, and codebase, the agent links that shared language to the skill and fires it more reliably. Word a description with the leading words you actually use when you want the skill.

_Avoid_: keyword, term, motif

### Completion Criterion

The condition that tells the agent a unit of work is done — the target it judges against. Two axes make it a lever, not just a quality. _Clarity_ (can the agent tell done from not-done?) resists **premature completion**: a vague bound ("understanding reached") lets the agent declare done and slip to the next step. Clarity needs **steps** to bite, since premature completion is a between-steps failure. _Demand_ (how much is required) sets **legwork**, and unlike clarity it is not step-bound: it binds a body of flat **reference** too, which is how a skill with no steps still carries an exhaustiveness bar. The strongest criteria score on both.

_Avoid_: done condition, exit condition, stopping rule

### Legwork

The work the agent does behind the scenes within a single step — reading files, exploring the codebase, making changes, digging up what it needs rather than offloading it to the user. It lives below the step structure: never written as its own step, latent in the wording, and controlled by the agent rather than the skill. It is the within-step counterpart to the across-step pull of **post-completion steps**. It is raised by a **leading word** (_relentless_, _exhaustive_) or a **completion criterion** demanding exhaustive work. It goes thin either when the demand is missing or when **premature completion** cuts the step short.

_Avoid_: scope, effort, diligence, coverage

### Post-Completion Steps

The **steps** that follow the current step. While visible, they pull the agent forward into **premature completion** — the more it sees, the stronger the tug.

_Avoid_: horizon, fog of war, lookahead

### Premature Completion

_Failure mode._ Ending the current step before it is genuinely done, because the agent's attention slips to being done rather than to the work. It is a between-steps failure, so it needs **steps** to occur — a skill with no steps that quits early isn't showing premature completion but thin **legwork** under unmet demand. It is a tug-of-war between two forces: visible **post-completion steps** (pulling forward) and the **completion criterion**'s clarity (resistance — a sharp, checkable bar holds; a vague one gives way). Fuzziness is a necessary condition: a sharp bound resists the pull no matter how many later steps are visible, so a step that never rushes needs no defending. It is one cause of thin legwork, distinct from it: legwork can be thin even when a step runs to full completion.

_Avoid_: premature closure, the rush, rushing, shortcutting

### Over-Prescription

_Failure mode._ Dictating **steps** where the task tolerates variation — every prescribed move removes the agent's room to adapt, recover from errors, or find a better path, and adds a line to keep **relevant**. Match specificity to fragility: reserve exact sequences for operations that break when reordered, and a sequence that fragile belongs in a **script**, not in prose.

_Avoid_: micromanagement, rigidity, step-by-step

### Menu

_Failure mode._ Alternatives offered as equals — "use X, Y, or Z" — so each run picks differently and **predictability** dies at the fork. A menu is a decision the author declined to make, exported to the agent to remake every run.

_Avoid_: options, alternatives, flexibility

### Negation

_Failure mode._ Steering by prohibition — telling the agent what _not_ to do — drags the forbidden behaviour into context and makes it _more_ available, not less. _Don't think of an elephant_, and the elephant is all there is; _never write verbose comments_, and verbosity is the pattern the agent just read. Negation is a weak modifier that a strongly activated concept overruns, so the ban half-reads as an instruction to do the thing. The **leading word** is the _elephant_: whatever the prohibition names comes into frame. This governs steering in the body only.

_Avoid_: ironic rebound, don't-prompting, the pink elephant

## Pruning

Keeping a skill lean.

### Single Source of Truth

The desired state where each meaning lives in exactly one authoritative place, so a change to the skill's behaviour is a change in one place. **Duplication** is its violation.

_Avoid_: home, canonical location

### Cache

A skill line restating something the agent could look up for itself — `package.json` scripts, a config file, the directory layout, `--help` output. The environment is a **single source of truth** too, and one that can't go stale, so a cache earns its **context load** only where the lookup is expensive: an unwritten convention, the reason behind a choice, a gotcha no config confesses. Distinct from **duplication**, whose two copies both sit inside the skill.

_Avoid_: mirror, snapshot, copy

### Duplication

_Failure mode._ The same meaning given more than one **single source of truth**. It costs maintenance (change one place, and you must change the others), costs tokens, and inflates prominence — repeating a meaning weights it on the ladder past its real rank. It is the accidental inverse of the **leading word**, which raises attention on purpose by repeating a token, never the meaning.

_Avoid_: repetition, redundancy

### Relevance

Whether a line still bears on what the skill does — the lens for what to keep. A line loses relevance either by never bearing on the task (mere exposition, or a **branch** that should be disclosed) or by going stale: drifting out of date as the behaviour or world it describes changes. Shorter skills are easier to keep relevant, since each line is cheaper to check. Distinct from **no-op**: relevance asks whether a line bears on the task, not whether it changes behaviour.

_Avoid_: load-bearing, staleness, freshness

### Sediment

_Failure mode._ Layers of old content that settle in a skill and are never cleared, since adding feels safe and removing feels risky — so stale, irrelevant lines accumulate and you must core down through them to find what's still live. The default fate of any skill without pruning discipline; a slow erosion of **relevance**, as opposed to **duplication**'s repeated meaning.

_Avoid_: accretion, bloat, cruft, rot

### No-Op

_Failure mode._ An instruction that changes nothing because the model already does it by default — you pay load to tell the agent what it would do anyway. A line can be perfectly **relevant** and still be a no-op. The same priors that make a **leading word** free make a no-op worthless.

A leading word is a _technique_; a no-op is a _verdict_ on a line — and they cross. A leading word too weak to beat the default is a no-op, so the no-op test is also how you grade whether a leading word is earning its repetitions.

_Avoid_: redundant instruction, restating the obvious, belaboring
