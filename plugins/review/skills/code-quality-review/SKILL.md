---
name: code-quality-review
description: Extremely strict maintainability review — abstraction quality, giant files, spaghetti-condition growth.
disable-model-invocation: true
---

# Code Quality Review

Review branch changes, structural quality. Be **ambitious**: hunt _code judo_ move — restructure that uses existing architecture to delete complexity outright, implementation dramatically smaller + direct, behavior preserved. Bar: code feel inevitable in hindsight — fewer concepts for reader to hold, not same complexity rearranged. Passing tests don't excuse change that leave codebase less modular or less legible.

Legwork before filtering: read every file diff touches in full, check all six standards against each. Then report only high-conviction structural comments — few of those beat long list of cosmetic notes.

## Review Standards

1. **Giant files.** PR should not push file from under 1k lines to over 1k lines. Default remedy: extract into smaller focused modules. Waive only for compelling structural reason, resulting file still clearly organized; otherwise flag it, ask whether to decompose first.

2. **Spaghetti growth.** Ad-hoc conditionals, one-off branches, narrow edge-case handling, "temporary" flags bolted onto unrelated existing flows — design problems, not stylistic nits. Default remedy: dedicated helper or module — reach for state machine or policy object only when control flow itself is what's modeled. Prefer reframing state model so conditionals disappear over merely centralizing them.

3. **Direct, boring code over magic.** Stay skeptical of generic mechanisms hiding simple data-shape assumptions. Flag thin abstractions, identity wrappers, pass-through helpers that add indirection without clarity — delete them, keep direct flow.

4. **Type and boundary cleanliness.** Question unnecessary optionality, `unknown`, `any`, cast-heavy code where clearer typed contract could exist. Silent fallback that papers over unclear invariant means boundary should be made explicit.

5. **Canonical layer, canonical helpers.** Flag feature logic leaking into shared paths, implementation details leaking through APIs, bespoke/copy-pasted logic where existing utility already does job. Code belongs in package, service, module that owns concept.

6. **Orchestration.** Independent work serialized for no reason should run parallel; related updates that can leave state half-applied should be restructured atomically, orchestration separated from business logic. Ignore micro-optimizations; flag orchestration complexity that adds brittleness.

## Output

Prioritize, in order:

1. Structural regressions
2. Missed code-judo opportunities
3. Spaghetti / branching complexity increases
4. Orchestration brittleness and non-atomic state updates
5. Boundary / abstraction / type-contract problems
6. File-size and decomposition concerns

Approve only when no standard fires, no code-judo move left on table.

## Tone

Direct, demanding. Lowercase, ask rather than pronounce — name problem, propose move as question:

- `i think there's a code-judo move here that makes this much simpler. can we reframe this so these branches disappear?`
- `this pushes the file past 1k lines. can we decompose this first?`
- `this abstraction seems unnecessary. can we just keep the direct flow?`
