# Glossary — Writing Skills

Definitions for [`writing-skills`](SKILL.md), disclosed reference of that skill. `SKILL.md` carries the decisions and the mechanics; this file carries what each term means.

Terms grouped by axis: **Invocation** (how skill reached), **Information Hierarchy** (how content arranged), **Steering** (how agent runtime behaviour shaped), **Pruning** (how kept lean). Each failure mode lives beside lever that cures it, tagged _failure mode_.

Bold terms in any definition have own heading here; italics are emphasis only.

## Predictability

Degree skill make agent behave same _way_ every run — same process, not same output (brainstorming skill should _predictably_ diverge; tokens vary, behaviour don't). Root virtue every other term serve — cost and maintainability symptoms of it, not rivals.

_Avoid_: consistency, reliability, robustness, output-determinism

## Invocation

How skill reached — and two loads you pay for choice.

### Model-Invoked

Skill keep **description** exposed, so agent see and fire it autonomous — human still type name, so model-invocation always _includes_ user reach. No model-only state: description only ever _adds_ agent discovery, never removes human's. Pay permanent **context load** every turn for that discoverability. Reachable by other skills, since description that make it agent-discoverable make it invocable too. Model-invoked skill whose content all **reference** also one home for shared reference: another skill can invoke it, so reference needed by several skills live in one place.

_Avoid_: ability, tool, capability

### User-Invoked

Skill whose **description** withheld from agent — field stays (format require it), turned human-facing — so reachable only by human typing name (user-_only_, where **model-invoked** user-_and-agent_). Trade agent-discoverability for zero **context load**. Expose no description, so nothing but human reach it: no other skill fire it.

_Avoid_: procedure, workflow, command

### Description

Skill's machine-readable trigger, and one **context pointer** **model-invoked** skill forced keep loaded always. _Exposure_ is invocation axis: shown to agent, skill model-invoked (reachable by other skills too); withheld — field kept, human-facing only — skill **user-invoked**, reachable only by human. Field mandatory in skill format: withholding a switch, never deletion. Source of model-invoked skill's **context load**.

_Avoid_: frontmatter, summary

### Context Pointer

Reference held in agent's context naming some out-of-context material, encode condition for reaching it. **Description** top-level context pointer (context window to skill); pointer to disclosed file same object one level down, governed by same writing rules. Wording, not target, decide _when_ agent reaches — and _how reliably_.

_Avoid_: link, reference, import

### Context Load

Cost **model-invoked** skill impose on agent's context window — **description**, always loaded, spend both tokens and attention. What **user-invoked** skills escape by exposing no description, and brake on splitting into more model-invoked skills.

_Avoid_: token cost, context bloat

### Cognitive Load

Cost **user-invoked** skill impose on human — what they must hold in head: which skills exist, when reach for each (human is index). What **model-invocation** removes by being agent-discoverable, and brake on splitting into more user-invoked skills. Not cost to minimise: price of human agency, reason some skills stay user-invoked. Spend where human judgement matters; remove where not.

_Avoid_: human index, burden, overhead

### Router Skill

**User-invoked** skill whose job point at your other user-invoked skills — naming each, when reach for it — so human got one skill remember instead many. Can only hint, never fire them: user-invoked skills expose no **description**, so nothing but human reach them. Cure for **cognitive load** when user-invoked skills multiply.

_Avoid_: dispatcher, menu, registry, index, router procedure

### Granularity

How finely you divide skills. Finer division spend one of two loads: more **model-invoked** skills spend **context load** (more descriptions crowd window, compete for attention); more **user-invoked** skills spend **cognitive load** (more for human remember, reach for). Two cuts divide — by invocation, by sequence — both under coherence test: one unit work per skill, scoped compose with rest.

_Avoid_: chunking, modularity

## Information Hierarchy

How skill's content arranged, how far down ladder each piece sits.

### Information Hierarchy Ladder

Skill's content ranked by how immediate agent need it — single ladder, produced by two cuts: in-file or behind pointer, and step or reference. Skill with no **steps** use just bottom two rungs — often legitimately flat peer-set (e.g. every rule of review on one rung), fine arrangement, not smell. Hierarchy independent of invocation: skill can be model- or user-invoked whether all steps, all **reference**, or both. When skill got steps, in-file reference that should be disclosed buries them, turn attending to them into coin-flip — variance lever, not just legibility one.

_Avoid_: structure, organization, layout

### Steps

Ordered actions agent performs — when skill got them, primary tier of content, part that earn place in SKILL.md. Not every skill got them: skill can be all steps (`tdd`), all **reference** (review), or both, independent of invocation. Every step end on **completion criterion**, clear or vague.

_Avoid_: workflow, instructions, choreography

### Reference

Material agent refer to on demand — definitions, facts, parameters, examples, conditional instructions. When skill got **steps** secondary to them; when skill got none it entire content; or lives outside any skill entirely — see **External Reference**. Reached via **context pointers**, prime candidate for **progressive disclosure**. Output format best given as template to fill rather than prose describing it — agent pattern-match concrete structure more reliable than description of one.

_Avoid_: supporting material, docs, background

### External Reference

**Reference** living outside skill system — plain file, no **description**, no **steps**, not invocable — any skill point at. Home for shared reference that needn't fire on own.

_Avoid_: doc, resource, knowledge base

### Script

Executable code bundled with skill — reached like disclosed **reference**, run rather than read. Strongest **predictability** lever there is: prose **steps** re-interpreted every run; script execute identically. When sequence fragile — exact order, exact flags, one reordering break it — freeze it here instead of describing it.

_Avoid_: helper, tool, automation

### Progressive Disclosure

Moving **reference** down ladder — out of SKILL.md, behind **context pointer** — so top stay legible. Not primarily token optimisation; how **information hierarchy** protected. Licensed by **branch**: material only some paths need can sit behind pointer without costing paths that don't.

_Avoid_: lazy loading, chunking

### Co-location

Keeping material agent need at once in one place — concept's definition, rules, caveats under single heading, not scattered across file — so reading one part bring neighbours with it. No formula for right format of body of **reference**; test is skill should read like documentation written for agent, grouped material read that way where scattered material don't. Distinct from **duplication**: that repeat one meaning in two places, where scattering fragment single meaning across many.

_Avoid_: grouping, clustering, cohesion

### Sprawl

_Failure mode._ Skill simply too long — too many lines in SKILL.md — independent of whether stale or repeated. Even all-live, all-unique skill can sprawl. Cost readability (agent wade through more before act, attention thin across excess), maintainability (every extra line one more keep **relevant**), and tokens. Distinct from **sediment** (length from stale accumulation) and **duplication** (length from repeated meaning) — sprawl is length itself, whatever cause.

_Avoid_: bloat, length, size, verbosity

## Steering

Levers that shape agent's runtime behaviour toward **Predictability**.

### Branch

Distinct way skill can be invoked — case skill handles — so different runs take different paths through it. Skill with many steps may carry many branches; linear one got none.

_Avoid_: path, case, fork

### Leading Word

Compact concept — also called _Leitwort_ — already living in model's pretraining, agent think with while running skill. Encode behavioural principle in fewest possible tokens by invoking priors model already hold (e.g. _lesson_, _proximal zone of development_, _fog of war_, _tracer bullets_). Repeated as token, never as sentence, accumulate distributed definition across skill, anchor whole region of behaviour.

Serve **predictability** twice. In body anchor _execution_ — agent reach for same behaviour every time concept appear, and inside flat **reference** focus attention on class of thing to look for, recruit right checks each run. In **description** anchor _invocation_ — not only within skill: when same word live in your prompts, docs, and codebase, agent link that shared language to skill, fire it more reliably. Word description with leading words you actually use when you want skill.

_Avoid_: keyword, term, motif

### Completion Criterion

Condition telling agent unit of work done — target it judge against. Two axes make it lever, not just quality. _Clarity_ (can agent tell done from not-done?) resist **premature completion**: vague bound ("understanding reached") let agent declare done, slip to next step. Clarity need **steps** to bite, since premature completion between-steps failure. _Demand_ (how much required) set **legwork**, and unlike clarity not step-bound: bind body of flat **reference** too, how skill with no steps still carry exhaustiveness bar. Strongest criteria score on both.

_Avoid_: done condition, exit condition, stopping rule

### Legwork

Work agent do behind scenes within single step — reading files, exploring codebase, making changes, digging up what need rather than offloading to user. Lives below step structure: never written as own step, latent in wording, controlled by agent rather than skill. Within-step counterpart to **post-completion steps**' across-step pull. Raised by **leading word** (_comprehensive_, _thorough_) or **completion criterion** demanding exhaustive work. Go thin either when demand missing or when **premature completion** cut step short.

_Avoid_: scope, effort, diligence, coverage

### Post-Completion Steps

**Steps** that follow current step. Visible, pull agent forward into **premature completion** — more it sees, stronger tug.

_Avoid_: horizon, fog of war, lookahead

### Premature Completion

_Failure mode._ Ending current step before genuinely done, since agent's attention slip to being done rather than to work. Between-steps failure: need **steps** to occur — skill with no steps that quit early isn't premature completion but thin **legwork** under unmet demand. Tug-of-war between two forces: visible **post-completion steps** (pull forward) and **completion criterion**'s clarity (resistance — sharp, checkable bar hold; vague one give way). Fuzziness necessary condition: sharp bound resist pull no matter how many later steps visible, so step that never rush need no defending. One cause of thin legwork, distinct from it: legwork can be thin even when step run to full completion.

_Avoid_: premature closure, the rush, rushing, shortcutting

### Over-Prescription

_Failure mode._ Dictating **steps** where task tolerate variation — every prescribed move remove agent's room to adapt, recover from errors, or find better path, add line to keep **relevant**. Match specificity to fragility: reserve exact sequence for operations that break when reordered, and sequence that fragile belongs in **script**, not prose.

_Avoid_: micromanagement, rigidity, step-by-step

### Menu

_Failure mode._ Alternatives offered as equals — "use X, Y, or Z" — so each run pick differently, **predictability** dies at fork. Menu a decision author declined to make, exported to agent to remake every run.

_Avoid_: options, alternatives, flexibility

### Negation

_Failure mode._ Steering by prohibition — telling agent what _not_ to do — drags forbidden behaviour into context, make it _more_ available, not less. _Don't think of an elephant_, and elephant all there is; _never write verbose comments_, verbosity pattern agent just read. Negation weak modifier strongly-activated concept overruns, ban half-reads as instruction to do thing. **Leading word** is the _elephant_: whatever prohibition names into frame. Governs steering in body only.

_Avoid_: ironic rebound, don't-prompting, the pink elephant

## Pruning

Keeping skill lean.

### Single Source of Truth

Desired state where each meaning lives in exactly one authoritative place, so change to skill's behaviour a change in one place. **Duplication** its violation.

_Avoid_: home, canonical location

### Cache

Skill line restating something agent could look up for itself — `package.json` scripts, config file, directory layout, `--help` output. Environment is **single source of truth** too, and one that can't go stale, so cache earn its **context load** only where lookup expensive: unwritten convention, reason behind choice, gotcha no config confess. Distinct from **duplication**, whose two copies both sit inside skill.

_Avoid_: mirror, snapshot, copy

### Duplication

_Failure mode._ Same meaning given more than one **single source of truth**. Costs maintenance (change one place, must change others), costs tokens, inflates prominence — repeating meaning weights it on ladder past real rank. Accidental inverse of **leading word**, which raises attention on purpose by repeating a token, never the meaning.

_Avoid_: repetition, redundancy

### Relevance

Whether line still bears on what skill does — lens for what to keep. Line loses relevance either by never bearing on task (mere exposition, or **branch** that should be disclosed) or by going stale: drifting out of date as behaviour or world it describes changes. Shorter skills easier to keep relevant, since each line cheaper to check. Distinct from **no-op**: relevance asks whether line bears on task, not whether it changes behaviour.

_Avoid_: load-bearing, staleness, freshness

### Sediment

_Failure mode._ Layers of old content that settle in skill, never cleared, since adding feels safe and removing feels risky — so stale, irrelevant lines accumulate and you must core down through them to find what's still live. Default fate of any skill without pruning discipline; slow erosion of **relevance**, as opposed to **duplication**'s repeated meaning.

_Avoid_: accretion, bloat, cruft, rot

### No-Op

_Failure mode._ Instruction that changes nothing because model already does it by default — you pay load to tell agent what it would do anyway. Line can be perfectly **relevant** and still be a no-op. Same priors that make **leading word** free make no-op worthless.

Leading word is a _technique_; No-Op is a _verdict_ on a line — and they cross. Leading word too weak to beat default is a no-op, so the no-op test also how you grade whether leading word earning its repetitions.

_Avoid_: redundant instruction, restating the obvious, belaboring
