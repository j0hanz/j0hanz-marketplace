---
name: clean-code
description: Readability pass over code that already works — behavior-preserving, every function in scope carrying a verdict. Use when asked to tidy code, for a readability review of a diff, or when code smells are named. Not for correctness or security defects (bug-hunt) or structural and maintainability review of a branch (qc).
---

# Clean Code

The pass is behavior-preserving: every edit is a **rename**, an **extraction**, a **reorder**, or a deleted comment — plus the new code those need.

Cleaning applies the verdicts; reviewing reports them. Same pass either way, and the review mode skips steps 1 and 4.

## Hazards

Renaming a local is free. The other three edits carry hazards a reader does not see coming, so they stay inline:

- **Extraction** moves a fragment into a new frame, changing what `return`, `break`, `yield`, `?`, Go `defer` and `recover()`, or an `await` inside a lock or transaction means. Extract the whole block, never across its boundary.
- **Reorder** answers to declaration order: JS/TS temporal dead zone, C without a forward declaration, decorators, dataclass fields, Go package `var` and `init`, `macro_rules!`.
- **Deleted comment** breaks the build when the comment is code: `//go:build`, `//go:generate`, `# type: ignore`, `# noqa`, `// eslint-disable-next-line`, `// @ts-expect-error`, SPDX headers, `// Code generated ... DO NOT EDIT`. Rust `///` and Python `>>>` blocks are executed tests.

## Steps

### 1. Pin the behavior

Run the tests covering the touched files and save their output. That saved output is what the behavior-preserving pass is measured against; a check written after the edits only asserts what the new code already does.

**Done when** the pre-edit output is saved, or the absence of any covering test is stated.

### 2. List the scope

Every function in the target — every function in the file, the changed functions in a diff, or every function in the files a PR touches. Read each one, then read its direct callers, one hop out. Where the surface is wide, fan out [research](../research/SKILL.md) to find who says each name.

Generated, vendored, and applied-migration files stay out of scope: a rename there is reverted by the next codegen run, or breaks a checksum.

**Done when** the list is written and every function on it has been read along with its direct callers.

### 3. Walk the list

One function at a time, against the heuristics below.

Before each rename — or each rename verdict, in review mode — grep the identifier as a **string** as well as a symbol. Reflection, DI by name, ORM columns, template variables, string-keyed dispatch, test-discovery names (`test_*`, `Test*`), and CI or Makefile references survive a symbol-aware rename and break at runtime. A name is also wire-visible without appearing as a literal anywhere — an untagged Go field, `vars()`, `asdict()`, or Jackson without `@JsonProperty` serializes under the identifier itself — so check what the payload is built from, not only what the source quotes.

Where two heuristics conflict, a constraint written in the code — a why-comment, a wire format, a hot-path note — outranks the book.

**Done when** every function on the list carries one of three verdicts: **changed**, with what and why; **left clean**; or **left dirty on purpose**, naming the heuristic declined and the constraint that outranked it. A file-level "looks fine" is not a verdict, and neither is "the rest is trivial".

### 4. Preserve the behavior

Run the same tests and diff the output against step 1.

**Done when** the tests pass and the output matches. Red or changed means the pass altered behavior — revert the edit that caused it. Where nothing covered the touched code, say so and leave one runnable check behind that fails if the touched logic breaks.

## Names

- **Intention-revealing** — units and dimensions first: `TAX_RATE` over `TAX` for `0.0825`, `RUSH_FEE_CENTS` over `RUSH_FEE` for `1250`, `elapsedDays` over `d`. A rate named as an amount is the costliest lie in money code, and an unexplained literal (`* 86400`, `status == 2`) earns a named constant.
- The type in the name matches the type. `accountList` holding a Map is a lie; drop the suffix.
- **Noise words** — `Manager`, `Data`, `Info`, `Helper`, `Util`, `Processor` — mean no single thing was found to name: split until each piece has a real name, or rename where the piece already does one thing under a bad name.
- One word per concept. `getUser` beside `fetchUser` tells the reader nothing about which to call.

## Functions

- One level of abstraction per function: business rules and byte-level detail (regex, index math, SQL) live in separate functions.
- **Stepdown rule** — the file reads top-down like a newspaper, each function above the ones it calls where the language allows it.
- Command or query — a function returns a value or changes state, and the name says which. `getX()` that also mutates earns a rename admitting the write (`cacheOrderTotal`); split it only where a caller needs the read without the write. Where the mutation is the point — `pop()`, `next()`, `Map.put()`, `getAndIncrement()`, `or_insert()`, `fetchone()`, `@cached_property`, `getInstance()` — rename at most: splitting breaks every caller, and splitting an atomic manufactures a race that passes tests and fails under load.
- 0–2 arguments read cleanly; 3+ wants a named type. A **flag argument** is two functions wearing one name — split it where it selects behavior at one call site, rename it where it carries data or threads through a call chain.
- Dead code, dead functions, and unused parameters belong in the verdict, not in this diff. Deletion is its own pass with its own tests.

## Comments

- Comments carry **why** — the constraint, the ticket, the reason this looks wrong but isn't. Code carries **what**.
- A comment restating the next line, a commented-out block, a `// ===== SECTION =====` banner: delete, once the file is tracked and clean and no comment nearby says to keep it.
- **Doc comments are API.** `/** Returns the user's ID. */` above `getUserId()` feeds godoc, rustdoc, typedoc, and IDE hovers; deleting it trips `missing_docs`, revive's `exported`, and ruff's D-rules. Martin's own good-comments list carves it out.
- A comment explaining a confusing block is a naming task in disguise: put the explanation into a name and delete the comment.
- A comment that contradicts its code is worse than none. Fix it, and say which reading was right.

## Structure

- **Single responsibility** — one reason to change per class. Two reasons means two classes.
- **Law of Demeter** — the **train wreck** `a.getB().getC().doThing()` binds the caller to B's internals; ask `a` to do the thing. Exempt: chains over data structures with no behavior (DTOs, config structs, protobuf messages, parsed JSON), and fluent chains piping through one object (`builder.append().append()`, `iter().filter().map()`). The violation is navigating between distinct objects, not piping through one.

## Where Uncle Bob loses

- **House style wins.** Match the file's existing conventions over the book. Go returning `err` and Rust returning `Result` are idioms, not return-code smells. Raise only where the language already raises.
- **Extract-till-you-drop** shreds readable code into a call graph nobody can hold. Extract when the fragment has a name worth saying; that name is the whole test.
- **Public names are API.** An exported symbol, JSON key, CLI flag, or DB column renames into a breaking change. Rename inside the module boundary; ask before crossing it — and the same holds for deleting an unused exported symbol.
- **Class-per-responsibility is a Java conclusion.** A Go package of methods on a few structs, a Rust module and `impl` block, and a Python module of functions each satisfy single responsibility already; splitting them to satisfy the book fights the borrow checker or reads as Java-brain.

## Handing off

This skill is one of three that read a landed diff, each on its own axis and none on the others' ([plan](../plan/SKILL.md)). A verdict that turns out to need more than a rename leaves this pass rather than stretching it:

| What the walk surfaced                               | Hands to                             |
| :--------------------------------------------------- | :----------------------------------- |
| The code is wrong, not merely unclear                | [bug-hunt](../bug-hunt/SKILL.md)     |
| The shape is wrong — layering, indirection           | [qc](../qc/SKILL.md)                 |
| The edit no longer fits one behavior-preserving pass | [write-plan](../write-plan/SKILL.md) |
