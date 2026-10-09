# Plan 003: Widen the telltale redaction net

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report, do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f3e7fb0..HEAD -- plugins/telltale/`
> Plan 002 (check gate) is expected to have landed first and to have
> rewritten the character classes in `lib.ts` lines 66 to 96 into lint-clean
> form (`\w` where a class covers letters, digits and underscore). This
> plan's excerpts show the pre-002 spellings. If plan 002 has NOT landed,
> land it first: this plan adds regexes to the same lines, and writing them
> lint-clean from the start avoids re-fixing. If the code differs from both
> shapes, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW, every addition is a fixed literal prefix plus a length
  floor, the same false-positive profile as the existing entries; the two
  field names are unambiguous credential names
- **Depends on**: plans/002-telltale-check-gate.md (soft: land it first so
  the new patterns are written lint-clean)
- **Category**: security
- **Planned at**: commit `f3e7fb0`, 2026-10-09

## Why this matters

Telltale writes every MCP tool call's arguments and result text to local
JSONL logs, and the README promises those logs are redacted first. The
redaction engine misses several shapes that are exactly its job:

- Token prefixes not in the pattern list: GitLab personal access tokens
  (`glpat-`), Stripe live secret and restricted keys and webhook signing
  secrets (`sk_live_`, `rk_live_`, `whsec_`), AWS temporary STS access key
  IDs (`ASIA` beside the covered `AKIA`), and npm tokens (`npm_`).
- The `Bearer ` match is case-sensitive, so a result dumping
  `authorization: bearer <token>` (lowercase, legal HTTP) keeps the token.
- Two field names absent from the field list: `secret_key` (OAuth
  client style) and `passphrase` (SSH/PGP style). The match is exact after
  squashing, so `secret_key` never matches `secret`.

All of these reach every log sink: `args`, `head`/`tail`, the
`fullPayloads` text, and `usedInAnswer` (whose values pass through the same
engine). Users share these files on the strength of the README's promise.

Also folded in, from the same audit: a test gap (the redaction recursion's
array branch has zero tests, while MCP args are routinely nested arrays)
and a doc gap (the two-level JSON escaping ceiling is noted in code but not
in the README's Redaction section).

## Current state

- `plugins/telltale/hooks/lib.ts`, the redaction engine. Field names
  (lines 39–57), exactly as written today (this list is what `squash`
  compares against, so a name is matched only by its exact squashed form):

  ```ts
  const SECRET_FIELDS = [
    'password',
    'passwd',
    'secret',
    'token',
    'api_key',
    'x_api_key',
    'authorization',
    'access_token',
    'refresh_token',
    'id_token',
    'auth_token',
    'session_token',
    'client_secret',
    'private_key',
    'aws_secret_access_key',
    'cookie',
    'set_cookie',
  ];
  ```

  The pattern list and the bearer rule (lines 66–76):

  ```ts
  const SECRET_PATTERNS = [
    /sk-ant-[A-Za-z0-9_-]{20,}/,
    /sk-[A-Za-z0-9_-]{20,}/,
    /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}/,
    /github_pat_[A-Za-z0-9_]{22,}/,
    /AKIA[0-9A-Z]{16}/,
    /xox[abpr]-[A-Za-z0-9-]{10,}/,
    /AIza[0-9A-Za-z_-]{35}/,
    /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
  ].map((pattern) => new RegExp(NOT_AFTER + pattern.source, 'g'));
  const BEARER = new RegExp(`${NOT_AFTER}(Bearer )[A-Za-z0-9._~+/=-]{8,}`, 'g');
  ```

  Every array member is wrapped with the `NOT_AFTER` lookbehind guard
  automatically by that `.map`, so new entries get it for free.

  The recursion whose array branch is untested (lines 99–111, plus the
  sibling recursion `mapStrings` at 117–126 used by `cutArgs`):

  ```ts
  export const redact = (value: unknown): unknown => {
    if (typeof value === 'string') return redactText(value);
    if (Array.isArray(value)) return value.map(redact);
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, inner]) => [
          key,
          SECRET_KEYS.has(squash(key)) ? '[redacted]' : redact(inner),
        ]),
      );
    }
    return value;
  };
  ```

- `plugins/telltale/README.md`, the "Redaction" section (lines 141–156)
  lists the patterns and field names in prose and states the JSON-text
  rule. It does not state the two-level escaping ceiling that the code
  records at `lib.ts:77–80` ("ponytail: deeper escaping and non-string
  values are not matched").

- `plugins/telltale/tests/lib.test.ts`, the R14 test block (lines 80–176)
  is the place to extend. Idiom:

  ```ts
  test('R14: secret patterns in strings are redacted', async () => {
    const gh = 'ghp_' + 'a'.repeat(36);
    expect(redact(`token is ${gh} ok`)).toBe('token is [redacted] ok');
    expect(redact('Authorization: Bearer abcdefgh1234')).toBe('Authorization: Bearer [redacted]');
  ```

  The field-name list test (lines 140–155) builds an object from a names
  array and asserts every value becomes `'[redacted]'`, both as an object
  and as JSON text.

- `plugins/telltale/.claude-plugin/plugin.json`, `"version": "0.3.1"`.

Deliberately NOT added, so you do not "helpfully" include them:
`pk_live_` (Stripe publishable keys are not secrets, they are designed to
be public), and `Basic` auth (a settled rejection, it matches prose such as
"Basic configuration").

## Commands you will need

| Purpose          | Command                       | Expected on success                                       |
| ---------------- | ----------------------------- | --------------------------------------------------------- |
| Plugin tests     | `npm run validate`            | exit 0, runs `claude plugin test` including the new tests |
| Full gate        | `npm run check`               | exit 0                                                    |
| Lint plugin only | `npx eslint plugins/telltale` | exit 0 (0 problems)                                       |

`npm run check` regenerates `site/src/data/marketplace.json` and the root
README's generated regions from the plugin manifest, so the version bump
propagates through the gate; commit the regenerated files.

## Scope

**In scope** (the only files you should modify):

- `plugins/telltale/hooks/lib.ts`, the two lists plus the `BEARER` rule
- `plugins/telltale/tests/lib.test.ts`, new test blocks
- `plugins/telltale/README.md`, the "Redaction" section and the `call`
  record table only if a wording becomes wrong
- `plugins/telltale/.claude-plugin/plugin.json`, the version
- Root `README.md`, `site/src/data/marketplace.json`, only as regenerated

**Out of scope** (do NOT touch):

- `hooks/register.tsx`, the sinks already call `redact` correctly before
  every cut and slice (verified in the audit: `register.tsx:175,182,187-190`)
- The `NOT_AFTER` guard, `JSON_FIELD`, `ESCAPED_FIELD` internals
- Env-dump, YAML and Python-repr formats (a `TOKEN=…` line in result text
  is a recorded, deliberate gap; a future plan decides whether to add an
  anchored rule or a README sentence)
- `usedInAnswer`'s value extraction

## Git workflow

- Branch: `telltale/plan-003-redaction`
- Conventional subject, e.g. `fix(telltale): redact more token shapes and
field names`
- Do NOT push or open a PR unless the operator instructed it

## Steps

### Step 1: Add the missing prefixes and field names to `lib.ts`

Add to `SECRET_PATTERNS` (spelled in post-002 lint-clean form where a class
covers letters, digits and underscore; keep exact classes otherwise):

```ts
    /glpat-[\w-]{20,}/,
    /sk_live_[A-Za-z0-9]{20,}/,
    /rk_live_[A-Za-z0-9]{20,}/,
    /whsec_[A-Za-z0-9]{20,}/,
    /npm_[\w-]{20,}/,
```

Change the AWS line to cover STS temporary keys as well:

```ts
    /(?:AKIA|ASIA)[0-9A-Z]{16}/,
```

Make the bearer word match either case (keep everything else in the rule
as it is):

```ts
const BEARER = new RegExp(`${NOT_AFTER}([Bb]earer )[\w.~+/=-]{8,}`, 'g');
```

Amended 2026-10-09 after execution: the group must be **capturing** — the
original plan text wrote `(?:[Bb]earer )`, but `redactText` replaces with
`'$1[redacted]'`, so a non-capturing group leaves a literal `$1` in the
output. The executor reproduced this before editing and used `([Bb]earer )`;
the existing uppercase-Bearer test (which asserts the preserved word)
passes unchanged.

Append to `SECRET_FIELDS`:

```ts
    'secret_key',
    'passphrase',
```

**Verify**: `npx eslint plugins/telltale` → 0 problems.

### Step 2: Extend the tests

In `tests/lib.test.ts`, next to the existing R14 pattern test (around
line 92), add (all fixtures are synthetic shapes, never real-looking
values):

```ts
test('R14: the added token prefixes are redacted', async () => {
  expect(redact('gitlab glpat-' + 'a'.repeat(20))).toBe('gitlab [redacted]');
  expect(redact('stripe sk_live_' + 'b'.repeat(24))).toBe('stripe [redacted]');
  expect(redact('stripe rk_live_' + 'b'.repeat(24))).toBe('stripe [redacted]');
  expect(redact('webhook whsec_' + 'c'.repeat(24))).toBe('webhook [redacted]');
  expect(redact('aws ASIA' + 'ABCDEFGHIJKLMNOP')).toBe('aws [redacted]');
  expect(redact('npm npm_' + 'd'.repeat(30))).toBe('npm [redacted]');
  expect(redact('authorization: bearer abcdefgh1234')).toBe('authorization: bearer [redacted]');
});
```

In the names test (around line 140), extend the `names` array with
`'secret_key'` and `'passphrase'` (the assertions are built from the array,
so nothing else changes). Add the array-recursion test:

```ts
test('R14: secrets inside arrays are redacted, and long array strings are cut', async () => {
  expect(redact({ rows: [{ token: 'abc' }] })).toEqual({ rows: [{ token: '[redacted]' }] });
  const out = cutArgs({ rows: ['a'.repeat(2500)] }) as { rows: string[] };
  expect(out.rows[0]).toBe('a'.repeat(2000) + '…[cut 500 chars]');
});
```

**Verify**: `npm run validate` → exit 0 with the new tests passing.

### Step 3: Document the widened lists in the README

In `plugins/telltale/README.md` (lines 141–154):

- Pattern bullets: add GitLab personal access tokens (`glpat-` prefix, 20
  or more characters); Stripe live secret and restricted keys and webhook
  signing secrets (`sk_live_`, `rk_live_`, `whsec_`, 20 or more characters);
  npm tokens (`npm_` prefix, 20 or more characters); and change the AWS
  bullet to "AWS access key IDs (`AKIA` or `ASIA` plus 16 characters)".
- Bearer bullet: note the word matches whatever its case.
- Field names (the long sentence at line 154): insert `secret_key` and
  `passphrase` in the name enumeration.
- After the sentence about JSON text, add the ceiling: "Deeper JSON
  escaping (a JSON string inside a JSON string inside another) and
  non-string values inside JSON text are not matched."

Check the requirements index line **R14** (README line 179): it says "the
listed secret patterns" and "the listed field names", which stays correct
as the lists grow; it needs no edit.

**Verify**: read the section against `lib.ts`; every listed pattern and
name must match the code exactly.

### Step 4: Bump the version

`plugins/telltale/.claude-plugin/plugin.json`: `"version": "0.3.2"`
(unless a later version is already there; bump the patch from whatever it
holds at execution time).

**Verify**: `npm run check` → exit 0, and the regenerated
`site/src/data/marketplace.json` carries 0.3.2.

## Test plan

- New tests: the two blocks in step 2 (new prefixes; array recursion plus
  array cut) and the two added field names inside the existing names test.
  Pattern: the existing R14 blocks at `tests/lib.test.ts:92–99` and
  `140–155`.
- Existing tests that must keep passing unchanged: the whole R14 block
  (especially `157–161`, the pagination fields that must stay unredacted,
  and `172–175`, the `sk-` runs that must NOT match), and the R24 cut test.
- Verification: `npm run validate` → exit 0; `npm run check` → exit 0.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run validate` → exit 0, with the new tests present in
      `tests/lib.test.ts`
- [ ] `npm run check` → exit 0
- [ ] `npx eslint plugins/telltale` → 0 problems
- [ ] `grep -n "glpat\|sk_live\|whsec\|npm_\|ASIA" plugins/telltale/hooks/lib.ts`
      shows all five new patterns and the ASIA alternation
- [ ] `grep -n "secret_key\|passphrase" plugins/telltale/hooks/lib.ts`
      shows both in `SECRET_FIELDS`
- [ ] `grep -n "Deeper JSON escaping" plugins/telltale/README.md` shows the
      ceiling sentence
- [ ] `plugins/telltale/.claude-plugin/plugin.json` version bumped
- [ ] `git status` shows only in-scope files (plus the `site:data` regen)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- A new pattern breaks an existing test (for instance the `npm_` rule
  matching prose in a fixture, or `NOT_AFTER` interacting with a prefix in
  a way the tests did not predict). Report the failing pair; do not weaken
  an existing expectation to fit.
- The lint-clean spelling of a class is unclear after plan 002's rewrites
  (compare the post-002 file, pick the spelling `npx eslint` accepts).
- The README's Redaction section has drifted so the line numbers above do
  not hold; locate the bullets by their text instead, and stop only if the
  text itself is gone.

## Maintenance notes

- The `usedInAnswer` path checks values against these same patterns
  (`register.tsx:190`), so a new prefix covers it automatically; nothing to
  do there.
- `pk_live_` (publishable keys) and `Basic` auth are deliberate exclusions;
  a reviewer should not add them back.
- The env-dump, YAML and repr gap is recorded in `plans/README.md` as a
  maintainer choice; if a future plan adds an anchored `NAME=` rule, it
  must reuse `SECRET_FIELDS` as the name source so the two lists cannot
  diverge.
- `formatTokens`/display helpers are untouched; only `lib.ts`'s lists, the
  tests, the README and the manifest change.
