# tsconfig option reference

Disclosed reference for [`SKILL.md`](SKILL.md). Consulted on demand — the strict-family list, interop-flag mechanics, deprecated flags, and `jsx`/`lib`/emit knobs the decision table doesn't need inline.

## strict family

`strict: true` enables all of these; each can be turned off individually. Default is `true` in modern TS.

- `strictNullChecks` — `null`/`undefined` get distinct types; errors when used where a concrete value is expected. The one that leaks into library `.d.ts`.
- `noImplicitAny` — errors when a type would be inferred `any`.
- `noImplicitThis` — errors on `this` with implied `any`.
- `strictFunctionTypes` — checks function parameters contravariantly (method syntax is exempt).
- `strictBindCallApply` — type-checks `call`/`bind`/`apply` arguments.
- `strictPropertyInitialization` — errors on class properties unset in the constructor.
- `strictBuiltinIteratorReturn` — built-in iterators instantiate `TReturn` as `undefined`, not `any`.
- `useUnknownInCatchVariables` — `catch` variable is `unknown`, not `any`.
- `alwaysStrict` — parses in ECMAScript strict mode; emits `"use strict"`.

Adjacent strict-ish flags (not in `strict`, set explicitly):

- `noUncheckedIndexedAccess` — adds `undefined` to index-signature lookups.
- `exactOptionalPropertyTypes` — forbids assigning `undefined` to an optional (`?`) property.
- `noImplicitOverride` — requires `override` on methods that override.
- `noImplicitReturns` — errors on code paths missing a return.
- `noFallthroughCasesInSwitch` — errors on switch case fallthrough.
- `noUnusedLocals` / `noUnusedParameters` — errors on unused locals/params (underscore-prefixed params exempt).

## Interop flags in depth

- **`esModuleInterop`** — without it, TS treats CJS/AMD/UMD like ES modules: `import * as x` ≈ `const x = require()` and `import x` ≈ `require().default`, both flawed. With it, `__importDefault`/`__importStar` helpers fix emit and a namespace import only sees _owned_ properties (use a default import, or disable interop, if the module exposes API via the prototype chain). Implies `allowSyntheticDefaultImports`.
- **`allowSyntheticDefaultImports`** — lets you `import x from "cjsMod"` when there's no real default export. Type-checking only; changes no emit. Default `true` under `esModuleInterop`, `module: "system"`, or `moduleResolution: "bundler"`.
- **`verbatimModuleSyntax`** — disables import elision: no `type` modifier ⇒ kept; `type` modifier ⇒ erased. Won't rewrite `import`↔`require` (errors instead). Only sound when the JS emitter emits the same module kind `tsc` would, given the tsconfig, file extension, and `package.json` `"type"` — so any dual ESM+CJS emit, or a third-party emitter configured to emit a different kind than `tsc` would (e.g. Babel emitting CJS while tsconfig says `esnext`), defeats it. Implies `isolatedModules`. Replaces `importsNotUsedAsValues` + `preserveValueImports`.
- **`isolatedModules`** — warns about constructs a per-file transpiler can't handle: re-exporting a name that's only a type (use `export { type X }`), referencing ambient `const enum` members (no `Numbers` object exists at runtime for them to inline), namespaces in non-module files. Doesn't change emit.
- **`erasableSyntaxOnly`** — for Node's native type-stripping (v23.6+): errors on `enum`, runtime `namespace`/`module`, class parameter properties, `import =`/`export =`, and `<T>` assertions. Pair with `verbatimModuleSyntax`.

## Emit flags

- `noEmit` — no JS/sourcemap/declarations; for when Babel/swc handles emit. Pair with `allowImportingTsExtensions`.
- `emitDeclarationOnly` — only `.d.ts`; for when another tool emits JS, or you only ship types.
- `declaration` — emit `.d.ts`. Default `true` under `composite`.
- `declarationMap` — source map for `.d.ts` (Go-To-Definition to `.ts`); strongly recommended with project references.
- `sourceMap` / `inlineSourceMap` — external `.js.map` vs embedded; mutually exclusive. `inlineSources` embeds the `.ts` source too (requires a sourceMap mode).
- `outDir` — output directory; source tree structure preserved (see `rootDir`).
- `rootDir` — source root; enforces all emitted files sit under it. Default: longest common path of non-declaration inputs, or the tsconfig dir under `composite`.
- `importHelpers` — import downleveling helpers from `tslib` instead of inlining them (cuts duplication).
- `downlevelIteration` — accurate `for..of`/spread when targeting ES5 (needs `Symbol.iterator` present at runtime).
- `noEmitOnError` — skip emit on error. Default `false`, but `tsc -b` forces it on.
- `removeComments` — strip comments from emit.
- `preserveConstEnums` — keep `const enum` at runtime; default `true` under `isolatedModules`.

## Module / resolution extras

- `module: "preserve"` (TS 5.4) — each import/export keeps its written format; `import = require`/`export =` still emit as CJS. Best matches bundlers and Bun. Implies `moduleResolution: "bundler"`, `esModuleInterop`.
- `moduleResolution: "node10"` (aka `node`) — Node <10, CJS only. Avoid in modern code. `classic` — pre-1.6, don't use.
- `moduleDetection` — `auto` (default: imports/exports, `package.json` `"type": "module"`, or `jsx: react-jsx` ⇒ module), `legacy` (4.6-and-prior: only imports/exports), `force` (every non-declaration file is a module).
- `paths` — remap specifiers to locations; **doesn't change emit**, only tells TS another tool resolves at runtime/bundle. As of TS 4.1 no longer needs `baseUrl`.
- `customConditions` — extra `package.json` `exports`/`imports` conditions (e.g. `["module"]` to prefer ESM source). Valid only under `node16`/`nodenext`/`bundler`.
- `allowImportingTsExtensions` — import `.ts`/`.mts`/`.tsx`; requires `noEmit` or `emitDeclarationOnly`.
- `allowArbitraryExtensions` — import non-JS/TS extensions via a `name.d.{ext}.ts` declaration (e.g. CSS modules).
- `resolveJsonModule` — import `.json` with inferred types.
- `baseUrl` — legacy AMD-loader feature; not needed for `paths` since 4.1, not recommended elsewhere.

## jsx

Controls JSX emit from `.tsx`. `react-jsx` (automatic runtime, production), `react-jsxdev` (automatic, dev), `react` (classic `React.createElement`), `react-native` / `preserve` (JSX unchanged). `jsxImportSource` (default `react`) sets the runtime module for the automatic modes; `jsxFactory`/`jsxFragmentFactory` override the classic factory (e.g. `h`/`Fragment` for Preact). Per-file overrides: `/* @jsxImportSource preact */`, `/* @jsx h */`.

## lib

`target` implies a default `lib`. Override when: you don't run in a browser (drop `DOM`), your runtime polyfills some but not all of a higher ES version, or you need `WebWorker`/`ScriptHost` APIs. High-level entries (`ES2020`, `ES2022`, …) are _additional_ to `ES5`; list what you need plus `DOM` only for browser code. `libReplacement` lets `@typescript/lib-*` packages override built-ins.

## Deprecated / replaced

- `importsNotUsedAsValues`, `preserveValueImports` → `verbatimModuleSyntax`
- `out` → `outFile`
- `skipDefaultLibCheck` → `skipLibCheck`
- `charset` → (no-op; TS assumes UTF-8)
- `keyofStringsOnly`, `noImplicitUseStrict`, `noStrictGenericChecks`, `suppressExcessPropertyErrors`, `suppressImplicitAnyIndexErrors` → avoid; use `@ts-ignore` for one-offs
- `diagnostics` → `extendedDiagnostics`
- `reactNamespace` → `jsxFactory`

## Completeness / perf

- `skipLibCheck: true` — skip type-checking `.d.ts` (recommended; saves time). If two copies of a lib's types clash, dedupe with resolutions rather than masking the real conflict.
- `forceConsistentCasingInFileNames` — default `true`; errors on import casing that differs from disk.
- `composite` / `incremental` / `tsBuildInfoFile` — see project references in `SKILL.md`.
- `disableSourceOfProjectReferenceRedirect`, `disableSolutionSearching`, `disableReferencedProjectLoad` — editor-responsiveness knobs for very large composite projects.
