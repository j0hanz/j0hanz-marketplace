---
name: write-hooks
description: Use when writing hooks, auditing existing hooks, or reviewing hook system for coherence.
---

# Writing hooks

Hook = **contract**, not script. Five lines settle it: what fires it, what it reads,
what it emits, what happens on fail, how confirm fired. Write those before code.

Default shape: `type: "command"`, bash + `jq`, shell form, shipped in plugin's
`hooks/hooks.json` against `${CLAUDE_PLUGIN_ROOT}`. Deviate only where step says so.

**Route:** authoring → work steps. Hooks already exist → [Audit](#audit).
"It isn't firing" → [Not firing](#not-firing).

## 1. Name the job

One hook, one job. Hook that gates _and_ logs = two hooks — fail differently, belong on different failure postures.

| job         | it does                            | typical events                                        | channel                                                                      | when its own check breaks                                             |
| :---------- | :--------------------------------- | :---------------------------------------------------- | :--------------------------------------------------------------------------- | :-------------------------------------------------------------------- |
| **gate**    | decides whether something proceeds | `PreToolUse`, `PermissionRequest`, `Stop`             | `permissionDecision` · `decision:"block"`                                    | exit 0 + `systemMessage`. **Gate that cannot evaluate must not deny** |
| **brief**   | puts facts in agent's context      | `SessionStart`, `UserPromptSubmit`, `PostToolBatch`   | `hookSpecificOutput.additionalContext`                                       | emit nothing                                                          |
| **reflex**  | side effect only, decides nothing  | `PostToolUse` (`async`), `Notification`, `SessionEnd` | none synchronously — `async` + `asyncRewake` still reaches agent (pattern 6) | emit nothing                                                          |
| **rewrite** | changes payload in flight          | `PreToolUse`, `PostToolUse`, `MessageDisplay`         | `updatedInput` · `updatedToolOutput` · `displayContent`                      | emit nothing; original stands                                         |

Last column load-bearing: blocking session cuz `jq` missing turns lint problem
into stuck terminal. Hooks not security boundary anyway — `if` filter fails open by
design, hook's `allow` overridden by any deny rule in permission system.

**Done when:** name job in one word, say what hook must _not_ also do.

## 2. Pick event, defend neighbour

Most bad hooks on adjacent event. Say why neighbour loses.

- **`PreToolUse` vs `PermissionRequest`** — `PreToolUse` runs every tool call, before any
  permission check, in _every_ mode incl `bypassPermissions`. Policy user
  can't opt out of goes there. `PermissionRequest` runs only when Claude Code about to ask _you_ —
  "answer on my behalf" goes there.
- **`PostToolUse` vs `PostToolBatch`** — `PostToolUse` fires once per tool, runs concurrently
  across parallel batch, so never sees the set. `PostToolBatch` fires exactly once with
  every call in batch. Anything keyed on _what this batch touched_ belongs there. Their
  `tool_response` shapes differ: `PostToolUse` gets tool's structured output object,
  `PostToolBatch` gets serialized result model sees.
- **`PostToolUse` vs `Stop`** — matcher on `Edit|Write` misses every file Claude writes by
  shelling out through Bash. Hook must see _every_ change → sweep tree once per turn
  at `Stop` instead of catching each call.
- **`UserPromptSubmit` vs `UserPromptExpansion`** — typing `/skillname` never calls Skill
  tool, so no `PreToolUse` fires. `UserPromptExpansion` only event on that path.
- **`Stop` vs `TaskCompleted`** — `Stop` means turn ended, not same as work
  finishing. `TaskCompleted` fires when task actually being closed.

`SessionStart` and `Setup` run with no conversation loaded: `command` and `mcp_tool` handlers
only — no other handler type supported there.

**Done when:** name the one event, the one rejected, with reason.

## 3. Narrow trigger

Two filters, cheapest first. `matcher` picks group; `if` decides whether process spawns
at all. Narrowing here beats exiting early inside script — latter still pays for
process on every tool call.

**What matcher compared against** not same string on every event:

| events                                                                                          | matched against             |
| :---------------------------------------------------------------------------------------------- | :-------------------------- |
| `PreToolUse` `PostToolUse` `PostToolUseFailure` `PermissionRequest` `PermissionDenied`          | `tool_name`                 |
| `SubagentStart` `SubagentStop`                                                                  | `agent_type`                |
| `SessionStart` `ConfigChange`                                                                   | `source`                    |
| `Setup` `PreCompact` `PostCompact`                                                              | `trigger`                   |
| `SessionEnd`                                                                                    | `reason`                    |
| `Notification`                                                                                  | `notification_type`         |
| `UserPromptExpansion`                                                                           | `command_name`              |
| `FileChanged`                                                                                   | **basename** of file        |
| everything else (`Stop`, `UserPromptSubmit`, `PostToolBatch`, `TaskCompleted`, `CwdChanged`, …) | nothing — `matcher` ignored |

How matcher itself read depends on chars in it:

- omitted, `""`, `"*"`, or `".*"` → every occurrence.
- only letters, digits, `_`, `-`, spaces, `,`, `|` → exact string, or list separated by `|`
  or `,`. (On `FileChanged` exact-match set narrower — letters, digits, `_`, `|` only —
  so anything with dot takes regex path.)
- anything else → **unanchored JavaScript regex**. `Edit.*` therefore also matches
  `NotebookEdit`. Anchor it: `^Edit$`. Same for plugin subagent types, colon in
  `plugin:agent` forces regex path: `^my-plugin:reviewer$`.
- MCP tools need wildcard: `mcp__memory__.*`. Bare `mcp__memory` contains only exact-match
  chars, compared as literal string, matches nothing. Plugin's own bundled
  server scoped further: `mcp__plugin_<plugin>_<server>__<tool>`.

`if` holds exactly one permission rule — no `&&`, no `||`, no lists. Two conditions = two
handlers. Evaluated **only** on `PreToolUse`, `PostToolUse`, `PostToolUseFailure`,
`PermissionRequest`, `PermissionDenied`; any other event, handler carrying `if` filtered
out, never runs. For Bash checks each subcommand plus contents of
`$()` and backticks, strips leading `VAR=value`. Rule sees command as written, so wrappers hide what it
matches: `sudo rm -rf`, `xargs rm`, aliases never satisfy `Bash(rm *)` — and cuz `if`
stops process from spawning, no script runs to catch them either. Gate on destructive
command trades narrowing for coverage: spawn on bare `matcher`, parse inside script. Fails open when command won't parse.

```json
{
  "matcher": "Bash",
  "hooks": [
    {
      "type": "command",
      "if": "Bash(git push *)",
      "command": "\"${CLAUDE_PLUGIN_ROOT}\"/hooks/guard-push.sh",
      "timeout": 5
    }
  ]
}
```

**Done when:** hook process doesn't spawn on calls it couldn't act on.

## 4. Capture real payload

Capture one instead of writing fixture. Shell layers eat backslashes — hand-built payload
carrying Windows path like `C:\\Users\\...` arrives as invalid JSON, debug fixture
instead of hook. Register capture handler, trigger once, keep file:

```json
{
  "type": "command",
  "command": "cat > \"${CLAUDE_PLUGIN_DATA}/last-payload.json\""
}
```

Every payload carries `session_id`, `cwd`, `hook_event_name`, `transcript_path`, usually
`permission_mode`; inside subagent also `agent_id`, `agent_type`. Read rest
off captured file. Two fields worth knowing without capturing: `transcript_path` written
asynchronously, lags live conversation — on `Stop`/`SubagentStop` read
`last_assistant_message` instead of parsing transcript; `stop_hook_active` tells
`Stop` hook it's already inside continuation it caused.

**Done when:** real payload on disk to replay against.

## 5. Write contract, then code

Put contract in comment header, then satisfy it:

```bash
# fires:  PreToolUse, matcher Bash, if Bash(git push *)
# reads:  .tool_input.command
# emits:  deny + a replacement command, or nothing
# fails:  jq missing or parse error -> exit 0, systemMessage, guard inert
# verify: bash hooks/guard-push.sh < last-payload.json; echo $?
```

**Pick one output channel, stay on it.** Exit codes _or_ JSON on exit 0. On exit 2 message
Claude sees is stderr — JSON not consulted for it.

- **0** — no objection. Not approval: normal permission flow still runs.
- **2** — block. stderr becomes message. What "block" means per-event; events that can't
  block just show stderr and continue.
- **anything else** — non-blocking error. Action proceeds, transcript shows `hook
error` notice. **Exit 1 does not block.** Bare `set -e` in guard turns failed `grep` into
  exit 1, guard silently fails open; with `set -Eeuo pipefail`, guard every check
  allowed to not match. One exception: `WorktreeCreate`, any failure aborts.

JSON on exit 0, routed by who reads it. Sending message down wrong reader's channel lands
it nowhere useful:

| reader | field                                     | where it lands                                          |
| :----- | :---------------------------------------- | :------------------------------------------------------ |
| agent  | `hookSpecificOutput.additionalContext`    | system reminder beside tool result, prompt, or turn end |
| agent  | `permissionDecisionReason` (on `deny`)    | tool error Claude reads and reacts to                   |
| agent  | `reason` (with `decision: "block"`)       | feedback Claude acts on                                 |
| human  | `systemMessage`                           | warning line in transcript                              |
| human  | `stopReason` (with `continue: false`)     | why everything halted                                   |
| human  | `statusMessage` (hook config, not output) | spinner text while hook runs                            |
| human  | `terminalSequence`                        | desktop notification, window title, bell                |

Rules that fall out of that table:

- `additionalContext` must be **nested inside `hookSpecificOutput` alongside `hookEventName`**.
  At top level stripped silently — hook that says nothing, reports nothing, almost
  always this. `hookEventName` required; omit it, output not applied.
- Write context as **facts, not orders**. "This repo uses `bun test`" works; "You must run bun
  test before finishing" reads as injected instruction, trips prompt-injection defenses,
  gets surfaced to user instead of used.
- Deny reason names the **repair**: "Use `rg`, not `grep` — respects .gitignore here" beats
  "blocked by policy". Refusal with no alternative gets retried verbatim. `PreToolUse` also
  accepts `additionalContext`, so gate can explain itself without denying.
- `updatedInput` honored with `allow` or `ask` (on `PermissionRequest`: `allow` only); other
  combos undocumented — pair it with explicit decision. `deny` plus `updatedInput`
  drops rewrite.
- Hooks run with **no controlling terminal**; `/dev/tty` fails. Emit `terminalSequence` instead
  — OSC `0`/`1`/`2`/`9`/`99`/`777` and BEL only, anything else drops whole field.
- stdout must be **only** JSON object. Shell profile echoing on startup corrupts it;
  wrap such echoes in `if [[ $- == *i* ]]`. Output not starting with `{` treated as plain
  text, which several events accept as context. Strings cap at 10,000 chars, then spill to file.

Reach past `type: "command"` only for a reason: `prompt` when decision needs judgment
input alone supports, `agent` when needs to read files or run suite first, `http` to hand
decision to a service, `mcp_tool` to call tool on already-connected server. `prompt` and
`agent` answer `{"ok": bool, "reason": str}` and nothing else, inert on
`PermissionRequest` and `PermissionDenied`.

Load [PATTERNS.md](PATTERNS.md), adapt closest pattern rather than starting cold.

**Done when:** each of five contract lines true of code written.

## 6. Shipping in a plugin

Plugin hook runs on machines you don't own. That's the whole difference.

- **Declare dependency.** `hooks/hooks.json` takes top-level `description` — name `jq`
  there and in README, degrade instead of dying: `command -v jq >/dev/null || { echo
'{"systemMessage":"<name>: jq not found, guard inactive"}'; exit 0; }`. Undeclared `jq` is
  most common way shipped hook breaks for someone else.
- **Quote every placeholder in shell form**: `"${CLAUDE_PLUGIN_ROOT}"/hooks/x.sh`. Exec form
  (`"command": "bash", "args": ["${CLAUDE_PLUGIN_ROOT}/hooks/x.sh"]`) substitutes each element
  as plain string, no shell parsing at all.
- **Windows**: shell form runs Git Bash, or PowerShell when Git Bash absent — where bash
  script won't parse. Either ship `.ps1` twin registered with `"shell": "powershell"`, or
  state bash-only in description. Commit hook scripts with LF endings (`*.sh text
eol=lf` in `.gitattributes`) — CRLF breaks bash under Git Bash, most common Mac→Windows
  failure. In PowerShell use `$env:CLAUDE_PLUGIN_ROOT`; bare
  `$CLAUDE_PLUGIN_ROOT` resolves to `$null`, silently strips path prefix. Exec form on
  Windows can't spawn `.cmd` or `.bat` shims. `commandWindows` is **not** a field; accepted, ignored.
- **`${CLAUDE_PLUGIN_ROOT}` moves on every update.** Never write state there — use
  `${CLAUDE_PLUGIN_DATA}`, survives updates. After mid-session plugin update, hooks keep
  running old path until `/reload-plugins`.
- **User config**: `${user_config.KEY}` rejected in shell-form command, cuz
  substituted value would be re-parsed by shell. Put in exec-form `args`, or read
  `$CLAUDE_PLUGIN_OPTION_<KEY>` from environment.

Outside plugin same shapes apply with `${CLAUDE_PROJECT_DIR}` and `.claude/settings.json`.
Hooks in skill or agent frontmatter scoped to that component's lifetime; `once: true`
honored _only_ in skill frontmatter. **`Stop` hook in agent frontmatter silently
re-registered as `SubagentStop`** — write it expecting that payload.

## 7. Verify it fired

```bash
bash hooks/guard-push.sh < last-payload.json; echo "exit=$?"  # should act
bash hooks/guard-push.sh < benign.json;       echo "exit=$?"  # should stay silent
echo '{}'   | bash hooks/guard-push.sh;       echo "exit=$?"  # empty payload
echo 'junk' | bash hooks/guard-push.sh;       echo "exit=$?"  # not even JSON
```

Then `/hooks` confirm registered under right event, source expected. Then
real thing: `claude --debug-file /tmp/h.log`, trigger it, read log —
`CLAUDE_CODE_DEBUG_LOG_LEVEL=verbose` adds matcher-level detail.

Hook injecting context can't be judged from Claude's reply — injection upstream of
everything you see, good answer proves nothing. Read transcript file; block's in
there verbatim.

**Done when:** watched it fire _and_ watched it correctly not fire, malformed
case exited 0 instead of erroring.

## Several hooks, one event

- Every matching hook runs **in parallel, to completion**. One hook's `deny` doesn't cancel
  another's side effects — log line already written.
- `PreToolUse` precedence: `deny` > `defer` > `ask` > `allow`. Two hooks rewriting same
  call: last to finish wins, non-deterministic order. Never have two.
- Every hook's `additionalContext` kept; Claude receives all of them.
- Identical handlers deduplicated by command string + args (URL for HTTP hooks) — across
  sources, not per plugin. Comparison runs on raw strings before
  `${CLAUDE_PLUGIN_ROOT}` expansion, so two plugins shipping same script path dedupe to
  **one** run, other silently dropped. Name each plugin's hook script uniquely.
- Hooks **merge** across settings levels rather than replacing. Plugin's hook runs alongside
  user's and project's. Hook's `allow` never overrides deny rule from any scope, `ask` rule
  still sends call through full permission pipeline.

## Firing over and over

- **Hot path.** `PreToolUse` and `PostToolUse` fire every tool call. 200ms hook across
  few hundred calls = minute of wall clock. Narrow with `if` so process never spawns.
- **Async anything non-decisive.** `"async": true` (command hooks only) lets Claude keep working;
  hook's `additionalContext` arrives next turn. Async hook decides nothing — action
  already happened. `asyncRewake` plus exit 2 only way it reaches idle session.
- **Idempotent.** Same hook fires on same file many times per session. Worse, on
  `--resume` transcript **replays** old `additionalContext` verbatim rather than re-running
  hook, so commit SHA or timestamp injected goes stale, Claude reads it as current.
  Emit facts that stay true, or emit nothing. `SessionStart` does re-run on resume.
- **Loop guards.** `PostToolUse` hook whose output prompts another edit re-fires itself —
  formatter reports diff, Claude edits, hook reports again. Gate on _state_ (content
  hash, marker file), not event. For `Stop` and `SubagentStop`, read `stop_hook_active`,
  exit 0 when true; after 8 consecutive blocks Claude Code overrides hook anyway.
- **That flag exists only on `Stop` and `SubagentStop`.** `TeammateIdle`, `TaskCompleted`, and
  `TaskCreated` also fire repeatedly on same subject with nothing equivalent, so own loop
  safety there:
  - Hook injecting into transcript it later parses is in feedback loop with itself.
    Prefix injected text, skip it on read — tool results are user-role entries too.
  - Key counter on `session_id`+`agent_id`, make "gave up" a **distinct state** from "never
    fired". Deleting entry at cap re-arms gate on next fire, turning cap of two
    into two per event, unbounded.
  - Fail open at every parse. Missed intervention costs one message you'll notice; false
    positive traps agent in loop it can't exit by complying.
- **Timeouts.** 600s default for command, HTTP, MCP handlers; `UserPromptSubmit` 30s;
  `prompt` 30s; `agent` 60s. All `SessionEnd` hooks share **1.5s** budget — set explicit
  `timeout` (up to 60s) if cleanup needs longer. `UserPromptSubmit` hook that times out is
  cancelled, context discarded — since v2.1.196 transcript shows notice naming hook and
  timeout; earlier versions cancel silently.

## Audit

### Enumerate before judging

Hook config **merges** rather than replaces, so any single settings file holds fraction of
what actually runs. Six sources feed one event:

```
~/.claude/settings.json          .claude/settings.json      .claude/settings.local.json
managed policy settings          <plugin>/hooks/hooks.json  skill + agent frontmatter
```

`/hooks` only merged view — every handler with source it came from, incl ones
nobody remembers installing. Read it first, then open files behind whatever it names. Enabled
plugins usual surprise: check `enabledPlugins` in user settings, read
`hooks/hooks.json` of each one that's `true`. Frontmatter hooks scoped to live skill or
agent, won't appear till that component active.

Then reproduce, don't infer. Replay each handler against captured payload, read exit
code — hook that looks like guard but returns 1 is most common finding, reading
script rarely reveals it:

```bash
bash path/to/hook.sh < payload.json; echo "exit=$?"
```

### Rank what you find

Fix in this order, cuz earlier defect sits, more it silently costs.

1. **Guards that don't guard** — exit 1 instead of 2; `set -e` with unguarded `grep`; `deny`
   carrying `updatedInput`; `allow` mistaken for security grant.
2. **Hooks that never fire** — `if` on non-tool event; `mcp__server` with no `__.*`;
   unanchored regex matcher; matcher compared against something other than what author
   assumed; `Stop` hook in agent frontmatter still written for `Stop` (step 6).
3. **Says nothing** — `additionalContext` at top level; deny reason with no repair;
   imperative context shown to user instead of used.
4. **Hot-path cost** — empty matcher on tool event = process per tool call; blocking
   hooks doing non-decisive work should be `async`; no `timeout` on tests or network calls.
5. **Portability** — undeclared `jq`; unquoted `${CLAUDE_PLUGIN_ROOT}`; bare `$VAR` in
   PowerShell hook; state written under plugin root.

Report each finding as `source → event → handler` plus one-line fix. Don't rewrite hooks
was asked to review until user picks which findings to apply.

## Not firing

In order — stop at first that explains it.

1. `/hooks` — listed under event, from source expected? Absent means invalid JSON
   (trailing comma usual cause) or wrong settings file.
2. Matcher: case-sensitive; exact-match vs regex depends on chars in it; may not
   be compared against what assumed — check table in step 3.
3. `if` set on non-tool event removes handler entirely.
4. Wrong event for path. `PreToolUse` doesn't fire for files pulled in with `@` in prompt
   — those inlined with no tool call. Typing `/skillname` skips Skill tool.
   `PostToolUseFailure` skips permission denials and validation errors. `Stop` hook in agent
   frontmatter running as `SubagentStop` (step 6).
5. `claude --debug-file /tmp/h.log`, reproduce, read log.
6. Replay captured payload by hand. If script works standalone, defect's in
   wiring, not code.
7. `command not found` → use absolute path or `${CLAUDE_PLUGIN_ROOT}`; on macOS/Linux
   confirm `chmod +x`, or invoke through `bash` so bit doesn't matter.
