# Plan 001: Redact secret fields whatever their spelling (camelCase, `-`, `_`)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report and do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 420d039..HEAD -- plugins/telltale/hooks/lib.ts plugins/telltale/tests/lib.test.ts plugins/telltale/README.md plugins/telltale/.claude-plugin/plugin.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `420d039`, 2026-10-08

## Why this matters

`telltale` is a Claude Code mod that writes every MCP tool call's arguments and
result previews to local JSONL log files. Before writing, it replaces secret
values with `[redacted]`. One rule redacts the whole value of a field whose
name is on a fixed list. That match is exact: the list holds `access_token`,
`refresh_token` and `client_secret`, so the camelCase spellings `accessToken`,
`refreshToken` and `clientSecret` are written to disk in plain text. camelCase
is the norm in JavaScript MCP servers. This was checked against the real
`redact` function: of `accessToken`, `refreshToken`, `clientSecret`,
`authToken`, `x-api-key`, `Cookie`, `id_token`, `private_key` and
`aws_secret_access_key`, none was redacted. Only `apiKey` was caught, because
`apikey` is on the list by chance. After this plan, a field name matches its
listed name ignoring case and ignoring `_` or `-` between words, and the list
gains the common credential names it lacked.

## Current state

Files:

- `plugins/telltale/hooks/lib.ts`: pure helpers; the redaction code is lines 37–101.
- `plugins/telltale/tests/lib.test.ts`: tests for `lib.ts`; the R14 (redaction) tests are lines 80–145 and 252.
- `plugins/telltale/README.md`: user docs; the "Redaction" section (lines 137–156) lists the field names word for word, and line 179 is the R14 requirement line.
- `plugins/telltale/.claude-plugin/plugin.json`: manifest, `"version": "0.3.0"` on line 5.

`plugins/telltale/hooks/lib.ts:37-49`: the list, an exact-match `Set`:

```ts
const SECRET_FIELDS = new Set([
  'password',
  'passwd',
  'secret',
  'token',
  'api_key',
  'apikey',
  'api-key',
  'authorization',
  'access_token',
  'refresh_token',
  'client_secret',
]);
```

`plugins/telltale/hooks/lib.ts:67-76` shows that the same list drives two regexes that
redact a field's string value inside JSON text, and inside JSON escaped once
more (a JSON string holding JSON). Both have the `i` flag, so case already
does not matter there; only the separator does:

```ts
// R14: a listed field's string value inside JSON text, and inside JSON escaped once more (a JSON
// string holding JSON; an inner escape is an escaped backslash plus one escape unit, so an escaped
// quote inside the value does not end it). ponytail: deeper escaping and non-string values are not
// matched.
const FIELDS = [...SECRET_FIELDS].join('|');
const JSON_FIELD = new RegExp(String.raw`("(?:${FIELDS})"\s*:\s*")(?:[^"\\]|\\.)*(")`, 'gi');
const ESCAPED_FIELD = new RegExp(
  String.raw`(\\"(?:${FIELDS})\\"\s*:\s*\\")(?:\\\\(?:\\.|[^"\\])|\\[^"\\]|[^"\\])*(\\")`,
  'gi',
);
```

`plugins/telltale/hooks/lib.ts:88-101`: object keys are checked with
`key.toLowerCase()` against the `Set`:

```ts
export const redact = (value: unknown): unknown => {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map(redact);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        SECRET_FIELDS.has(key.toLowerCase()) ? '[redacted]' : redact(inner),
      ]),
    );
  }
  return value;
};
```

`SECRET_FIELDS` and `FIELDS` are used nowhere else
(`grep -rn "SECRET_FIELDS\|FIELDS" plugins/telltale/hooks` shows only lines 37, 71, 72, 74, 96).

Behaviour the existing tests pin and that must not change
(`plugins/telltale/tests/lib.test.ts:88-90` and `118-121`):

```ts
test('R14: a field that only contains a listed word is unchanged', async () => {
  expect(redact({ max_tokens: 1000 })).toEqual({ max_tokens: 1000 });
});
...
test('R14: JSON text without a listed field is unchanged', async () => {
  const text = '{"max_tokens":1000,"tokenizer":"x","note":"token is fine"}';
  expect(redact(text)).toBe(text);
});
```

Conventions to match:

- Comments cite requirement IDs (`// R14: ...`). Keep that.
- Two-space indent, single quotes, trailing commas, Prettier format (the repo runs `prettier --check`).
- Tests use `import { expect, test } from 'claude-code/testing';` and are named `'R14: <behaviour>'`. Model new tests on `lib.test.ts:80-86`.
- `String.prototype.replaceAll` is already used in this file (`lib.ts:450`), so it is available.
- Commit subjects are Conventional Commits scoped to the plugin, e.g. `fix(telltale): bound every detail path by serialized size` (from `git log`).

## Commands you will need

Run all commands from the repository root `C:\j0hanz-marketplace` (or the clone's root).

| Purpose          | Command                                 | Expected on success                            |
| ---------------- | --------------------------------------- | ---------------------------------------------- |
| Plugin tests     | `claude plugin test plugins/telltale`   | `0 fail`; 172 pass before this plan, 175 after |
| Typecheck plugin | `npx tsc -p plugins/telltale --noEmit`  | exit 0, no output                              |
| Format check     | `npx prettier --check plugins/telltale` | `All matched files use Prettier code style!`   |
| Full gate        | `npm run check`                         | exit 0                                         |

`claude plugin test` needs `plugins/telltale/.claude-plugin/types/` to exist (it is gitignored). If the typecheck fails with "cannot find module 'claude-code'", see STOP conditions.

## Scope

**In scope** (the only files you should modify):

- `plugins/telltale/hooks/lib.ts`
- `plugins/telltale/tests/lib.test.ts`
- `plugins/telltale/README.md`
- `plugins/telltale/.claude-plugin/plugin.json` (version only)

**Out of scope** (do NOT touch):

- `plugins/telltale/hooks/register.tsx`: it calls `redact` and `cutArgs` and needs no change.
- `SECRET_PATTERNS`, `BEARER`, `PRIVATE_KEY` and `NOT_AFTER` in `lib.ts`: the value-shape patterns are a separate rule and are not changed by this plan.
- `.claude-plugin/marketplace.json` and the root `README.md`: no catalog change is needed.
- `plugins/telltale/types/index.d.ts`.
- Do not add "suffix" matching (e.g. "any key ending in `token`"). It would redact pagination fields such as `pageToken` and `next_page_token`, which authors need in the logs.

## Git workflow

- Branch: `advisor/001-telltale-redact-key-spellings`
- One commit is enough. Subject: `fix(telltale): redact secret fields in any spelling`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write the failing tests

In `plugins/telltale/tests/lib.test.ts`, add three tests directly after the
test `'R14: JSON text without a listed field is unchanged'` (currently ending
at line 121):

```ts
test('R14: a listed field in camelCase or with - or _ is redacted', async () => {
  expect(
    redact({ accessToken: 'a', 'refresh-token': 'b', clientSecret: 'c', API_KEY: 'd' }),
  ).toEqual({
    accessToken: '[redacted]',
    'refresh-token': '[redacted]',
    clientSecret: '[redacted]',
    API_KEY: '[redacted]',
  });
  expect(redact('{"accessToken":"a","user":"ann"}')).toBe(
    '{"accessToken":"[redacted]","user":"ann"}',
  );
  expect(redact(JSON.stringify({ body: JSON.stringify({ clientSecret: 'z', n: 1 }) }))).toBe(
    '{"body":"{\\"clientSecret\\":\\"[redacted]\\",\\"n\\":1}"}',
  );
});

test('R14: the added credential field names are redacted', async () => {
  const names = [
    'x-api-key',
    'id_token',
    'authToken',
    'sessionToken',
    'private_key',
    'aws_secret_access_key',
    'Cookie',
    'Set-Cookie',
  ];
  const input = Object.fromEntries(names.map((name) => [name, 'v']));
  const output = Object.fromEntries(names.map((name) => [name, '[redacted]']));
  expect(redact(input)).toEqual(output);
  expect(redact(JSON.stringify(input))).toBe(JSON.stringify(output));
});

test('R14: pagination and count fields stay unredacted', async () => {
  const value = { pageToken: 'p1', next_page_token: 'p2', max_tokens: 10, tokenizer: 'x' };
  expect(redact(value)).toEqual(value);
  expect(redact(JSON.stringify(value))).toBe(JSON.stringify(value));
});
```

**Verify**: `claude plugin test plugins/telltale` → the first two new tests
fail, the third passes, every other test passes (`173 pass`, `2 fail`: 172 existing plus the pagination test).

### Step 2: Replace the list and its two users in `lib.ts`

Replace `plugins/telltale/hooks/lib.ts:37-49` (the `SECRET_FIELDS` `Set`) with
the following. The names are written with `_` between words. `api_key` now
covers the old `apikey` and `api-key` entries, so those two are removed.

```ts
// R14: written with `_` between words; a key matches ignoring case and with `_`, `-` or nothing
// between its words.
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
const squash = (key: string) => key.toLowerCase().replace(/[_-]/g, '');
const SECRET_KEYS = new Set(SECRET_FIELDS.map(squash));
```

Replace line 71:

```ts
const FIELDS = [...SECRET_FIELDS].join('|');
```

with:

```ts
const FIELDS = SECRET_FIELDS.map((name) => name.replaceAll('_', '[_-]?')).join('|');
```

Leave the `JSON_FIELD` and `ESCAPED_FIELD` regexes on lines 72–76 exactly as
they are. They already use the `i` flag, and `FIELDS` now carries the
separator rule.

In `redact`, replace:

```ts
        SECRET_FIELDS.has(key.toLowerCase()) ? '[redacted]' : redact(inner),
```

with:

```ts
        SECRET_KEYS.has(squash(key)) ? '[redacted]' : redact(inner),
```

**Verify**:

- `claude plugin test plugins/telltale` → `175 pass`, `0 fail`.
- `npx tsc -p plugins/telltale --noEmit` → exit 0.
- `grep -n "SECRET_FIELDS.has\|'apikey'\|'api-key'" plugins/telltale/hooks/lib.ts` → no output.

### Step 3: Update the README

In `plugins/telltale/README.md`, "Redaction" section, replace the paragraph
that begins `The whole value of any field named` (line 154) with:

```markdown
The whole value of any field named `password`, `passwd`, `secret`, `token`, `api_key`, `x_api_key`, `authorization`, `access_token`, `refresh_token`, `id_token`, `auth_token`, `session_token`, `client_secret`, `private_key`, `aws_secret_access_key`, `cookie` or `set_cookie` is replaced too. Names match whatever the case, and with `_`, `-` or nothing between their words, so `accessToken`, `Access-Token` and `ACCESS_TOKEN` all match `access_token`. This also applies inside JSON text, such as a result that is a JSON document, when the value is a string. `usedInAnswer` values are checked one by one, outside their JSON, so only the patterns above apply to them.
```

In the "Requirements index", line 179 (the line starting `- **R14**`), replace
this text:

```text
the whole values of the listed field names (in objects, and string values in JSON text)
```

with this text (the backticks are part of it):

```text
the whole values of the listed field names, matched ignoring case and `_` or `-` between words (in objects, and string values in JSON text)
```

Change nothing else on that line.

**Verify**:

- `grep -c "aws_secret_access_key" plugins/telltale/README.md` → `1`.
- `grep -n "ignoring case and \`_\` or \`-\` between words" plugins/telltale/README.md` → one match, on the R14 line.

### Step 4: Bump the plugin version

In `plugins/telltale/.claude-plugin/plugin.json`, change `"version": "0.3.0"`
to `"version": "0.3.1"`. Change nothing else.

**Verify**: `grep -n '"version"' plugins/telltale/.claude-plugin/plugin.json` → `5:  "version": "0.3.1",`

### Step 5: Format and run the full gate

Run `npx prettier --write plugins/telltale/hooks/lib.ts plugins/telltale/tests/lib.test.ts plugins/telltale/README.md`
(this formats only in-scope files), then the checks.

**Verify**:

- `npx prettier --check plugins/telltale` → `All matched files use Prettier code style!`
- `npm run check` → exit 0.
- `git status --short` → only the 4 in-scope files are modified. If `npm run check` rewrote the root `README.md` generated regions, run `git diff README.md`. If the diff is empty or whitespace only, run `git checkout README.md`; otherwise STOP.

## Test plan

- Three new tests in `plugins/telltale/tests/lib.test.ts`, written in Step 1, modelled on `'R14: a listed field name has its whole value redacted'` (`lib.test.ts:80-86`):
  - camelCase, `-` and upper-case spellings of listed names, in an object, in JSON text, and in JSON escaped inside a JSON string;
  - each newly added name, in an object and in JSON text;
  - a regression guard: `pageToken`, `next_page_token`, `max_tokens` and `tokenizer` stay unredacted.
- Every existing R14 test must pass unchanged. In particular `'R14: a field that only contains a listed word is unchanged'` and `'R14: JSON text without a listed field is unchanged'` prove the match stays whole-name.
- Run: `claude plugin test plugins/telltale` → `175 pass`, `0 fail`.

## Done criteria

- [ ] `claude plugin test plugins/telltale` → `175 pass`, `0 fail`
- [ ] `npx tsc -p plugins/telltale --noEmit` exits 0
- [ ] `npm run check` exits 0
- [ ] `grep -n "SECRET_FIELDS.has" plugins/telltale/hooks/lib.ts` returns no matches
- [ ] `grep -n '"version": "0.3.1"' plugins/telltale/.claude-plugin/plugin.json` returns one match
- [ ] `git status --short` lists only the 4 in-scope files
- [ ] `plans/README.md` status row for 001 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `lib.ts:37-101` does not match the excerpts above (the redaction code has changed since `420d039`).
- `npx tsc -p plugins/telltale --noEmit` fails with `Cannot find module 'claude-code'`. The gitignored type folder `plugins/telltale/.claude-plugin/types/` is missing, and the operator must load the mod once with `claude --plugin-dir plugins/telltale` to lay it. Do not try to create those types yourself.
- Any existing R14 test fails after Step 2. That means the separator rule matches more than whole names, and the regex change must be re-thought, not the test edited.
- `npm run check` fails in a file outside `plugins/telltale/`. That is a pre-existing problem; report it rather than fixing it.
- Making a test pass seems to need a change to `register.tsx` or to the value-shape patterns (`SECRET_PATTERNS`, `BEARER`, `PRIVATE_KEY`).

## Maintenance notes

- The pane (the `/telltale` view) shows raw, unredacted data by design (README "Redaction", R25). This plan changes the logs only.
- The JSON-text rule still matches only string values and at most one level of escaped JSON, as before (`ponytail:` comment at `lib.ts:69-70`). A numeric or object value under a listed key in JSON text is not redacted; in a parsed object it is.
- Reviewers: check that the `[_-]?` separators cannot let a listed name match inside a longer key. The leading `"` and trailing `"` in `JSON_FIELD` and `ESCAPED_FIELD` anchor the whole key; the `pageToken` test guards this.
- Deferred on purpose: `Basic` HTTP auth credentials in plain text. A `Basic <word>` pattern would also redact prose such as "Basic configuration".
- Deferred on purpose: suffix matching on names such as `*_token`, because it redacts pagination cursors.
