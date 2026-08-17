---
name: tsconfig
description: Configure a tsconfig.json by runtime — pick module, moduleResolution, target, strict, and emit for a bundler, Node, library, or browser-ESM project, and fix the module/strict/emit errors a wrong config causes. Use when setting up or editing a tsconfig.json, choosing module or moduleResolution, adding project references for a monorepo, or resolving TypeScript module-resolution / verbatimModuleSyntax / declaration / strict errors. Not for bundler config files (vite.config, webpack.config) themselves — only the TypeScript compiler options.
user-invocable: false
metadata:
  category: reference
---

# tsconfig by runtime

A tsconfig.json is **runtime-driven**: `module`, `moduleResolution`, `target`, `strict`, and `emit` follow where the output runs, not preference. One tsconfig represents **one environment** — server code, DOM code, worker code, tests each get their own, connected with [project references](#project-references-for-monorepos). Run this guide once per tsconfig.

## How to use

1. Identify the runtime the output of _this_ tsconfig runs in (bundler / Node / library / browser-ESM).
2. Apply the matching row of the [decision table](#runtime-decision-table), then every [library rule](#library-specific-rules) or [project-reference](#project-references-for-monorepos) rule that applies.
3. Set each of `module`, `moduleResolution`, `target`, `strict`, `emit` with a one-line reason; drop anything an [implied value](#implied-values-dont-set-redundantly) already provides.

Done when all five are set with a stated reason and no implied value is set redundantly.

## Principle

- **Resolution is infectious or portable.** `moduleResolution: "bundler"` is _infectious_ — it permits extensionless imports that only a bundler can resolve, so the emitted code breaks in Node. `moduleResolution: "nodenext"` is _portable_ — code that resolves in Node almost always resolves in bundlers too. Default to portable unless a bundler owns emit.
- **Libraries compile under the strictest settings.** A consumer's config is unknowable; satisfying the strictest satisfies all. See [library rules](#library-specific-rules).
- **`target` downlevels, and implies `lib`.** It decides which JS features are rewritten vs left intact, and the default ambient type definitions. Pick the _lowest_ environment you must support.
- **`module` drives resolution and interop, not just emit.** Even with `noEmit`, TS type-checks against the module format it _would_ emit — so `module` shapes the types you see on imports.

## Runtime decision table

| Runtime                  | `module`                         | `moduleResolution` | `target`                           | `strict` | emit                                                                                      |
| :----------------------- | :------------------------------- | :----------------- | :--------------------------------- | :------- | :---------------------------------------------------------------------------------------- |
| Bundler (app)            | `esnext` (or `preserve`)         | `bundler`          | `esnext`, or your bundler's target | `true`   | `noEmit: true` (or `emitDeclarationOnly`)                                                 |
| Node (compile + run)     | `nodenext`                       | implied `nodenext` | implied `esnext`                   | `true`   | default; `verbatimModuleSyntax: true`                                                     |
| Library                  | `node18` (lowest Node supported) | implied `node18`   | `es2020` (lowest ES supported)     | `true`   | `declaration`, `declarationMap`, `sourceMap`, `rootDir`, `outDir`, `verbatimModuleSyntax` |
| Browser-ESM (no bundler) | `nodenext`                       | implied `nodenext` | `esnext` or browser baseline       | `true`   | default, or `noEmit` if another tool emits                                                |

Why each row:

- **Bundler.** The bundler resolves and emits; TS only type-checks, so `noEmit` and `bundler` resolution (extensionless imports, package `exports`/`imports`). Set `verbatimModuleSyntax: true` (or `isolatedModules`) so single-file transpilers in the pipeline stay safe. Avoid `"type": "module"` and `.mts` here — some bundlers' ESM/CJS interop can't be modeled under `bundler` resolution (TS issue #54102). Use `preserve` instead of `esnext` only if a file genuinely mixes `import` and `require`.
- **Node.** `nodenext` picks CJS vs ESM per file from the extension and the nearest `package.json` `"type"`, and enforces Node's resolution rules (extensions required on ESM relative imports). For ESM output, set `"type": "module"` or use `.mts`. Pin a specific Node version by `extends`-ing `@tsconfig/nodeNN` instead of relying on the floating `esnext` target.
- **Library.** Portable by default: `node18` resolution + `.js` extensions in relative imports work in Node _and_ bundlers. `target`/`module` set to the _lowest_ you support so emitted code and `.d.ts` globals don't assume newer runtimes. See [library rules](#library-specific-rules) for the full strictness/emit set.
- **Browser-ESM, no bundler.** No dedicated option; `nodenext` ESM rules approximate browser ESM (they enforce extensions). Use `paths` to stand in for import maps — point `https://esm.sh/pkg` at local `@types`, or map `"*"` to an empty file to reject unlisted bare specifiers.

## Implied values (don't set redundantly)

Setting these explicitly is noise and can drift from the option that drives them:

- `module: "nodenext"` ⇒ `moduleResolution: "nodenext"`, `esModuleInterop: true`, `target: "esnext"`
- `module: "node20"` ⇒ `target: "es2023"`
- `module: "preserve"` ⇒ `moduleResolution: "bundler"`, `esModuleInterop: true`
- `composite: true` ⇒ `declaration: true`, `incremental: true`, `rootDir` = the tsconfig directory
- `verbatimModuleSyntax: true` ⇒ `isolatedModules: true`
- `esModuleInterop: true` ⇒ `allowSyntheticDefaultImports: true`
- `target` ≥ `ES2022` ⇒ `useDefineForClassFields: true`

## Library-specific rules

Libraries are different: the consumer's config is unknown, so compile under the **strictest** settings — satisfying them tends to satisfy all others.

1. **`strict: true`, especially `strictNullChecks`.** Type-level constructs land in emitted `.d.ts` and only error under strict. `interface Sub extends Super { foo: string | undefined }` is an error _only_ with `strictNullChecks`; a consumer with strict on will hit it. Code rarely errors _only_ when strict is off, so strict is safe to impose.
2. **Portable imports: write `.js` extensions.** `export * from "./utils.js"` works in Node _and_ bundlers; `export * from "./utils"` only works in bundlers (infectious). `module: "node18"` enforces this.
3. **`module: "node18"`, not `bundler`.** Bundler resolution is infectious — it lets through code that crashes in Node with `ERR_MODULE_NOT_FOUND ... Did you mean to import ./utils.js?`.
4. **`verbatimModuleSyntax: true`.** Guarantees portability regardless of the consumer's `esModuleInterop` (imports that work only with or only without it are rejected), and blocks `export default` in modules emitted as CommonJS, which would force Node-ESM and bundler consumers to consume the module differently.
5. **`declaration: true`** emits the `.d.ts` consumers need for types. **`declarationMap` + `sourceMap`** add Go-To-Definition and debugging back to your `.ts` source — only useful if you ship the source; both trade library size for DX, your call.
6. **`rootDir` + `outDir` separate** (e.g. `src` → `dist`). _Necessary_ if you publish source: without it, extension substitution makes consumers load your `.ts` instead of `.d.ts`, causing type errors and slowdowns.
7. **Prefer not to bundle.** If you do bundle, your bundler must bundle _declarations_ too — otherwise `.d.ts` files keep extensionless imports that error under a `nodenext` consumer and infect referenced types with `any`. If your bundler can't bundle declarations, use `moduleResolution: "nodenext"` so the declarations stay consumer-safe.
8. **Dual-emit (CJS + ESM from one compile) is not provably type-safe.** A single compilation checks one output; dependencies can expose different APIs to CJS vs ESM. If you dual-emit, test both bundles (`@arethetypeswrong/cli`) before publishing.

## Project references for monorepos

Split a large or multi-environment program into smaller projects, each with its own tsconfig, connected with `references`. Gains: faster incremental builds, enforced layering, per-environment options.

- **`references`** — top-level array: `{ "references": [{ "path": "../src" }] }`. Importing from a referenced project loads its _output_ `.d.ts`, not its source.
- **`composite: true`** on every referenced project. It implies `declaration: true` and `incremental: true`, defaults `rootDir` to the tsconfig directory, and _requires_ every implementation file to be matched by `include` or listed in `files` (tsc names anything missed).
- **Build with `tsc -b`** (build mode). It builds referenced projects in dependency order, does up-to-date checks, and effectively forces `noEmitOnError` for all projects (otherwise a stale dependency would hide its error after one build). Flags: `--verbose`, `--dry`, `--clean`, `--force`, `--watch`.
- **`declarationMap: true`** so editors' Go-To-Definition and rename cross project boundaries.
- **Solution tsconfig** at the root: `"files": []` plus `references` to every leaf project. `tsc -b` then builds the whole graph from one entry point. (Empty `files` is allowed once you have ≥1 reference.)
- **`extends`** a shared base tsconfig to centralize common `compilerOptions`; each leaf overrides only what differs. `files`/`include`/`exclude` are _overwritten_, not merged, by the inheriting config.

## Flags behind the table

- **`strict: true`** turns on the strict family (`strictNullChecks`, `noImplicitAny`, `noImplicitThis`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `strictBuiltinIteratorReturn`, `useUnknownInCatchVariables`, `alwaysStrict`). Default is `true` in modern TS. Full per-flag detail in `OPTIONS.md`.
- **`verbatimModuleSyntax: true`** — what you write is what's emitted: `type`-modified imports/exports are erased, everything else is kept. It will _not_ rewrite an `import` to `require` (or vice versa); it errors instead, forcing you to be intentional about CJS vs ESM and catching a missing `package.json` `"type"`. Replaces the deprecated `importsNotUsedAsValues` and `preserveValueImports`. Incompatible with any setup that emits both ESM and CJS from one source.
- **`isolatedModules: true`** — warns about code single-file transpilers (Babel, swc, `ts.transpileModule`) can't handle: re-exporting a type without `export { type }`, referencing ambient `const enum` members, namespaces in non-module files. Implied by `verbatimModuleSyntax`.
- **`esModuleInterop: true`** — fixes CJS/AMD/UMD interop so `import x from "cjs"` and `import * as x` behave like Babel, emitting `__importDefault`/`__importStar` helpers. Implied by `nodenext`/`preserve`. Implies `allowSyntheticDefaultImports` (which is type-checking only — it doesn't change emit).

For the full strict-family list, interop-flag mechanics, deprecated flags, and `jsx`/`lib`/emit knobs, see [`OPTIONS.md`](OPTIONS.md).

## Symptom → fix

| Symptom                                                                                                                                   | Fix                                                                                                                                                |
| :---------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ERR_MODULE_NOT_FOUND ... Did you mean to import ./utils.js?`                                                                             | Relative ESM import lacks an extension. Add `.js`. Required under `nodenext`; portable for libraries.                                              |
| `Cannot find module './settings.json'`                                                                                                    | Enable `resolveJsonModule`.                                                                                                                        |
| Default import of a CJS module errors (`import x from "cjs-mod"`)                                                                         | Enable `esModuleInterop` (implied by `nodenext`/`preserve`); or use `import * as x`.                                                               |
| `verbatimModuleSyntax`: `import`/`export` not rewritten to `require`, errors instead                                                      | Use `import x = require(...)` / `export = ...` for CJS; set `package.json` `"type"` to match intent.                                               |
| `Namespaces are not allowed in global script files when 'isolatedModules' is enabled`                                                     | Add `export {}` to the file, or set `moduleDetection: "force"`.                                                                                    |
| `This syntax is not allowed when 'erasableSyntaxOnly' is enabled` (param properties, `enum`, `namespace`, `import =`, `export =`, `<T>x`) | You target Node's native type-stripping. Rewrite the construct, or drop `erasableSyntaxOnly` and use a real transpiler.                            |
| Re-exporting a type errors under `isolatedModules` / a single-file transpiler                                                             | Mark it: `export { type Foo }` / `import type { Foo }`.                                                                                            |
| `Cannot find module '...'` on a side-effect import (`import "./x.css"`) after enabling `noUncheckedSideEffectImports`                     | Add `declare module "*.css" {}` in a global `.d.ts`.                                                                                               |
| Consumer gets `any` / declaration errors from a _bundled_ library under `nodenext`                                                        | Your bundler kept extensionless imports in `.d.ts`. Don't bundle the library, or bundle declarations too; else set `moduleResolution: "nodenext"`. |
| `verbatimModuleSyntax` can't be enabled with dual CJS+ESM emit                                                                            | Fundamentally incompatible with one compile emitting both. Emit one format per compile, or drop it.                                                |
| `allowImportingTsExtensions` can only be used with `noEmit`/`emitDeclarationOnly`                                                         | Set one of those — the bundler emits the JS.                                                                                                       |
| Library consumer errors under _their_ `strict` but not yours                                                                              | Compile the library with `strict: true`; type-level code leaks into `.d.ts` and only errors under strict (e.g. `strictNullChecks`).                |
| `exactOptionalPropertyTypes`: `Type 'undefined' is not assignable`                                                                        | Don't assign `undefined` to an optional prop; add `undefined` to its type, or omit the key.                                                        |
