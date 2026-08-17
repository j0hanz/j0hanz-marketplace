---
name: advanced-types
description: Type-level TypeScript. Use when a type resolves to any/never/unknown or refuses to narrow, when writing reusable type utilities or type tests, or when type-checking is slow or hits a depth error (ts2589).
user-invocable: false
metadata:
  category: reference
---

# Type-Level TypeScript

Type-level code has no runtime, no debugger. Compiler only oracle.

## The loop

1. **Red first.** Before type exist, write assertions: one `Expect<Equals<…>>` per case must hold, one `@ts-expect-error` per case must be rejected. Done when every `Expect<Equals>` red (tsc errors on it) and every `@ts-expect-error` line red because underlying assertion does _not_ error — no assertion vacuously passing, none vacuously silent. Assertion already passing against type not written yet tests nothing.

2. **Probe one operator at a time.** Grow type by one operator, keep probe beside it (`type _p = YourType<SampleInput>`), read what it resolves to. Done when every probe resolves to type you can name — `any`, `never`, `unknown`, `{}` mean fix the operator that made it before adding next.

3. **Green, then prove it can go red.** Done when `tsc --noEmit` clean _and_ changing any assertion's expected type turns it red again. Why `Equals` below replaces mutual-`extends` check: `[X] extends [Y] ? [Y] extends [X]` calls `any` equal to everything, so never goes red.

4. **Budget, when it bites.** On editor lag or `ts2589 Type instantiation is excessively deep and possibly infinite`, measure before rewrite — `tsc --noEmit --extendedDiagnostics` for instantiation counts, `tsc --generateTrace trace/` plus `npx @typescript/analyze-trace trace/` for hot type. Cost rules and order live in ## Budget. Done when named cost gone from second trace, not when code merely reads simpler.

### Harness

```ts
type Equals<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
type Prettify<T> = { [K in keyof T]: T[K] } & {};

type _1 = Expect<Equals<Split<'a.b'>, ['a', 'b']>>;
// @ts-expect-error — this comment errors if the line below ever stops erroring
type _2 = Expect<Equals<Split<'a.b'>, string[]>>;
```

`Equals` compares identity, not structure: `A & B` not identical to object it merges into, so intersection fails assertion that looks obviously true. Probe and assert through `Prettify` whenever one in play — also what makes tooltip print merged shape instead of operands.

## Distribution

Naked type parameter in checked position distributes over unions: conditional runs once per member, results union back.

```ts
type IsString<T> = T extends string ? 'yes' : 'no';
type A = IsString<string | number>; // "yes" | "no"  — ran twice
type B = IsString<never>; // never — empty union, ran zero times
type C = IsString<any>; // "yes" | "no" — any satisfies both branches
```

Wrap both sides in tuple to switch distribution off, test union whole:

```ts
type IsStringWhole<T> = [T] extends [string] ? 'yes' : 'no';
type D = IsStringWhole<string | number>; // "no"
type E = IsStringWhole<never>; // "yes" — never is assignable to string; only distribution made the naked version collapse to never
```

`boolean` is union `true | false`, so distributes too — `Exclude<boolean, false>` is `true`. `any` passes every constraint, so detect explicit: `type IsAny<T> = 0 extends 1 & T ? true : false`.

Conditional over parameter compiler hasn't substituted yet — inside generic function body — stays deferred instead of resolving, and neither branch assignable to deferred conditional. Assert once, at boundary:

```ts
function toBit<T extends boolean>(t: T): T extends true ? 1 : 0 {
  return (t ? 1 : 0) as T extends true ? 1 : 0; // the return is the boundary
}
```

## Homomorphic mapped types

`{ [K in keyof T]: … }` homomorphic: copies `readonly` and `?` off source property, maps arrays to arrays and tuples to tuples instead of index signature. `+`/`-` edit those modifiers.

```ts
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type Concrete<T> = { [K in keyof T]-?: T[K] };
```

Homomorphism tied to key source being literally `keyof T` (or `K extends keyof T` parameter — why `Pick` keeps modifiers). Change that source and modifiers vanish silently:

```ts
interface Row {
  readonly id: string;
  note?: string;
}
type Copy<T> = { [K in keyof T]: T[K] }; // readonly id, note?
type Rebuilt<T> = { [K in keyof T & string]: T[K] }; // id, note — both modifiers gone
```

Remap with `as` — to `never` to drop key, to template literal to rename it.

```ts
type FnKeys<T> = { [K in keyof T as T[K] extends Function ? K : never]: T[K] };
type Getters<T> = {
  [K in keyof T as `get${Capitalize<K & string>}`]: () => T[K];
};
```

`Capitalize`, `Uncapitalize`, `Uppercase`, `Lowercase` are compiler's four intrinsic string transforms — nothing else reaches inside string type. `& string` load-bearing: `keyof T` admits `symbol`, and no template literal accepts one.

`keyof` over index signature wider than it looks: `keyof { [k: string]: number }` is `string | number`.

## infer and variance

Repeat an `infer` name and its position decides how candidates combine — covariant positions union, contravariant (function parameter) positions intersect.

```ts
type Co<T> = T extends { a: infer U; b: infer U } ? U : never; // A | B
type Contra<T> = T extends { a: (x: infer U) => void; b: (x: infer U) => void } ? U : never; // A & B

type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (
  x: infer I,
) => void
  ? I
  : never;
```

Same variance rule governs assignability, and method syntax opts out: `{ on(e: E): void }` stays bivariant in parameters even under `strictFunctionTypes`, while `{ on: (e: E) => void }` contravariant. Declare callbacks as properties to get strict check.

State variance on parameter when generic gets compared over and over — `interface Box<out T>` covariant, `<in T>` contravariant, `<in out T>` invariant. Compiler checks annotation against structure, so wrong one is error not silent cast, then relates `Box<A>` to `Box<B>` by relating `A` to `B` instead of walking members.

Constrain inline (`infer H extends string`) instead of second conditional to re-narrow.

Template-literal inference non-greedy — first placeholder takes shortest match:

```ts
type Head<S> = S extends `${infer H}.${infer R}` ? [H, R] : never;
type X = Head<'a.b.c'>; // ["a", "b.c"]
```

## Values as types

`typeof` lifts value into type space. Takes identifier or property path, never expression — call's result comes back through `ReturnType<typeof f>`.

```ts
const config = { mode: 'dark', retries: 3 } as const;
type Key = keyof typeof config; // "mode" | "retries"
type Mode = (typeof config)['mode']; // "dark"

const roles = ['admin', 'user'] as const;
type Role = (typeof roles)[number]; // "admin" | "user"
```

`as const` plus `[number]` is type-level `enum`: array stays one source of values, and unlike `enum` emits no runtime object.

Indexed access distributes over key union — `T["a" | "b"]` is `T["a"] | T["b"]`, so `T[keyof T]` is every value type — and reading optional property carries absence with it: `{ a?: string }["a"]` is `string | undefined`.

## Widen and narrow

Widening happens at binding, not at literal: `const s = "on"` stays `"on"`, `let s = "on"` becomes `string`, object literal's properties widen under both unless literal frozen with `as const`. Three more tools stop it further out.

```ts
const routes = { home: '/' } satisfies Record<string, `/${string}`>; // checked, stays "/"
declare function tuple<const T extends readonly unknown[]>(...xs: T): T; // literal inference at the call site
declare function pick<T>(xs: T[], fallback: NoInfer<T>): T; // one site excluded from inference
```

Literal union that also admits own supertype collapses into it — `"dark" | "light" | string` is `string`, autocomplete and all. Intersect wide member to keep literals: `"dark" | "light" | (string & {})`.

Narrowing follows control flow, which makes it survive less than expected in some places, more in others:

- `const` holding the test narrows at `if` (`const isStr = typeof x === "string"`), provided nothing reassigns subject.
- Narrowed _property_ (`o.a`) back to declared type inside any callback, `readonly` or not; narrowed _variable_ survives into one as long as nothing assigns it after. Pin property to `const`, close over that.
- TS 5.5 infers `x is T` for function whose body is narrowing expression, so `xs.filter(x => x !== null)` yields narrowed array, no hand-written predicate.
- `switch` or `if`-chain missing a union member doesn't error — return type silently gains `| undefined`. Assign scrutinee to `never` in default branch (`const _: never = s`) to make missing case compile error.
- `asserts x is T` requires explicit type annotation on every name in call target (`ts2775`) — inferred `const assertIsUser = …` silently fails to assert.
- Excess-property checks fire on fresh object literals only; same object assigned through variable passes with extra properties.

## Brands

Type alias transparent: `type UserId = string` accepts every string, two aliases of one shape stay interchangeable. Intersect phantom key to make type nominal — then nothing produces it but assertion, so keep that assertion in the one function that validates.

```ts
declare const brand: unique symbol;
type Brand<T, B> = T & { readonly [brand]: B };

type UserId = Brand<string, 'UserId'>;
const toUserId = (s: string): UserId => {
  if (!s.startsWith('u_')) throw new Error(`not an id: ${s}`);
  return s as UserId; // the validator is the boundary
};
```

## Budget

Recursion: conditional type whose recursive call _is_ the branch gets tail-eliminated, runs ~1000 deep; wrap that call in anything — template literal, tuple, another conditional — and ceiling drops to ~100.

```ts
type Join<T extends string[], Acc extends string = ''> = T extends [
  infer H extends string,
  ...infer R extends string[],
]
  ? Join<R, `${Acc}${H}`> // tail position: accumulate in a parameter
  : Acc;
```

Cost, in order it usually bites:

- `interface` by default for object shapes — compiler caches interface's relationship checks and names it in errors, while alias built with `&` re-elaborates at every use. Reach for `type` when shape can't be interface: union, tuple, mapped, conditional.
- Annotate return types on exported functions so declaration emit doesn't re-infer them.
- Union × union comparison costs the product; shared base type collapses it. Template literal over unions _materialises_ that product as members, and past ~100k compiler quits outright with ts2590 `Expression produces a union type that is too complex to represent` — match wide side with `infer` instead of enumerating it.
