---
name: jsdoc-types
description: Type-check plain .js files using JSDoc comments instead of migrating to TypeScript. Use when enabling or debugging checkJs/allowJs/`// @ts-check`, adding @type/@param/@typedef/@template annotations, typing a constructor function or ES6 class through JSDoc, or fixing a checkJs-only error (open-ended object literal, optional-by-default parameter, any-typed null/[] initializer). Not for .d.ts files shipped with a package (declaration-contracts), tsconfig option selection beyond checkJs/allowJs (tsconfig), or type-level generic utilities (advanced-types).
metadata:
  category: reference
---

# Typed JavaScript with JSDoc

A `.js` file has no `.ts` syntax available — every annotation lives in a comment, and everything left unannotated infers looser than the same code would in `.ts`.

## Turn checking on

Project-wide: `allowJs: true` plus `checkJs: true` in `tsconfig.json`/`jsconfig.json` — `checkJs` alone does nothing, since `.js` files aren't in the program without `allowJs`. Per-file: `// @ts-check` as the first line, `// @ts-nocheck` to exempt one file from a project-wide `checkJs`. Errors are silent without these even when annotations are present.

## The loop

1. **Model the shape.** `@type` for a variable's type; `@param`/`@returns` for a function's signature (`@param {string} [p]` marks it optional, `@param {string} [p="x"]` gives a default); `@typedef`/`@callback` for a shape reused across signatures; `@template` for a generic, `@template {string} K` to constrain it, `@template [T=object]` to default it. Reference a type from another file with `@import {Pet} from "./types"` or inline `import("./types").Pet` — neither imports at runtime, only into the type space. Full tag syntax in [REFERENCE.md](REFERENCE.md#type-tags).

   Done when every exported function and object has a `@param`/`@returns`/`@type` naming a concrete type, none left to bare inference.

2. **Anchor classes and constructor functions.** A property's type is inferred from every `this.x = …` assignment inside the constructor; assignments only in methods are optional, and a property never assigned is untyped. Precede an assignment with `/** @type {string | undefined} */` where the constructor sets it to `null`/`undefined`/nothing meaningful. `@constructor` plus `@this` makes a plain function checked as a class. There is no `.js` syntax for a type argument in an `extends`/`implements` clause — use `@extends`/`@augments {Base<Arg>}` and `@implements {Iface<Arg>}`, or the argument silently defaults to `any`. `@override` needs `noImplicitOverride: true` in tsconfig to actually be checked.

   Done when every class field, base-class generic argument, and access modifier (`@public`/`@private`/`@protected`/`@readonly`/`@override`) is declared rather than left to inference.

3. **Close the loose defaults.** `.js` relaxes checks `.ts` enforces; each is closed by one explicit annotation:
   - object literal is open-ended (implicit `[x: string]: any`) unless the variable it initializes carries a JSDoc type
   - a `null`/`undefined`/`[]` initializer types as `any`/`any[]` regardless of `strictNullChecks`, unless annotated
   - every parameter is optional — calling with fewer arguments never errors — unless the function carries `@param`; calling with _more_ arguments than declared still errors either way
   - a function body referencing `arguments` gets an implicit `(...args: any[]) => any`; `@param {...number} args` types it
   - a type argument the compiler can't infer (unconstrained generic call, or the extends-clause case above) defaults to `any`

   Done when a `checkJs` run shows no gap from this list — each object literal, nullable initializer, parameter list, and generic call site carries an explicit type instead of the JS-mode default.

4. **Prove it.** Run the project's `tsc`/editor diagnostics with `checkJs` on. `// @ts-expect-error` works in `.js` exactly as in `.ts` — put it above a call or assignment that must fail; the compiler flags the directive itself if the line stops erroring.

   Done when checking reports zero unintended errors and every `@ts-expect-error` line genuinely fails without its directive.

## Casts, satisfies, const

- `/** @type {T} */ (expr)` — the only cast syntax available in `.js` (no `as` operator); parenthesize `expr`.
- `/** @satisfies {T} */ (expr)` — checks against `T` without widening `expr`'s own inferred type, same as the `satisfies` operator.
- `/** @type {const} */ (expr)` — JSDoc equivalent of `as const`.

## Reference

Tag-by-tag syntax, legacy Closure type synonyms, patterns JSDoc supports that TypeScript doesn't (and vice versa), and a symptom → fix table: [REFERENCE.md](REFERENCE.md).
