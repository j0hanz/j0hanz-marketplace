---
name: clean-code
description: 'Readability pass over existing code — naming, function size, comments, structure — by Clean Code (Robert C. Martin) heuristics, behavior unchanged. Use when the user asks to clean up or tidy code, wants a Clean Code review of a diff or pull request, mentions code smells, or asks whether code follows Clean Code. Not for bug hunting, performance work, or cutting over-engineering.'
disable-model-invocation: true
---

# Clean Code

Turn working code into code the next reader changes without fear. Behavior stays identical: every edit is a rename, an extraction, a reorder, or a deleted comment.

## The pass

1. Read the whole unit — every function in scope, plus its callers. A name is only safe to change once you know who says it.
2. Grep each identifier you plan to rename as a **string**, not only as a symbol. Reflection, DI by name, serialized field names, ORM columns, template variables, and string-keyed dispatch all survive a symbol-aware rename and break at runtime.
3. Apply the heuristics below, one function at a time.
4. Run the tests. If nothing covers the touched code, say so and leave one runnable check behind.

Done when every function in scope carries a verdict — changed, with what and why, or left clean. A file-level "looks fine" is not a verdict.

## Names

- The name says what the reader needs at the call site: `elapsedDays` over `d`, `postPayment` over `check`.
- The type in the name matches the type. `accountList` holding a Map is a lie; drop the suffix.
- Classes are nouns, methods are verbs.
- **Bucket names** — `Manager`, `Data`, `Info`, `Helper`, `Util`, `Processor` — mean no single thing was found to name. That is a design problem wearing a naming costume: split until each piece has a real name.
- Distinctions carry information. `ProductData` sitting beside `ProductInfo` tells the reader nothing about which to call.

## Functions

- One level of abstraction per function: business rules and byte-level detail (regex, index math, SQL) live in separate functions.
- **Stepdown rule** — the file reads top-down like a newspaper, each function above the ones it calls.
- Command or query, never both. A function changes state or answers a question; `getX()` that also mutates is the bug the next reader ships.
- 0–2 arguments read cleanly; 3+ wants a named type. A boolean argument is two functions wearing one name.
- Side effects live in the name. Touching state the caller cannot see from the signature earns a rename or a split.

## Comments

- Comments carry **why** — the constraint, the ticket, the reason this looks wrong but isn't. Code carries **what**.
- A comment restating the next line, a commented-out block, a `// ===== SECTION =====` banner: delete. Git holds the history.
- A comment explaining a confusing block is a naming task in disguise. Extract it, name it, drop the comment.

## Structure

- **Single responsibility** — one reason to change, for functions and classes alike. Two reasons means two units.
- **Law of Demeter** — talk to neighbours. `a.getB().getC().doThing()` binds the caller to B's internals; ask `a` to do the thing.
- Declare variables next to their first use, keep related lines adjacent.

## Where Uncle Bob loses

- **House style wins.** Match the file's existing conventions over the book. Go returning `err`, Rust returning `Result`, Python returning `None` are idioms, not return-code smells. Never import exceptions into a language that doesn't want them.
- **Extract-till-you-drop** shreds readable code into a call graph nobody can hold. Extract when the fragment has a name worth saying, not to hit a line count.
- **Public names are API.** An exported symbol, JSON key, CLI flag, or DB column renames into a breaking change — rename inside the module boundary, or ask.
- **One absence representation per API.** The rule that pays is consistency: pick null, empty, or raise for a given failure and hold it across the API. Mixing all three is what forces the caller to guard everywhere.
