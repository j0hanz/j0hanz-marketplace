---
name: code-quality-review
description: 'Strict behavior-preserving review of branch changes on both axes the next reader pays for: how the code reads (names, functions, comments) and how it is shaped (abstraction quality, giant files, spaghetti growth).'
disable-model-invocation: true
---

# Code Quality Review

Review branch changes for what the next reader pays: how the code **reads** and how it is **shaped**. Behavior never moves — every finding is a rename, an extraction, a reorder, or a deletion.

Be **ambitious**: hunt the _code judo_ move — the restructure that uses existing architecture to delete complexity outright, leaving the implementation dramatically smaller and more direct with behavior preserved. Bar: the code feels inevitable in hindsight, fewer concepts for the reader to hold, not the same complexity rearranged. Passing tests don't excuse a change that leaves the codebase less modular or less legible.

## The pass

1. Read every file the diff touches in full, plus the callers of any function whose name or signature is in question. A name is only safe to change once you know who says it.
2. Check both standard sets below against each file.
3. Report high-conviction findings only — a few structural comments beat a long list of cosmetic notes.

Done when every function in scope carries a verdict — flagged, with what and why, or clean. A file-level "looks fine" is not a verdict.

Asked to tidy rather than review: same standards, applied as edits. Grep each identifier you rename as a **string**, not only as a symbol — reflection, DI by name, serialized field names, ORM columns, template variables, and string-keyed dispatch all survive a symbol-aware rename and break at runtime. Run the tests; where nothing covers the touched code, say so and leave one runnable check behind.

## Reads

- **Names.** The name says what the reader needs at the call site: `elapsedDays` over `d`, `postPayment` over `check`. The type in the name matches the type — `accountList` holding a Map is a lie, drop the suffix. Classes are nouns, methods are verbs.
- **Bucket names** — `Manager`, `Data`, `Info`, `Helper`, `Util`, `Processor` — mean no single thing was found to name: a design problem wearing a naming costume. Split until each piece has a real name. Same verdict on `ProductData` sitting beside `ProductInfo`: a distinction that carries no information tells the reader nothing about which to call.
- **Functions.** One level of abstraction each — business rules and byte-level detail (regex, index math, SQL) live in separate functions. **Stepdown rule**: the file reads top-down like a newspaper, each function above the ones it calls. Command or query, never both; `getX()` that also mutates is the bug the next reader ships. 0–2 arguments read cleanly, 3+ wants a named type, and a boolean argument is two functions wearing one name. Side effects live in the name.
- **Comments.** Comments carry **why** — the constraint, the ticket, the reason this looks wrong but isn't. Code carries **what**. A comment restating the next line, a commented-out block, a `// ===== SECTION =====` banner: delete, git holds the history. A comment explaining a confusing block is a naming task in disguise — extract it, name it, drop the comment.
- **Locality.** Variables declared next to their first use, related lines adjacent.

## Shape

1. **Size and responsibility.** One reason to change per unit, function or class alike; two reasons means two units. A PR should not push a file from under 1k lines to over 1k. Default remedy: extract into smaller focused modules. Waive only for a compelling structural reason with the resulting file still clearly organized; otherwise flag it and ask whether to decompose first.
2. **Spaghetti growth.** Ad-hoc conditionals, one-off branches, narrow edge-case handling, "temporary" flags bolted onto unrelated existing flows — design problems, not stylistic nits. Prefer reframing the state model so the conditionals disappear over merely centralizing them; reach for a state machine or policy object only when control flow itself is what's modeled.
3. **Boring over magic.** Stay skeptical of generic mechanisms hiding a single data-shape assumption. Thin abstractions, identity wrappers, and pass-through helpers add indirection without clarity — delete them, keep the direct flow. Extraction earns its place when the fragment has a name worth saying, never to hit a line count.
4. **Types at boundaries.** Question unnecessary optionality, `unknown`, `any`, and cast-heavy code where a clearer typed contract could exist. A silent fallback papering over an unclear invariant means the boundary should be made explicit.
5. **Canonical home.** Feature logic leaking into shared paths, implementation details leaking through APIs, bespoke or copy-pasted logic where an existing utility already does the job — code belongs in the package, service, or module that owns the concept. Talk to neighbours: `a.getB().getC().doThing()` binds the caller to B's internals, so ask `a` to do the thing.
6. **Orchestration.** Independent work serialized for no reason should run in parallel; related updates that can leave state half-applied should be restructured atomically, orchestration separated from business logic. Ignore micro-optimizations; flag orchestration complexity that adds brittleness.

## Where the rules lose

- **House style wins.** Match the file's existing conventions over any book. Go returning `err`, Rust returning `Result`, Python returning `None` are idioms, not return-code smells. Keep exceptions out of a language that doesn't want them.
- **Public names are API.** An exported symbol, JSON key, CLI flag, or DB column renames into a breaking change — rename inside the module boundary, or ask.
- **One absence representation per API.** Pick null, empty, or raise for a given failure and hold it across the API. Mixing all three is what forces the caller to guard everywhere.

## Output

Order findings: structural regressions and missed code-judo moves first, then the rest of **Shape**, then **Reads**. Approve only when no standard fires and no code-judo move is left on the table.

Tone is direct and demanding. Lowercase, ask rather than pronounce — name the problem, propose the move as a question:

- `i think there's a code-judo move here that makes this much simpler. can we reframe this so these branches disappear?`
- `this pushes the file past 1k lines. can we decompose this first?`
- `this abstraction seems unnecessary. can we just keep the direct flow?`
- `accountList holds a Map here. can we drop the suffix?`
