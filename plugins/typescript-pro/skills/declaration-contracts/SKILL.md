---
name: declaration-contracts
description: Declaration contracts for packages and untyped JavaScript APIs. Use when authoring, repairing, testing, augmenting, or publishing .d.ts files; model runtime exports, globals, callbacks, overloads, and package type entry points. Not for purely type-level utilities or tsconfig selection.
user-invocable: false
metadata:
  category: reference
---

# Declaration contracts

A `.d.ts` is a contract for JavaScript that already runs. Runtime behavior is the authority; types make its valid use precise and invalid use fail early.

## 1. Map the runtime surface

Inspect the library's actual exports, import forms, globals, callable values, constructors, callbacks, mutations, and supported subpaths. Classify its entry point before declaring it:

- `module.exports = value` maps to `export = value`; attach static members with a merged `declare namespace`.
- ESM named/default exports map to matching `export` declarations.
- A runtime global maps to `declare const`, `declare function`, `declare class`, or `declare namespace` in a global script declaration.
- A module supplied by the runtime but lacking a file maps to an ambient `declare module "name"`.
- An existing module extended by an application or plugin maps to a module augmentation.

An ambient `declare module` must live in a script declaration. A top-level import or export makes its file a module, where the same syntax augments an existing module instead. Keep imports needed only by an ambient module inside its declaration.

Done when every public runtime entry point, export shape, and supported import form has one matching declaration target.

## 2. Encode observable behavior

Write the smallest declarations that preserve how callers can use the API.

- Use primitive `string`, `number`, `boolean`, `symbol`, and `object` types.
- Model unexamined inputs as `unknown`; validate or narrow them where runtime code does.
- Mark a property optional when its key can be absent. Include `undefined` in its value type when the present key accepts `undefined`.
- Give a callback a required parameter when the library supplies it on every call; consumers may still omit unused callback parameters.
- Use a union for alternatives with one return type. Use overloads when return type or accepted behavior depends on the input, ordered most-specific to most-general because TypeScript selects the first match.
- Export types and values along the same paths the runtime exposes. Use `import type` and `export type` for declaration-only bindings.

Done when each declaration represents a runtime-observable capability, constraint, or result without inventing a value or hiding a valid call.

## 3. Prove the consumer contract

Create a small consumer fixture and type-check it with the project's normal TypeScript command, or `tsc --noEmit` when no narrower command exists. Exercise every public entry point through its published specifier, not an internal source path.

Make the fixture prove three things:

1. Representative valid runtime calls compile and infer the intended result.
2. Representative invalid calls carry `@ts-expect-error` and fail for the intended reason.
3. Runtime-sensitive choices are covered: overload selection, optional-key behavior, callbacks, CJS/ESM import form, globals, or augmentation as applicable.

Each `@ts-expect-error` must guard a line that genuinely errors; the compiler reports stale directives. For reusable type assertions, use the test harness from `advanced-types` rather than copying an equality helper.

Done when every public surface has a valid-use proof and each meaningful restriction has a red proof that fails if the declaration becomes too broad.

## 4. Ship the declarations consumers resolve

Generated declarations belong with their source package. Point `package.json` `types` at the root declaration file and give each exported subpath a matching `types` condition when the package uses `exports`.

```json
{
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./plugin": {
      "types": "./dist/plugin.d.ts",
      "import": "./dist/plugin.js"
    }
  }
}
```

Place declaration packages exposed through the public contract in `dependencies`, so consumers resolve them. Submit independently authored declarations for a third-party package to DefinitelyTyped for `@types` publication.

Type-check the packed or installed package from a clean consumer fixture under the module modes the package supports. Test ESM and CommonJS entry points separately when both are published.

Done when every documented package specifier resolves to the declaration alongside its runtime file from an installed artifact.
