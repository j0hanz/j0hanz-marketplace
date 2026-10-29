# Plan 015: Audit fixes (set-style, client.mjs, site copy button)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the six findings of the 2026-10-29 repo audit: set-style honors `CLAUDE_CONFIG_DIR` and symlinks and is tested in the gate; `client.mjs` reads Antigravity's multi-edit arguments and drains advisories atomically; the site copy button states its status once.

**Architecture:** Three independent edits. `set-style.mjs` gets one config-dir constant and a realpath before its atomic write, plus a `node --test` file that drives it end to end. `client.mjs` gets two argument fallbacks and a rename-then-read drain, copied byte-identically into all five plugins that carry it. `Command.tsx` reuses its `tip` string.

**Tech Stack:** Node 24 ESM, `node:test`, React 19 + MUI 9 (site), TypeScript 7 typecheck.

**Spec:** the audit report from the 2026-10-29 session, summarized under "Findings" below; there is no separate file.

## Findings (the spec)

1. `plugins/output-styles/hooks/set-style.mjs:51` writes `~/.claude/settings.json` even when `CLAUDE_CONFIG_DIR` is set, and reports success.
2. `hooks/client.mjs` maps `multi_replace_file_content` to `Edit`, but plan 014 (lines 75-76) gives its args as `{TargetFile, ReplacementChunks[]}`; `toolInput` reads only `Path`/`Replacement`, so writeup never scans that edit.
3. The set-style self-test is not run by `npm run check`.
4. `writeSettings` renames over `settings.json`; a symlinked file becomes a plain file.
5. `drainAdvisory` reads then unlinks; a note appended between the two is lost.
6. `site/src/components/Command.tsx` writes the three-way status text twice.

## Global Constraints

- Node `>=24` (`package.json` engines); built-ins only, no new dependencies.
- `hooks/client.mjs` must stay byte-identical across `plugins/{css,frontend,mcp-hub,workbench,writeup}/hooks/` (`scripts/validate.mjs:79-89`).
- Claude Code output must stay unchanged (CLAUDE.md, "Two clients").
- A shipped fix bumps the plugin's patch version in `.claude-plugin/plugin.json`; a plugin with `.antigravity-plugin/plugin.json` bumps it to the same value (validate checks `version` equality).
- css, mcp-hub and workbench are slated for replacement: they get the `client.mjs` copy only (forced by the identity check), no version bump, no other edits.
- Root `npm test` collects `scripts/*.test.mjs` and `plugins/*/test/**/*.test.mjs`.
- Gate: `npm run check` passes before the branch lands. Conventional commit subjects, scoped.

## Review Focus

1. `CLAUDE_CONFIG_DIR` unset: set-style must write `<home>/.claude/settings.json` exactly as before. Pinned by `writes under home when CLAUDE_CONFIG_DIR is unset` (Task 1).
2. `cwd` equal to the config dir's parent: the override warning must not report the global file as a project override. Pinned by `no override warning for the global file itself` (Task 1).
3. `ReplacementChunks` absent or not an array (malformed or a different Antigravity version): the hook must stay silent, not crash. Pinned by `multi_replace without chunks stays silent` (Task 2).
4. Drain with nothing parked, twice in a row: both answer `{}` and leave no stray file. Pinned by `deliver leaves no temp file behind` (Task 2).
5. Symlinked settings on a machine without symlink privilege (Windows): the test skips instead of failing, as `scan.test.mjs:319-326` does (Task 1).

---

### Task 1: set-style honors the config dir and symlinks, tested in the gate

Findings 1, 3, 4.

**Files:**

- Modify: `plugins/output-styles/hooks/set-style.mjs:51` (SETTINGS), `:119-130` (writeSettings), `:139` (override check)
- Modify: `plugins/output-styles/.claude-plugin/plugin.json` (version `0.3.1` → `0.3.2`)
- Create: `plugins/output-styles/test/set-style.test.mjs`

**Interfaces:**

- Consumes: nothing.
- Produces: `CONFIG_DIR` module constant, `= process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude')`; `SETTINGS = path.join(CONFIG_DIR, 'settings.json')`. CLI contract unchanged: `node set-style.mjs <choice>` exits 0 and prints `outputStyle set to: <value>`.

- [ ] **Step 1: Write the failing tests** in `plugins/output-styles/test/set-style.test.mjs`

Helper: `run(args, { home, config, cwd })` = `spawnSync('node', [HOOK, ...args], { cwd, encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home, CLAUDE_CONFIG_DIR: config ?? '' } })`, every dir from `mkdtempSync(join(tmpdir(), 'set-style-'))`, removed in `finally`. An empty `CLAUDE_CONFIG_DIR` counts as unset (the `||` above).

```js
test('self-test passes', () => {
  const r = spawnSync('node', [HOOK, '--self-test'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
test('writes under CLAUDE_CONFIG_DIR when it is set', () => {
  // run(['concise'], { home, config, cwd: home })
  assert.equal(r.status, 0);
  assert.equal(
    JSON.parse(readFileSync(join(config, 'settings.json'), 'utf8')).outputStyle,
    'output-styles:concise',
  );
  assert.equal(existsSync(join(home, '.claude', 'settings.json')), false);
});
test('writes under home when CLAUDE_CONFIG_DIR is unset', () => {
  // run(['tldr'], { home, cwd: home })
  assert.equal(
    JSON.parse(readFileSync(join(home, '.claude', 'settings.json'), 'utf8')).outputStyle,
    'output-styles:tldr',
  );
});
test('no override warning for the global file itself', () => {
  // config = join(base, '.claude'); write {"outputStyle":"x"} there; run(['concise'], { home: other, config, cwd: base })
  assert.doesNotMatch(r.stdout + r.stderr, /warning:/);
});
test('a symlinked settings file stays a symlink', (t) => {
  // target = join(dotfiles, 'settings.json') holding {"keep":1}; symlinkSync(target, join(config, 'settings.json'), 'file')
  // on EPERM: t.skip('no symlink privilege'); return;
  // run(['concise'], { home, config, cwd: home })
  assert.ok(lstatSync(join(config, 'settings.json')).isSymbolicLink());
  assert.deepEqual(JSON.parse(readFileSync(target, 'utf8')), {
    keep: 1,
    outputStyle: 'output-styles:concise',
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test plugins/output-styles/test/set-style.test.mjs`
Expected: `self-test passes` and `writes under home…` PASS; `writes under CLAUDE_CONFIG_DIR…`, `no override warning…` and `a symlinked settings file…` FAIL (or the last one skips without privilege).

- [ ] **Step 3: Implement in `set-style.mjs`**

- Line 51: add `CONFIG_DIR` and derive `SETTINGS` from it (Interfaces above).
- Line 139: skip when `path.resolve(cwd, name) === path.join(CONFIG_DIR, path.basename(name))`. With the variable unset, this equals today's comparison.
- `writeSettings(file, obj)`: resolve `file` with `fs.realpathSync`. On `ENOENT`, keep `file`; rethrow anything else. Then put the temp file in, and rename onto, the resolved path. Keep the existing `rmSync` cleanup.

- [ ] **Step 4: Run to verify they pass**

Run: `node --test plugins/output-styles/test/set-style.test.mjs`
Expected: all pass (symlink test may report `# SKIP`).

- [ ] **Step 5: Bump version and commit**

Set `plugins/output-styles/.claude-plugin/plugin.json` `version` to `0.3.2`.

```bash
git add plugins/output-styles
git commit -m "fix(output-styles): honor CLAUDE_CONFIG_DIR and symlinked settings in set-style"
```

### Task 2: client.mjs reads multi-edit args and drains atomically

Findings 2, 5.

**Files:**

- Modify: `plugins/writeup/hooks/client.mjs:52-61` (`toolInput`), `:162-172` (`drainAdvisory`), then copy the file over `plugins/{css,frontend,mcp-hub,workbench}/hooks/client.mjs`
- Modify: `plugins/writeup/.claude-plugin/plugin.json` and `plugins/writeup/.antigravity-plugin/plugin.json` (`0.2.0` → `0.2.1`)
- Modify: `plugins/frontend/.claude-plugin/plugin.json` and `plugins/frontend/.antigravity-plugin/plugin.json` (`0.3.0` → `0.3.1`)
- Test: `plugins/writeup/test/scan.test.mjs` (after line 371, reusing `agy` and `agyState`)

**Interfaces:**

- Consumes: nothing.
- Produces: `toolInput(payload)` keeps its return shape `{filePath, written, replacement, command, skill}`. It now also fills `filePath` from `TargetFile` and `replacement` from `ReplacementChunks[].ReplacementContent` joined with `'\n'`. `drainAdvisory(pluginKey, payload)` keeps its signature and return values.

- [ ] **Step 1: Write the failing tests**

```js
test('Antigravity: multi_replace_file_content chunks are scanned as one edit', () => {
  // agy({ conversationId: id, workspacePaths: [tmpdir()], toolCall: { name: 'multi_replace_file_content',
  //   args: { TargetFile: 'docs/a.md', ReplacementChunks: [{ ReplacementContent: 'Fine.' }, { ReplacementContent: 'We delve.' }] } } }, ['--antigravity'])
  const out = JSON.parse(agy({ conversationId: id }, ['deliver', '--antigravity']));
  assert.match(
    out.injectSteps[0].ephemeralMessage,
    /^writeup:unslop flagged 1 pattern in an edit to docs\/a\.md:\n- rule 7 "delve" \(line 2 of the edit\)/,
  );
});
test('multi_replace without chunks stays silent', () => {
  // same call with args: { TargetFile: 'docs/a.md', ReplacementChunks: 'oops' } answers '{}'
  assert.equal(agy({ conversationId: id }, ['deliver', '--antigravity']), '{}');
});
test('deliver leaves no temp file behind', () => {
  // park one finding (write_file as in the existing test), deliver twice
  assert.deepEqual(
    readdirSync(tmpdir()).filter((f) => f.startsWith(`writeup-unslop-${id}`)),
    [],
  );
});
```

Each test cleans its state with `rmSync(agyState(id), { force: true })` in `finally`, as at `scan.test.mjs:369-370`.

- [ ] **Step 2: Run to verify they fail**

Run: `node --test plugins/writeup/test/scan.test.mjs`
Expected: the multi_replace test FAILS (deliver answers `{}`); the other two pass already and stay as guards.

- [ ] **Step 3: Implement in `plugins/writeup/hooks/client.mjs`**

- `toolInput`: `filePath` adds `?? input.TargetFile`; `replacement` adds `?? chunks` where `chunks` is defined only when `Array.isArray(input.ReplacementChunks)`: map each chunk to `ReplacementContent`, keep strings only, join with `'\n'`. Extend the Antigravity line of the comment above it with `multi_replace_file_content {TargetFile, ReplacementChunks[].ReplacementContent}`.
- `drainAdvisory`: `renameSync(file, \`${file}.${process.pid}\`)`first, then read and unlink the renamed copy, all inside the existing`try`. A rename is atomic, so an append either lands before it (and is delivered) or creates a fresh file (delivered next time). Import `renameSync`.

- [ ] **Step 4: Copy and verify**

```bash
for p in css frontend mcp-hub workbench; do cp plugins/writeup/hooks/client.mjs plugins/$p/hooks/client.mjs; done
node --test plugins/writeup/test/scan.test.mjs "plugins/*/test/**/*.test.mjs"
```

Expected: all pass, including the frontend, css, mcp-hub and workbench suites.

- [ ] **Step 5: Bump versions and commit**

writeup `0.2.1` in both manifests; frontend `0.3.1` in both manifests. css, mcp-hub and workbench keep their versions (Global Constraints).

```bash
git add plugins/*/hooks/client.mjs plugins/writeup plugins/frontend
git commit -m "fix(client): read Antigravity multi-edit args and drain advisories atomically"
```

### Task 3: Copy button states its status once

Finding 6.

**Files:**

- Modify: `site/src/components/Command.tsx:66-70`

**Interfaces:** none.

- [ ] **Step 1: Replace the live-region ternary with `{tip}`**

The visible tooltip and the screen-reader text stay identical, because both come from the same string.

- [ ] **Step 2: Verify**

Run: `npm run lint && npm run typecheck`
Expected: both exit 0. The site has no unit tests. The rendered text is unchanged by construction.

- [ ] **Step 3: Commit**

```bash
git add site/src/components/Command.tsx
git commit -m "refactor(site): reuse the tooltip text for the copy status"
```

### Task 4: Gate and index

**Files:**

- Modify: `plans/README.md` (add the 015 row under 014)

- [ ] **Step 1: Run the gate**

Run: `npm run check`
Expected: exit 0. The README's generated regions may show new versions only through `site:data`; commit whatever it rewrites.

- [ ] **Step 2: Add the index row and commit**

Row: `| 015 | [Audit fixes](015-audit-fixes.md) | P2 | S | none | DONE (<short sha>) |`

```bash
git add plans/README.md plans/015-audit-fixes.md README.md
git commit -m "docs(plans): add plan 015 audit fixes"
```

## STOP conditions

- `npm run check` fails on something these tasks did not touch: stop and report it; do not fix it here.
- A live Antigravity run shows `multi_replace_file_content` args differing from `{TargetFile, ReplacementChunks[]}`: stop Task 2 and report the observed shape.
