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
  `Stop`, `PreInvocation`, `PostInvocation`. Handler: `type` (`"command"`), `command`,
  `timeout` (30 s default). Matchers are regexes over tool names, for tool events only;
  `""` or `*` matches every tool.
  - stdin, camelCase: `conversationId`, `workspacePaths`, `transcriptPath`,
    `artifactDirectoryPath`, `lastUserInput`; tool events add `toolCall {name, args}`
    and `stepIdx`; `Stop` adds `executionNum`, `terminationReason`, `fullyIdle`.
  - stdout: `PreToolUse` → `{decision, reason?, overwrite?}`, decision one of `allow`,
    `deny`, `ask`, `auto_approve`, `force_ask`, `deny_unless_prior_grant`.
    `PostToolUse` → `{}`, no context channel. `Stop` → `{decision: "continue", reason}`
    re-enters the loop with `reason` as a system message; Antigravity caps consecutive
    continuations itself. `SessionStart` and `PreInvocation` → `injectSteps`, a list of
    `{userMessage}`, `{ephemeralMessage}` or `{toolCall}`.
  - File tools and their `args` (hooks docs, "Supported tools"): `write_to_file`
    `{TargetFile, Overwrite, CodeContent, Description}`; `replace_file_content`
    `{TargetFile, TargetContent, ReplacementContent, AllowMultiple, StartLine, EndLine}`;
    `multi_replace_file_content` `{TargetFile, ReplacementChunks[]}`; `view_file`
    `{AbsolutePath, StartLine?, EndLine?}`. Also `run_command`, `list_dir`,
    `find_by_name`, `grep_search`, `search_web`, `read_url_content`, `invoke_subagent`.
    `run_command`'s `args` (reportedly `CommandLine`) and the skill tool's name are not
    in the excerpts.
- **MCP**: root `mcp_config.json`: `mcpServers` maps a name to `{command, args, env, cwd}`
  or `{serverUrl, headers}`; `${PLUGIN_ROOT}` and `${PLUGIN_DATA}` expand; servers are
  namespaced `<plugin>_<server>`; a relative or unset `cwd` resolves against the plugin
  folder.
- **Copilot CLI**, for contrast: a legacy plugin's hooks are `hooks.json` or
  `hooks/hooks.json` at its root (GitHub's plugin reference), with no stated precedence
  when both exist. That is why Phase 0 checks it before any root `hooks.json` lands.
- **Validate**: `agy plugin validate <dir> [--strict] [--json]`. `--strict` fails on the
  warnings it raises for other clients' files, which every plugin here carries.

## Phase 0: settle what the docs leave open

Needs a machine with `agy` signed in. Its installer lives on antigravity.google, which a
cloud session may not reach. `scripts/agy-probe/` runs all of it:

```text
node scripts/agy-probe/phase0.mjs setup      # checks, installs, the probe, one agy -p session
node scripts/agy-probe/phase0.mjs report     # writes .agy-probe/report.md: paste it back
node scripts/agy-probe/phase0.mjs clean      # uninstalls agy-probe, removes the files
```

`setup` runs the agy session itself, headless (`agy -p`) in a fresh workspace outside the
repo, so nothing is pasted and agy's reply lands in the report. Then it installs css from
GitHub to see what agy's conversion makes of a Claude Code plugin with hooks, reads the
files back and uninstalls it. `setup --home-test` adds question 6; with no sign-in in that
home, agy may open a browser.

The probe plugin registers every hook event, answers `{}` except an `allow` decision at
PreToolUse (an empty answer denies the tool in agy) and one token ask each at SessionStart and
PreInvocation, and logs each payload with long strings cut and credential-like variables
hidden. Each line goes to the repo log, else the folder the probe runs in, else the temp
folder, and says which paths refused it. It stays installed until `clean`; agy runs its hooks
from the installed copy under `~/.gemini/config/plugins/`, never from `.agy-probe/`. So `setup` refuses while an
earlier run's folder is there, and `clean` removes it only once a successful
`agy plugin list --json` no longer names the plugin (`clean --force` if agy itself is gone).

The report answers, one section each:

1. Does `agy plugin install https://github.com/j0hanz/j0hanz-marketplace/tree/main/plugins/review`
   work? (`review` stays installed.)
2. What does `agy plugin validate` say about review, mcp-hub, css and tutor, and with what
   exit status? validate.mjs assumes 0 on warnings alone.
3. Hooks: every event that fired, the tool names and `toolCall.args` keys, whether
   `${PLUGIN_ROOT}` and a relative `./probe.mjs` work in a hook `command`, the hook's
   working directory, variables agy adds (a client marker), and whether `SessionStart`'s
   `injectSteps` reached the model.
4. Copilot: which of root `hooks.json` and `hooks/hooks.json` ran, in a throwaway
   `COPILOT_HOME`. If the session there cannot sign in, the section says so.
5. MCP: how the servers were launched (cwd, argv, `${PLUGIN_ROOT}` in `args` and `env`),
   the client's declared capabilities, `roots/list`, and what a tool call carries.
6. Whether `agy plugin install` runs non-interactively under a throwaway `HOME`. If so,
   validate.mjs can add an install smoke test beside Copilot's.
7. What `agy plugin install` writes when it converts css: its manifest, hooks and MCP
   files as agy translated them, if it did.

### Phase 0 answers

Run 1, 2026-10-29: agy 1.4.10 on Windows. The agy session step was skipped, so the
payloads, tool names, `injectSteps` and MCP answers (parts of 3, and 5) are still open.

1. **Works.** `agy plugin install https://github.com/j0hanz/j0hanz-marketplace/tree/main/plugins/review`
   clones the repo and installs review with its skill. The site's and README's lines stand.
2. `agy plugin validate` exits 0 on notes and warnings and 1 on errors, so validate.mjs's
   non-strict call is right. A plugin with no Antigravity manifest fails with "This looks
   like a Claude Code plugin: `plugin install` converts it, but it doesn't load as is".
   **`agy plugin install` converts Claude Code plugins.** What the conversion makes of
   `hooks/hooks.json`, `.mcp.json` and agent `tools` is the next thing to see: if it
   translates them, Phase 2 shrinks. A plugin with no `logo` gets a generic icon.
3. From the validator alone: **`${PLUGIN_ROOT}` is not set for hook commands; hooks run
   in the plugin folder**, so commands name scripts as `./hooks/<script>`.
4. **Copilot runs the root `hooks.json` and skips `hooks/hooks.json`** when a plugin has
   both. An Antigravity-format root `hooks.json` would replace every Copilot hook in that
   plugin, so Phase 2 cannot put one there as planned. Ways out, untested: agy's
   conversion (no root file needed at all), or a Copilot-only manifest
   (`.github/plugin/plugin.json`, which Copilot reads before `.claude-plugin/`) whose
   `hooks` field points back at `hooks/hooks.json`.
5. Open.
6. Not run.

Run 2, same machine, with the session run by hand: still nothing logged from agy, not one
hook line and no MCP server start. agy lists agy-probe as enabled, and the probe, run by
hand with the same command, writes the same log. So inside agy the probe either could not
write to the repo or never started; it swallowed its write errors, so the run could not
say which. The kit now writes inside the plugin folder as a fallback, records each refused
path, and runs the session headless so agy's reply is in the report.

Copilot, from the run 1 log: a plugin hook gets `CLAUDE_PLUGIN_ROOT`, `COPILOT_PLUGIN_ROOT`,
`PLUGIN_ROOT`, `CLAUDE_PROJECT_DIR`, `COPILOT_PROJECT_DIR` and `COPILOT_CLI=1`, and its
SessionStart payload is `{hook_event_name, session_id, timestamp, cwd, source: "new",
initial_prompt}`.

Run 3, 2026-10-29, same machine, kit from PR #10: the headless session ran (`agy -p`, exit 0)
and the hooks fired, which settles runs 1-2's silence.

1. Reconfirmed: the subfolder URL installs review.
2. Reconfirmed: exit 0 on notes and warnings (review validates clean, bar the missing-logo
   note), exit 1 on errors (mcp-hub, css and tutor until they get manifests).
3. **Hooks fire, from the installed copy** (`~/.gemini/config/plugins/agy-probe`), with that
   folder as working directory; the log landed beside the probe there. **An absolute-path hook
   command never runs**: 0 events in that form against 30 in the relative form. agy drops it,
   and that is why runs 1-2 logged nothing: their hooks were absolute-form. `${PLUGIN_ROOT}`
   stays unset for hooks; the one variable agy adds is `ANTIGRAVITY_CONVERSATION_ID`. Events
   that fire: SessionStart, PreInvocation (per model step: 9 times for one user turn),
   PreToolUse, PostInvocation, Stop (a `{}` at Stop does not continue: the session ended after
   one Stop). **An empty answer `{}` denies the tool**: every step failed with "denied by the
   pre-tool hook" while the probe answered `{}`, so a ported PreToolUse hook must always emit
   an explicit decision. PostToolUse never fired, because every call was denied first.
   `injectSteps` from SessionStart did not reach the model (token 0 times in the transcript).
   The docs' file tools are not the hook's tool names: `write_file` `{Content, Overwrite,
Path}`, `edit_file` `{Path, Target, Replacement}`, `read_file` `{Path}`, `run_command`
   `{CommandLine, WaitMsBeforeAsync, toolSummary}`, `call_mcp_tool` `{ServerName, ToolName,
Arguments}`, the server namespaced `<plugin>_<server>`. Payload keys beyond the docs:
   `modelName`, `artifactDirectoryPath` (per-conversation folder under
   `~/.gemini/antigravity-cli/brain/`), `stepIdx` on tool events, `initialNumSteps` and
   `invocationNum` on the invocation events, `error`, `executionNum`, `fullyIdle` and
   `terminationReason` on Stop.
4. Reconfirmed under a fresh throwaway home: root `hooks.json` ran, `hooks/hooks.json` did not.
   Still open: what Copilot makes of a root `hooks.json` in Antigravity's format, which is what
   Phase 2 would ship beside Copilot's `hooks/hooks.json`. Run 4 tests it.
5. **MCP servers get what hooks do not**: `${PLUGIN_ROOT}` and `${PLUGIN_DATA}` are set and
   expand in `args` and `env`, servers start in the installed plugin folder, and bare script
   names resolve. The client declares `roots` with `listChanged` and answers `roots/list` with
   the workspace. **Phase 3 has its way: the server can learn the project directory from
   `roots/list`.**
6. Not run (`--home-test` stays off this round: with no sign-in in that home, agy may open a
   browser).
7. **`agy plugin install` converts a Claude Code plugin without translating its hooks**: it
   writes `plugin.json` (name, version, description, author as a string) and copies
   `hooks/hooks.json` verbatim to a root `hooks.json`, `${CLAUDE_PLUGIN_ROOT}` and the
   `powershell` twins left in, Antigravity's schema nowhere. The conversion installs skills
   but cannot run the plugin's hooks, so Phase 2's ports remain.

Run 4, 2026-10-29, same machine, with the probe answering allow at PreToolUse and asking at
PreInvocation: everything still open above is settled, and no STOP condition occurred.

3. **`{"decision": "allow"}` passes a tool call headless**: the session created, edited and
   read probe.txt, called the MCP tool and loaded the skill, all in the fresh workspace, with
   no approval prompts. (`run_command` failed inside agy's own sandbox on this machine,
   `exebox: creating sandbox: CreateProcessSecurityEnvironment`; the hook had allowed it.)
   **PostToolUse fires** after an allowed call, with the same `toolCall` payload plus an
   `error` key (`""` on success). **PreInvocation's `injectSteps` reaches the model** (token
   found once); SessionStart's still does not. There is no skill tool: the model read the
   SKILL.md with `read_file`, so matchers need no skill name.
4. **Copilot tolerates an Antigravity-format root `hooks.json`**: with one beside Copilot's
   `hooks/hooks.json`, Copilot ran `hooks/hooks.json` and the session answered normally.
   Claude Code's `--strict` validate passes with the root file present too. So Antigravity's
   hooks live in a root `hooks.json` in Antigravity's schema, beside `hooks/hooks.json` for
   Claude Code and Copilot: no `.github/plugin/` manifest and no conversion needed.
5. A tool call reaches the server carrying `_meta` with
   `antigravity.google/artifacts_dir`, `antigravity.google/conversation_id`,
   `antigravity.google/root_conversation_id` and a `progressToken`.

Phase 0 is complete; Phase 2 can start.

## Phase 2: port the hooks

Order: frontend, writeup, workbench, tutor, css, mcp-hub. Each plugin lands alone, with
its manifest, so a half-ported plugin is never on Antigravity.

1. Client shims (`hooks/client.mjs` in css, frontend, workbench, writeup;
   `client.cjs` in mcp-hub; the Copilot branch of tutor's `teach_hook.py`): a third
   branch, selected by a `--antigravity` argument that only the Antigravity `hooks.json`
   commands pass (`ANTIGRAVITY_CONVERSATION_ID` also marks a hook, but the argument relies
   on nothing undocumented). It maps `toolCall.name` onto the Claude names the scripts
   match on (`write_file` → Write; `edit_file` → Edit; `read_file` → Read; `run_command` →
   Bash), `toolCall.args` onto `filePath`/`written`/`replacement` (`Path`, `Content`,
   `Replacement`), `conversationId` onto the session id and `workspacePaths[0]` onto `cwd`.
   Answers: every path that does not object answers `{decision: 'allow'}` (an empty answer
   denies), objection → `{decision: 'deny', reason}`,
   `stopContext` → `{decision: 'continue', reason}`, context → `injectSteps` from
   `PreInvocation`; SessionStart's `injectSteps` never reaches the model, so a ported
   SessionStart hook either moves its context to the first PreInvocation or stays out of
   the Antigravity `hooks.json`.
2. Findings after a write (css advice, writeup's scan, mcp-hub's post-tool check):
   `PostToolUse` has no context channel, so write them to a per-conversation state file
   and deliver them from a `PreInvocation` hook as an `ephemeralMessage`, then clear it.
   Run 4 confirmed the channel reaches the model.
3. workbench's prompt briefs (`UserPromptSubmit`, `UserPromptExpansion`):
   `PreInvocation`, reading `lastUserInput`, once per user turn: PreInvocation fires per
   model step (9 times for one prompt in the probe), so the state file must mark a brief
   as delivered and skip the rest.
4. Each plugin: a root `hooks.json` in Antigravity's schema, its commands relative
   (`node ./hooks/<script> … --antigravity`: an absolute command never runs, and
   `${PLUGIN_ROOT}` is unset for hooks), its matchers regexes over agy's tool names
   (`write_file|edit_file`, not `Write|Edit`); `npm run validate` clean;
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
- Copilot reads a root `hooks.json` (Phase 0 step 4: it does) and neither agy's
  conversion nor a Copilot-only manifest gives Antigravity its hooks without one.
- A probe shows `PreToolUse` input other than `toolCall {name, args}`.

## Done criteria

- Every plugin that is not `claude-code-only` either carries an Antigravity manifest with
  its hooks ported, or has a one-line reason in this plan.
- `npm run check` passes, with `agy plugin validate` run against each ported plugin.
- README's "What differs under Antigravity" lists every remaining difference.
