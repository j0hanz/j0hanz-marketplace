# JSDoc type reference

Disclosed reference for [`SKILL.md`](SKILL.md). Consulted on demand — tag syntax, legacy synonyms, and unsupported patterns the loop doesn't need inline.

## Type tags

**`@type`** takes a primitive (`string`, `number`), a type declared elsewhere, or TypeScript syntax up to conditional types:

```js
/** @type {PromiseLike<string>} */
var p;

/** @type {string | boolean} */
var s;

/** @type {{ a: string, b: number }} */
var o;

/** @type {Array.<number>} */ // Closure array syntax
/** @type {Array<number>} */ // TypeScript array syntax

/** @type {Object.<string, number>} */ // map-like, equivalent to { [x: string]: number }

/** @type {function(string, boolean): number} */ // Closure function syntax
/** @type {(s: string, b: boolean) => number} */ // TypeScript function syntax
```

Cast syntax and `@satisfies` are covered inline in [`SKILL.md`](SKILL.md#casts-satisfies-const).

**Import types** reference another file's types without a runtime import:

```js
/** @param {import("./types").Pet} p */
function walk(p) {}

/** @type {typeof import("./accounts").userAccount} */
var x = require('./accounts').userAccount;
```

**`@import`** brings a name into scope for JSDoc use only — no runtime import is emitted, and the name is unusable as a value:

```js
/** @import { Pet } from "./types" */
```

**`@param` / `@returns`** share `@type`'s syntax, plus a name and optionality:

```js
/**
 * @param {string} p1 - required
 * @param {string=} p2 - optional (Closure syntax)
 * @param {string} [p3] - optional (JSDoc syntax)
 * @param {string} [p4="test"] - optional with a default
 * @param {Object} options - dotted names type nested params
 * @param {string} options.prop1
 * @returns {string}
 */
```

**`@typedef` / `@callback`** name a reusable object or function shape; `@typedef` also accepts a single-line TS type directly:

```js
/**
 * @typedef {Object} SpecialType
 * @property {string} prop1
 * @property {number=} prop2 - optional
 */

/** @callback Predicate
 * @param {string} data
 * @returns {boolean}
 */

/** @typedef {(data: string, index?: number) => boolean} Predicate */
```

**`@template`** declares generic parameters, with an optional constraint (only the first parameter in a list may be constrained) and default:

```js
/**
 * @template {string} K - K extends string
 * @template [T=object] - default
 * @param {K} key
 * @param {T} value
 */
```

## Classes

- Property types infer from `this.x = …` inside the constructor; annotate with `@type` before the assignment to fix or broaden it.
- `@constructor` + `@this` makes a plain function checked like a class constructor; requires a project-wide `checkJs`/jsconfig to surface the errors.
- `@extends` / `@augments {Base<Arg>}` supplies a generic base class's type argument — no `.js` syntax exists for one in an `extends` clause, so it defaults to `any` without this tag. `@extends` only targets `class`, not a constructor function.
- `@implements {Iface<Arg>}` — same gap for implementing an interface.
- `@public` (default, may be omitted), `@private`, `@protected` mirror the TypeScript keywords; none apply inside a constructor function (only real ES6 classes).
- `@readonly` — settable only during initialization.
- `@override` — checked only when `noImplicitOverride: true` is set.

## Documentation tags

- `@deprecated` — surfaces as a strikethrough/suggestion diagnostic in editors.
- `@see` — links to another name in the program.
- `@link` — same, usable inline inside other tags/prose: `{@link Box}`, `{@link Pet.hello | hello}`.

## Other

- `@enum` — Closure-style: an object literal whose members are all one type, with no other members allowed. Distinct from and simpler than TypeScript's `enum`; unlike it, `@enum`'s member type can be anything (e.g. `@enum {function(number): number}`).
- `@author` — wrap the email in `< >` or it parses as a new tag.

## Legacy type synonyms

Aliases kept for compatibility with old JSDoc, resolved by name regardless of TypeScript's own meaning for the capitalized form:

| Written                                                    | Means                                                      |
| :--------------------------------------------------------- | :--------------------------------------------------------- |
| `String`, `Number`, `Boolean`, `Void`, `Undefined`, `Null` | `string`, `number`, `boolean`, `void`, `undefined`, `null` |
| `function`                                                 | `Function`                                                 |
| `array`                                                    | `Array<any>`                                               |
| `promise`                                                  | `Promise<any>`                                             |
| `Object`, `object`                                         | `any`                                                      |

The last four (`function`, `array`, `promise`, `Object`/`object` → `any`) are turned off under `noImplicitAny: true` — `object`/`Object` fall back to their real built-in meaning, `array`/`promise` become unresolved unless declared somewhere in the program.

## Unsupported / different-meaning patterns

- Postfix `=` inside an object literal type (`{ a: string, b: number= }`) does not mark `b` optional — TypeScript ignores it. Use postfix `?` on the name instead: `{ a: string, b?: number }`.
- A nullable-type JSDoc annotation only has meaning under `strictNullChecks`; TypeScript exposes no separate "nullable" marker — `strictNullChecks: true` makes a bare `number` non-null and a unioned `number | null` nullable, `false` makes every type nullable regardless of what's written.
- Non-nullable markers are a no-op — the type is treated exactly as written, with no separate "definitely not null" state to express.
- Unsupported tags (e.g. `@async`) are silently ignored, not errored.

## Symptom → fix

| Symptom                                                              | Fix                                                                                                                                 |
| :------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| Annotations present but no errors ever appear                        | Set both `allowJs` and `checkJs` (tsconfig/jsconfig) — `checkJs` alone is a no-op — or add `// @ts-check` as the file's first line. |
| `this.x` usable but untyped / always `any`                           | No constructor assignment sets it — add `/** @type {T} */` above one `this.x = …` line, or add one in the constructor.              |
| `new Base()` subclass loses `Props`/`State` type arguments           | Add `@extends {Base<Props, State>}` (or `@augments`) — `.js` `extends` has no syntax for the argument, so it defaulted to `any`.    |
| Calling a function-based constructor without `new` isn't flagged     | Add `@constructor` (and ensure the class isn't also callable — `@constructor` and callable can't combine).                          |
| `@override` typo'd method name never errors                          | Set `noImplicitOverride: true` — the tag is inert without it.                                                                       |
| Object literal accepts a typo'd extra property                       | Give the variable a JSDoc `@type`/`@typedef` — unannotated object literals in `.js` carry an implicit index signature.              |
| `let x = null; x.push(1)` doesn't error even with `strictNullChecks` | `null`/`undefined`/`[]` initializers are `any`/`any[]` by design in `.js` — annotate with `@type` to get real checking.             |
| Function callable with too few args, no error                        | Expected — `.js` parameters are optional by default. Too many args still errors either way.                                         |
| `arguments`-based var-arg function always types args `any`           | Add `@param {...T} args`.                                                                                                           |
| Generic call infers `any` for a type parameter                       | Supply the argument explicitly, or fix the call site so inference has a source to draw from.                                        |
