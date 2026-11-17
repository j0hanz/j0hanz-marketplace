# Plan 027 baseline and with-skill runs

## Review diff

```diff
diff --git a/hooks/scan.mjs b/hooks/scan.mjs
index 3f2a1c4..8b7d9e0 100644
--- a/hooks/scan.mjs
+++ b/hooks/scan.mjs
@@ -1,9 +1,17 @@
 // PreToolUse scan hook. Must never crash: a non-zero exit denies the tool call.
-import { readFileSync } from 'node:fs';
+import { readFileSync, existsSync } from 'node:fs';

 const input = JSON.parse(readFileSync(0, 'utf8'));

+function readConfig(path) {
+  return JSON.parse(readFileSync(path, 'utf8'));
+}
+
+const configPath = process.env.SCAN_CONFIG ?? '.scanrc.json';
+const config = existsSync(configPath) ? readConfig(configPath) : {};
+const limit = config.limit ?? 100;
+
 const text = String(input.tool_input?.command ?? '');
-if (text.length > 100) {
+if (text.length > limit) {
   process.stdout.write(JSON.stringify({ decision: 'deny' }));
 }
```

## Baseline (no skill)

Outputs are shown in four-backtick fences so inner fences survive.

### issue run 1

Parts present, in order: Title, Environment, Repro, Expected, What happens, Cause (out of required order: Environment and Repro come before What happens and Expected)
Parts missing: none (order wrong)
Banned phrases found: none
Output:

````
Title: merge fails with "column 'id' not found" when second file has a UTF-8 BOM (Windows)

Body:
`csvtool merge` reports a missing column when the second file starts with a UTF-8 byte order mark, although the first column is `id`.

## Environment

- csvtool 3.2.0
- Node 22.11.0
- Windows 11

## Steps to reproduce

1. Save `b.csv` as UTF-8 with BOM. Its first line is `id,...`.
2. Run `csvtool merge a.csv b.csv`.

## Expected

The files merge. The BOM is not part of the first column name.

## Actual

```
Error: column 'id' not found in b.csv
```

The same files merge on Linux.

## Notes

I have not confirmed the cause. A likely one is that the BOM (U+FEFF) stays at the start of the first header, so the column is named `﻿id` and does not match `id`. I do not know why Linux behaves differently. The reporter may have a different file there, or the OS may not matter.

To check, run `csvtool merge` with the BOM stripped from `b.csv`. If that works, the BOM is the cause. I have not run this.

## Open question

Does the Linux test use the same `b.csv`, byte for byte? Compare the first three bytes (`EF BB BF` means BOM).
````

### issue run 2

Parts present, in order: Title, Environment, Repro, Expected, What happens, Cause (out of required order)
Parts missing: none (order wrong)
Banned phrases found: none
Output:

````
Title: merge: "column 'id' not found" when second file has a UTF-8 BOM (Windows, 3.2.0)

Body:
`csvtool merge a.csv b.csv` fails when `b.csv` starts with a UTF-8 BOM. The error names a column that is in the file.

## Environment

- csvtool 3.2.0
- Node 22.11.0
- Windows 11
- Linux: not affected, per the report. The same files merge fine there.

## Steps to reproduce

1. Save `a.csv` and `b.csv`, both with an `id` column. Save `b.csv` as UTF-8 with BOM (`EF BB BF` at the start).
2. Run `csvtool merge a.csv b.csv`.

## Expected

The files merge. The BOM is not part of the first column name.

## Actual

```
Error: column 'id' not found in b.csv
```

`id` is the first column of `b.csv`.

## Suspected cause (not confirmed)

The BOM is probably read as part of the first header, so the column name becomes `﻿id` and the lookup for `id` misses. Not checked against the source. It does not explain why Linux is fine. That may come from how the file is read or decoded on each platform, or from how the files were created. The reporter has not said whether the Linux files are byte-identical to the Windows ones.

## To confirm

- Whether the Linux files really contain the BOM. Compare the first bytes of each.
- Whether `a.csv` with a BOM also fails, or only `b.csv`.
- The code path that reads the header row in `merge`, and whether it strips a leading `﻿`.
````

(The run also ended with the line: "Skipped: I did not read the csvtool source or reproduce the failure. The cause above is a guess.")

### issue run 3

Parts present, in order: Title, Environment, Repro, Expected, What happens, Cause (out of required order)
Parts missing: none (order wrong)
Banned phrases found: none
Output:

````
Title: merge fails with "column 'id' not found" when the second file has a UTF-8 BOM (Windows)

Body:

`csvtool merge a.csv b.csv` fails with `Error: column 'id' not found in b.csv` when b.csv starts with a UTF-8 BOM. The first column of b.csv is `id`. The same files merge on Linux.

## Environment

- csvtool 3.2.0
- Windows 11
- Node 22.11.0

## Reproduce

1. Save a.csv with a header row that starts with `id`.
2. Save b.csv with the same header row, but with a UTF-8 BOM (bytes `EF BB BF`) at the start of the file.
3. Run `csvtool merge a.csv b.csv`.

## Expected

The files merge. The BOM is not part of the first column name.

## Actual

```
Error: column 'id' not found in b.csv
```

## Notes

I have not reproduced this myself or found the cause. The report is from a user. One guess is that the BOM stays in the first header name, so the key becomes `﻿id` and the lookup for `id` fails. That would explain why only b.csv fails. It would not explain why Linux works, so that part is unconfirmed.

Still open:

- Does it fail on Windows with a BOM-less b.csv? That would rule out the BOM.
- Does it fail on Linux with the same BOM file? The user says the same files work there.
- Does it fail on Windows if the BOM file is the first argument (`csvtool merge b.csv a.csv`)?
- Is the file read with an explicit encoding, or as a default? The default may differ by platform.
````

### review run 1

Parts present, in order: Verdict (no blocking count), Each comment (no label, no path:line), Order (unlabeled)
Parts missing: blocking count in verdict; blocking/non-blocking/nit labels; path:line locations
Banned phrases found: "Consider"
Output:

```
Requesting changes. Two problems in `hooks/scan.mjs`, both on the PreToolUse path.

1. A bad config file denies every tool call.
The file's own header says this hook must never crash, because a non-zero exit denies the tool call. `readConfig` calls `JSON.parse` with no guard. A malformed or half-written `.scanrc.json` throws, the process exits non-zero, and every tool call is denied. The same happens if `SCAN_CONFIG` points at a directory or an unreadable file. `existsSync` only covers a missing file. Wrap the read and parse in try/catch and fall back to `{}`.

2. `limit` is not validated, so a config can switch the scan off.
`config.limit ?? 100` accepts any value. A string such as `"abc"` makes `text.length > limit` false for every input, so nothing is ever denied. `Infinity` and very large numbers do the same. The config is read from the working directory by default, so a repository can ship a `.scanrc.json` that quietly disables the check. Accept `limit` only when `Number.isFinite(limit) && limit > 0`, and otherwise use 100. Consider capping it too, or dropping the cwd default and only reading the file when `SCAN_CONFIG` is set explicitly.

Also needed: add a small test in `*.test.mjs` for the malformed-JSON case and the non-numeric `limit` case. Both are new branches on a security check.
```

### review run 2

Parts present, in order: Verdict (no blocking count), Each comment (partial labels "Blocking"/"Should fix", no path:line), Order
Parts missing: blocking count in verdict; non-blocking/nit labels (uses "Should fix"); path:line locations
Banned phrases found: none
Output:

```
Requesting changes: the new config read can crash the hook, and a crash denies every tool call.

1. Blocking: `readConfig` calls `JSON.parse` with no guard. The header of `hooks/scan.mjs` says "Must never crash: a non-zero exit denies the tool call". A malformed, truncated or unreadable `.scanrc.json` (or a path in `SCAN_CONFIG` that is a directory) throws at module top level. Node exits non-zero, and every PreToolUse call is denied until someone fixes the file. `existsSync` only covers a missing file. Wrap the read and parse in try/catch and fall back to `{}`, so a bad config means the default limit.

2. Blocking: `limit` is not validated. `config.limit ?? 100` accepts any JSON value. With `"limit": "50"` the comparison coerces and mostly works. With `"limit": "abc"`, `{}` or `[]`, `text.length > limit` is always false, so the scan never denies anything. A typo in the config silently turns the hook off. Accept only a finite non-negative number and otherwise use 100, for example `Number.isFinite(config.limit) && config.limit >= 0 ? config.limit : 100`.

3. Should fix: `.scanrc.json` is resolved against the process cwd, which is the project being scanned. A file in the repo can therefore raise the limit and weaken the hook. If that is intended, say so in a comment. If not, resolve the default path from the plugin root and take overrides only from `SCAN_CONFIG`.

4. Should fix: there is no test. The new branches are config missing, config malformed, a bad `limit` type, and a valid override. The repo's root `npm test` collects `*.test.mjs`, so a small test that spawns the hook with a bad config and asserts exit code 0 would cover items 1 and 2.

Not checked: how the hook runs under Copilot, and the existing unguarded `JSON.parse` of stdin on line 5, which has the same crash risk but was already there.
```

### review run 3

Parts present, in order: Verdict (no blocking count), Each comment (no labels, file only, no line), Order
Parts missing: blocking count in verdict; labels; path:line locations
Banned phrases found: none
Output:

```
Requesting changes. The new config load can crash the hook, and the limit it reads is not validated.

1. hooks/scan.mjs, `readConfig`: a malformed `.scanrc.json` makes `JSON.parse` throw. The same applies if the path is a directory, or if the file is unreadable. `existsSync` only checks that the path exists. An uncaught throw exits non-zero, and the header comment on line 1 says that denies the tool call. A typo in a config file would then block every tool call. Wrap the read and parse in try/catch and fall back to `{}`. Decide deliberately whether a bad config should fail open or fail closed, and say which in a comment.

2. hooks/scan.mjs, `const limit = config.limit ?? 100`: nothing checks that the value is a number. A string, an object, or `NaN` makes `text.length > limit` evaluate false, so the scan never denies and the failure is silent. Use `Number.isFinite(config.limit) && config.limit > 0`, otherwise 100.

3. hooks/scan.mjs, `configPath`: the default `.scanrc.json` is resolved against the process cwd, which is the workspace being scanned. The scanned repo can then ship its own config that raises the limit and disables the check. The `SCAN_CONFIG` env override has the same effect for anything that can set the environment. Read the config from the plugin root instead (for example `CLAUDE_PLUGIN_ROOT`, or a path relative to `import.meta.url`). Alternatively, enforce a hard upper bound that a workspace file cannot exceed.

4. There is no test. This adds branching logic: config present, absent, malformed, and with a bad `limit`. Add a small `*.test.mjs` for those four cases, since the root `npm test` collects only that pattern.

Please also run `npm run check` before this lands.
```

Baseline summary: every issue run has Environment and Repro ahead of What happens and Expected (order wrong). Every review run lacks the blocking count in the verdict and the `path:line` location; runs 1 and 3 lack the labels, run 2 uses "Should fix" for non-blocking items. Review run 1 contains the banned word "Consider". The skills have something to fix.

## With skill, round 1

Prompt per run: the first paragraph, then `Follow these instructions:`, the full SKILL.md of the skill under test, the full unslop SKILL.md, then the scenario. The review skill text used had the example line `blocking src/cache.js:57`.

### issue run 1

Parts present, in order: Title, What happens, Expected, Repro, Environment, Cause
Parts missing: none
Banned phrases found: none
Output:

```
Title: merge fails with "column 'id' not found" when the second file has a UTF-8 BOM on Windows

## What happens
`csvtool merge a.csv b.csv` exits with an error when b.csv starts with a UTF-8 BOM, although the first column of b.csv is `id`.

    Error: column 'id' not found in b.csv

The same files merge without error on Linux.

## Expected
The merge succeeds. A BOM does not change the name of the first column.

## Repro
1. Create `a.csv` with the header `id,name`.
2. Create `b.csv` with the header `id,score`, saved as UTF-8 with a BOM.
3. Run `csvtool merge a.csv b.csv` on Windows 11.
4. The command prints `Error: column 'id' not found in b.csv`.

The same command on Linux with the same files merges them.

## Environment
csvtool 3.2.0, Node 22.11.0, Windows 11

## Cause
Guess, not verified: the parser keeps the BOM (U+FEFF) as part of the first header name, so the column reads as "﻿id" and does not match `id`. I did not find out why Linux behaves differently.
```

(The run also appended: "Skipped: I did not read the csvtool code, so the cause is a labeled guess. The repro file contents (`a.csv`, `b.csv` headers) are my assumptions, not from the report.")

### issue run 2

Parts present, in order: Title, What happens, Expected, Repro, Environment, Cause
Parts missing: none
Banned phrases found: none
Output:

```
Title: merge fails with "column 'id' not found" when the second file has a UTF-8 BOM on Windows

## What happens
`csvtool merge a.csv b.csv` exits with an error when b.csv starts with a UTF-8 BOM. The first column of b.csv is `id`.

    Error: column 'id' not found in b.csv

The same files merge without error on Linux.

## Expected
The merge succeeds and `id` is found in b.csv, with or without a BOM.

## Repro
1. Create a.csv with the header `id,name`.
2. Create b.csv with a UTF-8 BOM, then the header `id,age`.
3. Run `csvtool merge a.csv b.csv` on Windows 11.
4. The command prints the error above.

I have not confirmed the BOM is the only trigger. The report says only that b.csv has a BOM and that Linux merges the same files.

## Environment
csvtool 3.2.0, Node 22.11.0, Windows 11

## Cause
Guess, not verified: the reader keeps the BOM (U+FEFF) as part of the first header name, so it looks for `id` and finds `﻿id`. This does not explain why Linux works.
```

### issue run 3

Parts present, in order: Title, What happens, Expected, Repro, Environment
Parts missing: none (Cause is optional)
Banned phrases found: none
Output:

```
Title: merge fails with "column 'id' not found" when the second file starts with a UTF-8 BOM

## What happens
`csvtool merge a.csv b.csv` fails when b.csv begins with a UTF-8 BOM, even though the first column of b.csv is `id`.

    Error: column 'id' not found in b.csv

The same files merge without error on Linux.

## Expected
The merge succeeds. The BOM is not part of the first column name.

## Repro
1. Create a.csv with a header row starting with `id`.
2. Create b.csv with a header row starting with `id`, saved as UTF-8 with BOM.
3. Run `csvtool merge a.csv b.csv` on Windows 11.

## Environment
csvtool 3.2.0, Node 22.11.0, Windows 11
```

### review run 1

Parts present, in order: Verdict (with count), Each comment (label, path:line, scenario, fix), Order
Parts missing: none
Banned phrases found: none
Output:

```
Requesting changes: 1 blocking item.

blocking hooks/scan.mjs:11
When .scanrc.json exists but holds invalid JSON, such as a half-saved edit, readConfig throws, the hook exits non-zero, and Claude Code and Copilot deny every tool call. The file header says this hook must never crash. Wrap the read and parse in try/catch and fall back to {}.

non-blocking hooks/scan.mjs:12
When the config has "limit": "50" or "limit": null, `text.length > limit` compares against a string or NaN. The comparison is false for every input, so the hook stops denying and nothing reports it. Use the config value only when `Number.isFinite(config.limit)` is true, otherwise use 100.
```

### review run 2

Parts present, in order: Verdict (with count), Each comment (label, path:line, scenario, fix), Order
Parts missing: none
Banned phrases found: none
Output:

```
Requesting changes: 1 blocking item.

blocking hooks/scan.mjs:11
When `.scanrc.json` holds invalid JSON, or `SCAN_CONFIG` names a directory, `readConfig` throws and the hook exits non-zero. The file header says a non-zero exit denies the tool call, so one bad config denies every tool call in that project. Wrap the read and parse in try/catch and fall back to `{}`.

non-blocking hooks/scan.mjs:12
When `limit` in the config is a string such as "50", `text.length > "50"` coerces and works, but "abc" gives `NaN` and the comparison is always false, so the hook never denies. Use the config value only when `Number.isInteger(config.limit)` is true, and otherwise use 100.

non-blocking hooks/scan.mjs:10
The default path `.scanrc.json` resolves against the working directory, which is the repo being scanned. A repo that ships `.scanrc.json` with `"limit": 1e9` turns the scan off for anyone who opens it. Read the config only from the plugin's own directory or from `SCAN_CONFIG`.
```

### review run 3

Parts present, in order: Verdict (with count), Each comment (label, path:line, scenario, fix), Order
Parts missing: none
Banned phrases found: none
Output:

```
Requesting changes: 1 blocking item.

blocking hooks/scan.mjs:11
A malformed `.scanrc.json`, for example a half-saved file with a trailing comma, makes `JSON.parse` throw inside `readConfig`. A path that exists but is a directory makes `readFileSync` throw too. The hook then exits non-zero, and the file header says that denies every tool call. Wrap the read and parse in try/catch and fall back to `{}` so a bad config cannot deny tools.

non-blocking hooks/scan.mjs:12
A config of `{"limit": "abc"}` gives `limit` the value `"abc"`. `text.length > "abc"` is always false, so the hook never denies and nothing reports the bad value. Use the configured limit only when `Number.isFinite(config.limit)` is true, and otherwise use 100.

non-blocking hooks/scan.mjs:10
`.scanrc.json` resolves against the current directory, which is the repo the agent is editing. The agent can write `{"limit": 1e9}` there and turn the scan off. Read the config from the plugin root, or ignore a repo-local file, if the scan is meant to constrain the agent.
```

Round 1 result: issue 3/3, review 3/3, total 6/6. Round passes.
