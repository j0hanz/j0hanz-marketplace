# Plan 014: Antigravity CLI support

> **Executor instructions**: Phase 1 has landed. Do Phase 0 before any of Phase 2 or 3:
> every step there depends on an answer Phase 0 records. Record each answer in the
> "Phase 0 answers" section below as you get it, then follow the phase step by step. If
> anything in "STOP conditions" occurs, stop and report; do not improvise. Update this
> plan's row in `plans/README.md` when a phase lands.

## Status

- **Priority**: P2
- **Effort**: L (Phase 2 is one port per plugin with hooks)
- **Risk**: MEDIUM for Phase 2: Antigravity's hook contract differs from Claude's in
  event names, payload, output and tool names, and a `PreToolUse` hook that misreads it
  blocks or passes writes it should not
- **Depends on**: none
- **Planned at**: 2026-10-29, against `5609d00`, with Antigravity CLI 1.4.10 current

## Why this matters

Antigravity CLI (`agy`, Google) runs the same Agent Skills our plugins ship, so most of
the catalog can serve a third client. It reads none of the files the other two share,
though: no catalog, no `.claude-plugin/`, no `hooks/hooks.json`, no `.mcp.json`. Each
plugin needs its own Antigravity manifest, and every plugin with hooks needs a real port.

## Phase 1 (landed)

- `.antigravity-plugin/plugin.json` in the five plugins that ship skills only:
  groundwork, nodejs, prompt, review, typescript-pro.
- `scripts/build-site-data.mjs`: per-plugin `installs: {claude, copilot, antigravity}`,
  per-client hero `steps`, the README `antigravity` region. The Antigravity line exists
  only when the manifest does: `agy plugin install https://github.com/<repo>/tree/main/<folder>`.
- `scripts/validate.mjs`: manifest parity (`name`, `version`, `description`), the 24 KB
  `SKILL.md` limit, `agy plugin validate` per ported plugin when `agy` is on PATH.
- Site: one client picker (Claude Code, Copilot, Antigravity marks) in the hero panel and
  the catalog controls; cards show the chosen client's command or "Not available in …".

## What Antigravity reads (verified 2026-10-29)

Sources: the CLI changelog in `google-antigravity/antigravity-cli` (primary, read in
full), excerpts of antigravity.google/docs (plugins, marketplace, hooks, skills,
subagents), Vercel's port (`vercel/vercel-plugin#356`), MemPalace's investigation
(`MemPalace/mempalace`, `hooks/antigravity/INVESTIGATION.md`).

- **Install**: official marketplace only (`<name>@antigravity-plugins-official`, listing by
  application to Google). Anything else installs by GitHub URL, a repo subfolder included
  ("with branch resolution", per the changelog). Inside a session: `/plugin`.
- **Manifest**: `plugin.json` at the plugin root, or in `.antigravity-plugin/` or
  `.gemini-plugin/`. Components sit at the plugin root, never inside that folder.
  Validated fields: `name` (kebab-case), `author` (string or `{name, url}`), `homepage`
  and `repository` (`https://`), `logo`, `skills`. Unknown fields warn.
- **Skills**: `skills/<n>/SKILL.md`; `name` matches the folder; 24 KB limit; run as
  `/<plugin>:<skill>`; `disable-slash-command: true` hides one from the `/` menu. No
  equivalent of `disable-model-invocation`.
- **Agents**: `agents/<n>.md`, `name` and `description` required, or a root `agents.json`.
  `tools` takes Antigravity tool names, and a wrong name can hang the subagent. `model`
  is `inherit`, `flash` or `pro`.
- **Hooks**: root `hooks.json`; `hooks/hooks.json` is not read. Top-level keys are hook
  names, each holding `enabled` and event arrays; a Claude-style top-level `"hooks"` key
  loads as one hook named `hooks`. Events: `SessionStart`, `PreToolUse`, `PostToolUse`,
  `Stop`, `PreInvocation`, `PostInvocation`. Handler `{type: "command", command,
timeout}` (30 s default). Matchers are regexes over tool names, for tool events only.
  - stdin, camelCase: `conversationId`, `workspacePaths`, `transcriptPath`,
    `artifactDirectoryPath`, `lastUserInput`; tool events add `toolCall {name, args}`
    and `stepIdx`; `Stop` adds `executionNum`, `terminationReason`, `fullyIdle`.
  - stdout: `PreToolUse` → `{decision, reason?, overwrite?}`, decision one of `allow`,
    `deny`, `ask`, `auto_approve`, `force_ask`, `deny_unless_prior_grant`.
    `PostToolUse` → `{}`, no context channel. `Stop` → `{decision: "continue", reason}`
    re-enters the loop with `reason` as a system message; Antigravity caps consecutive
    continuations itself. `SessionStart` and `PreInvocation` → `injectSteps: [{userMessage}
| {ephemeralMessage} | {toolCall}]`.
- **MCP**: root `mcp_config.json`, `{mcpServers: {<n>: {command, args, env, cwd} |
{serverUrl, headers}}}`, `${PLUGIN_ROOT}` and `${PLUGIN_DATA}`; servers are namespaced
  `<plugin>_<server>`; a relative or unset `cwd` resolves against the plugin folder.
- **Validate**: `agy plugin validate <dir> [--strict] [--json]`. `--strict` fails on the
  warnings it raises for other clients' files, which every plugin here carries.

## Phase 0: settle what the docs leave open

Needs a machine with `agy` signed in. Its installer lives on antigravity.google, which a
cloud session may not reach.

1. `agy --version`; `agy plugin install https://github.com/j0hanz/j0hanz-marketplace/tree/main/plugins/review`.
   Confirm the subpath form, then `agy plugin list --json` and `/review:code-quality-review`.
2. `agy plugin validate plugins/review` and `plugins/mcp-hub`: exit status on warnings
   only (validate.mjs assumes 0), and what it says about `.claude-plugin/`,
   `hooks/hooks.json`, `user-invocable`, `disable-model-invocation`, and agent `tools`.
3. Probe hook: a scratch plugin whose root `hooks.json` registers every event with
   matcher `.*` and a command that appends stdin, `env`, `pwd` and argv to a log file.
   Write a file, edit one, run a command, invoke a skill, stop. Record:
   - the exact tool names for create, edit, multi-edit, read, shell and skill calls, and
     the keys inside each `toolCall.args`;
   - whether `${PLUGIN_ROOT}` expands in a hook `command`, and the hook's working directory;
   - any environment variable that marks the client;
   - whether `SessionStart` honors `injectSteps`.
4. Copilot CLI: does it read a root `hooks.json` ahead of `hooks/hooks.json`? If it does,
   an Antigravity-format root file breaks every Copilot hook, and Phase 2 needs another
   place for Antigravity's hooks.
5. filesystem-mcp: does `agy` send MCP roots, or offer a workspace variable for `args` or
   `cwd`?
6. Does `agy plugin install <dir>` work non-interactively under a throwaway `HOME`? If so,
   add an install smoke test to validate.mjs beside Copilot's.

### Phase 0 answers

(none yet)

## Phase 2: port the hooks

Order: frontend, writeup, workbench, tutor, css, mcp-hub. Each plugin lands alone, with
its manifest, so a half-ported plugin is never on Antigravity.

1. Client shims (`hooks/client.mjs` in css, frontend, workbench, writeup;
   `client.cjs` in mcp-hub; the Copilot branch of tutor's `teach_hook.py`): a third
   branch, selected by a `--antigravity` argument that only the Antigravity `hooks.json`
   commands pass (no documented environment variable; Phase 0 step 3 may supply one).
   It maps `toolCall.name` onto the Claude names the scripts match on, `toolCall.args`
   onto `filePath`/`written`/`replacement`, `conversationId` onto the session id and
   `workspacePaths[0]` onto `cwd`. Answers: `deny` → `{decision: 'deny', reason}`,
   `stopContext` → `{decision: 'continue', reason}`, `context` at `SessionStart` →
   `injectSteps`.
2. Findings after a write (css advice, writeup's scan, mcp-hub's post-tool check):
   `PostToolUse` has no context channel, so write them to a per-conversation state file
   and deliver them from a `PreInvocation` hook as an `ephemeralMessage`, then clear it.
3. workbench's prompt briefs (`UserPromptSubmit`, `UserPromptExpansion`):
   `PreInvocation`, reading `lastUserInput`, once per user turn.
4. Each plugin: a root `hooks.json` in Antigravity's schema; `npm run validate` clean;
   `agy plugin validate` clean of errors; the probe session from Phase 0 repeated with the
   plugin installed.
5. mcp-hub's three agents list Claude tools (`Read, Grep, Glob, Bash, Skill`). Give
   Antigravity its own agent files through a root `agents.json`, if Phase 0 step 2 shows
   it can exclude `agents/`; otherwise leave mcp-hub off Antigravity.
6. tutor's `teach/SKILL.md` is 27 KB: split it under 24 KB first.

## Phase 3: filesystem-mcp

Only if Phase 0 step 5 finds a way to hand the server the project directory. Its
`.mcp.json` passes `"cwd": "."` and `--allow-cwd --root-boundary .`; under Antigravity
that resolves to the plugin's install folder, which would expose the wrong tree.

## Never

output-styles and telltale stay Claude Code only: Antigravity has no output styles and
does not run mods.

## STOP conditions

- `agy` rejects `tree/<branch>/<folder>` URLs: the site's and README's Antigravity lines
  are wrong; fix `scripts/build-site-data.mjs` first.
- Copilot reads a root `hooks.json` (Phase 0 step 4) and no other location works for
  Antigravity.
- A probe shows `PreToolUse` input other than `toolCall {name, args}`.

## Done criteria

- Every plugin that is not `claude-code-only` either carries an Antigravity manifest with
  its hooks ported, or has a one-line reason in this plan.
- `npm run check` passes, with `agy plugin validate` run against each ported plugin.
- README's "What differs under Antigravity" lists every remaining difference.
