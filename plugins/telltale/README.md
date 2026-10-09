# Telltale

![License](https://img.shields.io/github/license/j0hanz/j0hanz-marketplace)

See what your skills and MCP servers put in front of Claude, which tools it called, what it read back, and what it did next.

## What it is

Telltale is a Claude Code mod (a hooks module). It only observes: it never changes, delays or blocks a tool call, and it opens no network connection. It writes local files only. It needs Claude Code 2.1.288 or later (built and tested against 2.1.294). Copilot CLI does not run mods, so the plugin carries the `claude-code-only` catalog tag.

## Install

```text
/plugin install telltale@j0hanz-marketplace
```

To try it from a clone of the marketplace, start Claude Code with `--plugin-dir plugins/telltale`.

## A turn, end to end

After a main-thread turn that called an MCP tool or expanded a skill, one line appears under the answer:

```text
telltale: 2 MCP calls · 1 error · ~2.1k tok
```

Segments appear only when non-zero, and a `skills: a, b` segment lists expanded skills. Tokens are characters divided by 4, rounded up per call. The count prints as an integer below 1,000, else one decimal with `k`. Built-in tools are never counted.

While you work, without opening anything:

- **Status line.** Session totals since start or the last `/clear`, with Claude Code's share of the context window in use:

  ```text
  telltale · 7 MCP · 1✗ · ~12.6k tok · ctx 61%
  ```

- **Band above the prompt.** While an MCP call runs, it shows the longest-running call, its elapsed time, and the turn so far. It is empty otherwise.

  ```text
  ◐ db.run_query 3s · turn: 2 MCP · ~2.2k tok · 1✗
  ```

- **Transcript.** Each completed MCP call's row gets one dim line beneath its tool line: `812ms · ~1.9k tok`, plus `· error` when it failed. A folded run of calls gets one such line beneath its count line instead, summing its MCP calls: `3 MCP calls · ~1.1k tok`, plus `· 1 error` when any failed.
- **Toast.** At most one per turn, for an MCP call that failed (`db.run_query failed · /telltale`) or that returned 40,000 characters or more (`github.search returned ~15.0k tok`). A failure toast shows as the call completes; a large-result toast waits for the turn to end, and shows only when no call failed that turn.

Run `/telltale` to open the pane on the Calls view, with the newest call selected. Calls is a table (`TOOL`, `SERVER`, `TIME`, `TOK`, `NEXT`), grouped by turn under `turn <N>` separators whose numbers match the log files. Failures are marked `✗` in the error colour. `retried`, `aborted` and `pending` show in the warning colour.

Press Enter to open a call's detail. Its header reads `tool · server · agent · time · chars · tokens · next`; `agent` shows only on a subagent's call, as its task and type. The arguments and the text Claude read follow, coloured as JSON when they are JSON, then the values from the result that showed up in the answer. Press `n` and `p` to step to the older and newer call, `c` and `y` to copy the arguments or the result, and `b` to go back to the list.

Press `2` for the Inventory, which shows what each MCP server, skill and memory file costs in context: totals and shares of the window, a bar per server, how often each server was called, and `never called` on tools loaded but not used. Press `m` there to measure exactly. In the fullscreen layout the pane docks beside the transcript and lets toasts show while it stays open.

`/telltale [calls|inventory]` picks the view. An empty argument or `calls` opens Calls, and `inventory` opens Inventory. Anything else opens Calls and replies `unknown view "<arg>"; views: calls, inventory`.

## The pane

| Key       | Where     | Action                                                                                                  |
| --------- | --------- | ------------------------------------------------------------------------------------------------------- |
| `1`       | anywhere  | Calls view                                                                                              |
| `2`       | anywhere  | Inventory view                                                                                          |
| Up / Down | Calls     | move the selection                                                                                      |
| Enter     | Calls     | open the detail of the selected call                                                                    |
| `b`       | detail    | return to the list                                                                                      |
| `n` / `p` | detail    | the next older / newer call                                                                             |
| `c` / `y` | detail    | copy the arguments / the result text the pane keeps (the first 20,000 characters)                       |
| `m`       | Inventory | measure: ask Claude Code for an exact token count of MCP tools and memory files (skills stay estimates) |
| Esc       | anywhere  | close the pane                                                                                          |

## Settings

Set these in the plugin's settings in Claude Code.

| Setting        | Default            | Meaning                                                                                         |
| -------------- | ------------------ | ----------------------------------------------------------------------------------------------- |
| `logDir`       | `.claude/telltale` | Folder for per-turn logs, relative to the directory the session started in, or an absolute path |
| `fullPayloads` | `false`            | Also log each tool result's full text, redacted, not just the 300-character head and tail       |

## Logs

Files live under `logDir`, relative to the directory the session started in (a later `cd` does not move them):

- `<logDir>/.gitignore` contains `*`. It is written before the first log file.
- `<logDir>/<session-id>/turn-<N>.jsonl` holds one turn's records. When a turn's records exceed 1,000,000 characters they go to `turn-<N>-part<K>.jsonl` files, each under that size. No record is dropped. `N` continues from the highest number already in the folder, so a resumed session appends. Records captured after the last turn of a session, such as a subagent's call after the final answer, are written to that turn's file when the session ends.
- `<logDir>/<session-id>/context-<N>.json` is written at the end of the first turn after the conversation's starting context is built or rebuilt: session start, resume, after `/clear`, after a compaction.

A turn with no records writes no file.

### `call` record

One JSON object per line.

| field            | type                   | meaning                                                                                                                                                                                                                        |
| ---------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `type`           | `"call"`               |                                                                                                                                                                                                                                |
| `tool`           | string                 | tool name, e.g. `mcp__orders__search` or `Read`                                                                                                                                                                                |
| `server`         | string or null         | the `<server>` in `mcp__<server>__<tool>`; null for built-in tools                                                                                                                                                             |
| `agentId`        | string or null         | subagent id, null on the main thread                                                                                                                                                                                           |
| `model`          | string or null         | the model that answered the response that issued the call (the one the request named when no usage was reported); null when no model response streamed the call                                                                |
| `effort`         | string, number or null | the thinking effort that response's request asked for; null for a model without effort                                                                                                                                         |
| `ms`             | number                 | wall time, including any permission decision; see `permission`                                                                                                                                                                 |
| `permission`     | string or null         | `allow` (no permission dialog or classifier, see Known limits), `ask` (put to the dialog or the auto-mode classifier, inside `ms`) or `deny`; the verdict of the rules and the hooks beneath telltale; null when none was seen |
| `permissionRule` | string                 | the settings rule that decided, as written, redacted; only when a rule decided                                                                                                                                                 |
| `args`           | object                 | the arguments, redacted; every string cut to 2,000 characters followed by `…[cut N chars]`                                                                                                                                     |
| `chars`          | number                 | characters of result text Claude read                                                                                                                                                                                          |
| `estTokens`      | number                 | `ceil(chars / 4)`                                                                                                                                                                                                              |
| `isError`        | boolean                | result was an error or was denied                                                                                                                                                                                              |
| `blocks`         | string[]               | content block kinds in the result (e.g. `["text"]`, `["image"]`)                                                                                                                                                               |
| `head`, `tail`   | string                 | first / last 300 characters of the redacted result text                                                                                                                                                                        |
| `next`           | string                 | what Claude did next: `answered`, `retried` (same tool), `other-tool`, `asked-user`, `aborted`, `pending` (subagent still running when the file was written)                                                                   |
| `usedInAnswer`   | string[]               | up to 5 values (at least 4 chars, with a digit) that appear in both the result and the final answer, in result order                                                                                                           |
| `text`           | string                 | the full redacted result text; only when `fullPayloads` is true                                                                                                                                                                |
| `truncated`      | `true`                 | only when a single record exceeded the part limit and its largest fields were replaced by `…[cut N chars]`                                                                                                                     |

### `skill` record

```json
{ "type": "skill", "skill": "<name>", "chars": 1200, "estTokens": 300 }
```

### `apiTool` record

```json
{ "type": "apiTool", "id": "sv1", "name": "advisor", "agentId": null, "args": {}, "ms": 250 }
```

A tool the API ran itself inside a model response (the advisor is one). Claude Code runs no tool hooks for it, so it never counts in the receipt, the totals or the pane, and has no `chars` or `estTokens`: the API reports no result. `id` is the API's id for the use, one record per id in a turn. `args` are redacted and cut like a call's. `ms` is the time the API stamped from start to result, null when the response ended first.

### `context-<N>.json`

```json
{
  "reason": "start",
  "version": "2.1.300",
  "files": [{ "path": "CLAUDE.md", "kind": "...", "chars": 0 }],
  "tools": [{ "tool": "...", "server": "...", "chars": 0, "deferred": false }]
}
```

`reason` is `start`, `clear` or `compact`. `files` are the instruction files loaded (CLAUDE.md and imports). `tools` are the tool descriptions sent so far: `chars` is the length of the description text, and `deferred` is true for a deferred MCP tool listing. `version` is the Claude Code version the session ran on, as `claude --version` prints it; absent when Claude Code could not report it.

### Reading the logs

```bash
jq -r 'select(.type=="call") | [.server // "-", .tool, .ms, .estTokens, .next] | @tsv' .claude/telltale/*/turn-*.jsonl
```

### Known limits

A reload of the mod (editing it under `--plugin-dir`, or changing its settings) during a turn loses that turn's records made before the reload from its log file; the pane keeps its rows. A call whose model response began before the reload gets its `next` label from incomplete data. A call still running when the mod reloads leaves the band and is not recorded.

`permission` is the verdict the engine's rules and the plugins beneath telltale reached. A plugin loaded above telltale may still change it, and the log does not show that. For a tool that always needs the person (a question put to them, or a plan to approve), an `allow` does not dismiss the dialog, so that call's duration includes the person's time even when the detail says no permission dialog was in it. A call whose verdict was never seen (a row saved by an older telltale, or a call still running when the mod reloaded) shows the old caveat in the detail.

## Redaction

Redaction applies to the logs only. The pane shows raw data for the 200 most recent calls; that data stays in the mod's memory and is not readable by other plugins.

Before any cut, these patterns are replaced by `[redacted]` in argument values and result text:

- Anthropic keys (`sk-ant-` prefix) and other `sk-` keys of 20 or more characters
- GitHub tokens (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, 36 or more characters) and `github_pat_` tokens
- GitLab personal access tokens (`glpat-` prefix, 20 or more characters)
- Stripe live secret and restricted keys and webhook signing secrets (`sk_live_`, `rk_live_`, `whsec_`, 20 or more characters)
- npm tokens (`npm_` prefix, 20 or more characters)
- AWS access key IDs (`AKIA` or `ASIA` plus 16 characters)
- Slack tokens (`xox` followed by `a`, `b`, `p` or `r`, then a dash)
- Google API keys (`AIza` plus 35 characters)
- bearer tokens (the token part; the word matches whatever its case)
- JWTs (three dot-separated parts, starting `eyJ`)
- private key blocks (`BEGIN ... PRIVATE KEY` to `END`)

A match may not follow a letter, digit, `_` or `-`, unless that letter ends a JSON escape (`\n`, `\r`, `\t`).

The whole value of any field named `password`, `passwd`, `secret`, `token`, `api_key`, `x_api_key`, `authorization`, `access_token`, `refresh_token`, `id_token`, `auth_token`, `session_token`, `client_secret`, `private_key`, `aws_secret_access_key`, `cookie`, `set_cookie`, `secret_key` or `passphrase` is replaced too. Names match whatever the case, and with `_`, `-` or nothing between their words, so `accessToken`, `Access-Token` and `ACCESS_TOKEN` all match `access_token`. This also applies inside JSON text, such as a result that is a JSON document, when the value is a string. Deeper JSON escaping (a JSON string inside a JSON string inside another) and non-string values inside JSON text are not matched. `usedInAnswer` values are checked one by one, outside their JSON, so only the patterns above apply to them.

Tool, server and skill names, paths and field names are never redacted.

## Headless runs

Under `claude -p` the mod writes the same files and prints nothing of its own to stdout or stderr. No receipt is shown, and `/telltale` replies `the pane needs an interactive session`. A log-write failure goes to Claude Code's debug log (`--debug-file <path>`). In an interactive session the same failure shows one toast per session naming the folder.

## Requirements index

The source and tests cite these IDs (`R1` to `R50`, and "delta R12" and similar). Each line is the current wording. Update the matching line whenever behaviour changes.

- **R1** After a main-thread turn in which Claude or a subagent called an MCP tool or expanded a skill, one receipt line `telltale: …` appears under the answer with MCP call count, error count, `~t tok` (chars ÷ 4, rounded up per call; `k` from 1,000 with one decimal) and `skills:` once each in first-expansion order; built-in tools never count; a call another plugin made via `$.tool.call` never counts (its id was never streamed by a model response), while a call Claude streamed counts whichever plugin's origin it carries; when another hook already set a line under the answer, the receipt follows it.
- **R2** Subagent turns show no receipt; their calls count in the main turn that was running, or, between turns, in the next main turn that ends.
- **R3** Everything that reaches Claude (tool calls, results, descriptions, skill text, system prompt) is byte-identical to a session without the mod; a fault inside the mod never alters or blocks a call.
- **R4** Each completed call is recorded with tool, server, args, ms, chars, estTokens, isError, block kinds, 300-character head and tail, agentId, the model that answered the response that issued it (else the one requested) and the effort requested, `next` and `usedInAnswer`, and the permission verdict and rule (R50).
- **R5** A main-thread turn with at least one record writes that turn's records, one JSON object per line, to its own file (or numbered parts under R15); a turn with no record writes nothing; records that belong to a turn still in flight when the session ends are written at session end, under the number they were captured for.
- **R6** Under `claude -p` the same files are written; nothing of the mod's own goes to stdout or stderr; a write failure is reported only through Claude Code's debug log; `/telltale` replies `the pane needs an interactive session`.
- **R7** Each skill expansion is recorded with skill name, chars and estTokens in the turn it belongs to.
- **R8** When the first turn after a context build ends, a new `context-<N>.json` is written (N past the highest present) with reason `start`, `clear` or `compact`, the instruction files loaded, the tool descriptions sent, and the Claude Code version; only a main-conversation compaction that went ahead counts as `compact`.
- **R9** `/telltale` opens the pane at any width, or reuses and focuses it, showing the view R23 picks, with the newest row selected in Calls.
- **R10** Calls lists the most recent calls since session start or the last `/clear`, up to the 200 R25 keeps, newest first, each row with tool, server, duration, estimated tokens, an error marker and the next action, laid out as R32 says (server and next left out below 50 columns); an empty list shows `No tool calls yet` and `logs: <folder>`, relative to the starting directory with `/` separators.
- **R11** Up/Down move the selection, Enter opens the detail; new calls do not move an existing selection; the detail shows args and the text Claude read (pretty-printed only when the compact JSON round-trips losslessly and the indented form serializes (`JSON.stringify`) to at most 45,000 characters), size, error flag, next action, the permission note (R50) and used-in-answer; `b` returns with the same row selected; Esc closes the pane; with nothing selected, or the selection evicted, the newest call is selected.
- **R12** At main-turn end each call is labelled from its agent's next complete response: `pending` (none yet, agent running), `aborted` (none, agent stopped), `answered` (no tool), `retried` (same tool), `asked-user` (`AskUserQuestion`), `other-tool`; calls from one response share a label; a `pending` row is relabelled in the pane when its agent responds, and becomes `aborted` if the agent stops; when the agent list cannot be read at turn end, every subagent counts as running; the written file keeps `pending`.
- **R13** For each call in the turn, up to 5 values (maximal runs of `[A-Za-z0-9_.:/-]`, trailing `.:/-` trimmed, ≥4 chars, with a digit) that appear in both the result and the main answer, in result order; no answer means an empty list.
- **R14** Before any cut or preview, the listed secret patterns and the whole values of the listed field names, matched ignoring case and `_` or `-` between words (in objects, and string values in JSON text) are replaced with `[redacted]` in argument values, result previews and logged result text, and the secret patterns also in the `usedInAnswer` values; never in tool, server or skill names, paths or field names; a match may not follow a letter, digit, `_` or `-` unless that character ends a JSON escape; a private-key block matches anywhere.
- **R15** Records over the per-file limit are written across numbered parts, none dropped; a single oversized record has its largest fields replaced in turn by `…[cut N chars]` until it fits and is marked `"truncated": true`.
- **R16** If a log write fails, one notice per session names the folder, also across a reload; records stay in the pane; the turn is unaffected.
- **R17** `/clear` empties the Calls view (and returns from a detail); files already written stay.
- **R18** Inventory shows context cost in tokens in three groups, each ordered by cost: MCP tools by server (with loaded/deferred state), skills by plugin or by source (`user`, `project`, `other`), memory files; empty groups say `No MCP servers connected`, `No skills listed`, `No memory files loaded`.
- **R19** The log folder, anchored to the directory the session started in, gets a `.gitignore` containing `*` before its first file.
- **R20** A field over 20,000 characters shows its first 20,000 followed by `<N> chars cut`, as stored, not indented; a field whose JSON-escaped form would pass 45,000 characters shows only the part that fits, with the same cut line.
- **R21** Inventory rows show `est` until `m` is pressed; `m` counts MCP tool and memory file rows exactly and marks them `measured` until the next press; skill rows stay `est`; a second `m` during a count is ignored; a failed count keeps the figures and shows `measure failed: <reason>`.
- **R22** If Claude Code cannot report context usage when the Inventory loads (`/telltale inventory` or `2`), it shows `Context usage unavailable` and Calls keeps working; a failed reload at turn end keeps the figures shown (R43).
- **R23** The pane shows a view row `1: Calls`, `2: Inventory`, the view not shown dim (the detail counts as Calls); `1`/`2` switch; the `/telltale` argument picks the view (case-insensitive, trimmed); an unknown argument opens Calls and replies `unknown view "<argument>"; views: calls, inventory`.
- **R24** Logged string argument values longer than 2,000 characters are cut to 2,000 followed by `…[cut N chars]`, after redaction.
- **R25** The pane keeps the first 20,000 characters of the args (compact JSON) and of the result text, unredacted, for the 200 most recent calls, in the mod's own memory, not in shared plugin state; after a hot reload the detail of earlier calls says so (R47); older calls leave the list, which ends with `<n> older calls are in the logs`.
- **R26** In an interactive session a status entry shows the session totals (counted MCP calls and distinct skills since start or the last `/clear`, kept across a hot reload): `telltale · <n> MCP · <e>✗ · ~<t> tok · <k> skills · ctx <p>%`, each segment only when non-zero or reported; it updates when a counted call completes, at turn end and at `/clear`; with no call and no skill there is no entry.
- **R27** When Claude Code reports no context share (before the first response, or a failed usage report), the status entry drops only its `ctx` segment.
- **R28** In an interactive session, at most one toast per main-thread turn: a failed counted call's toast (`<server>.<tool> failed · /telltale`) shows when the call completes, and a call that returned 40,000 characters or more holds its toast (`<server>.<tool> returned ~<t> tok`) until the turn ends and shows only when no error toast showed that turn; the R16 notice does not count toward the limit.
- **R29** While a counted call runs, the band above the prompt shows `◐ <server>.<tool> <elapsed>` for the longest-running call, ` +<k> running`, then ` · turn: <n> MCP · ~<t> tok` and ` · <e>✗` over the turn's completed calls; elapsed is whole seconds (`<m>m<ss>s` from a minute), never more than 2 seconds behind; parts drop, then the name is cut, to fit.
- **R30** With no counted call running, the band holds no telltale row.
- **R31** While Claude Code shows its survey above the prompt, the band holds no telltale row.
- **R32** Calls is a table with a `TOOL SERVER TIME TOK NEXT` header; the tool loses its `mcp__<server>__` prefix (`↳ ` for a subagent's call), built-ins show server `-`, the label is `…` until the turn ends; columns are two spaces apart, each as wide as its longest value, SERVER at most 12 and TOOL 4 to 32, longer values cut with `…`; below 50 columns SERVER and NEXT are left out.
- **R33** In Calls each `✗` is in the error colour and each `retried`, `aborted` or `pending` label in the warning colour.
- **R34** Calls groups rows by turn, newest first, under `turn <N> · <k> calls · ~<t> tok`; `<N>` is the turn file's number, a failed write still uses its number, and a call between turns joins the next turn.
- **R35** Each view ends with a dim key row: `↑↓ select · enter open · esc close`, `n/p older/newer · c copy args · y copy result · b back`, `m measure · esc close`; messages sit above it.
- **R36** The detail header reads `<tool> · <server> · agent <name> · <dur> · <c> chars · ~<t> tok · <next>`, then ` · error` in the error colour; server and agent parts only where they apply; `<name>` is the subagent's `<task> (<type>)` from the agent list, cut to 24 characters, or its id when telltale never saw it listed (a running subagent's calls show the id until a main turn ends).
- **R37** The detail draws arguments and result as JSON code when the shown text parses as JSON, plain otherwise, changing no character.
- **R38** In the detail `n` shows the next older call and `p` the next newer one; at the ends nothing changes; `b` returns with the call last shown selected.
- **R39** In the detail `c` copies the arguments and `y` the result text the pane keeps (R25), and the view shows `copied <k> chars` or `copied <k> of <total> chars` until the next press, focus move or view change.
- **R40** A copy Claude Code refuses shows `copy failed: <reason>`; a call whose text was not kept after a hot reload shows `copy failed: text not kept after a reload` and makes no copy request.
- **R41** Each Inventory group title shows its total and `<p>% of <window>`; each MCP server heading reads `<server>  <bar>  <t> tok · <p>% · <usage>`, the bar 20 cells by share of the costliest server, rounded half up, at least 1 above zero.
- **R42** A server heading's usage is the counted calls matching its tool rows by full name (`<n> calls · <e>✗ · ~<t> read`, or `never called`); a tool row with no counted call shows `never called`.
- **R43** An open Inventory reloads Claude Code's estimate at each main-thread turn end; measured rows keep their figures; a failed reload keeps the figures shown.
- **R44** In an interactive session a completed counted call the pane keeps gets one dim line beneath its transcript tool line, `<dur> · ~<t> tok` (` · error` when it failed); a folded group of tool calls that is no longer active gets one dim line beneath its count line instead, `<k> MCP call(s) · ~<t> tok` (` · <n> error(s)` when any failed), summing its completed counted calls the pane keeps, and none when it has none or the host does not identify its calls; an expanded group's calls get their own lines; the engine's rows are drawn unchanged; running, built-in and evicted calls get none.
- **R45** `/telltale` in the fullscreen layout opens the pane without holding toasts; on the main screen it holds them until it closes.
- **R46** A telltale drawing that fails leaves the band and transcript rows as Claude Code draws them, shows no status entry or toast, and keeps the pane open with its view row, `this view could not be drawn` and its key row.
- **R47** A hot reload keeps the Calls rows and labels, the selection, the view, the session totals, the turn counter, the turn's toast, fired or held, the measured Inventory figures and the subagent names; it drops the kept argument and result text of earlier calls.
- **R48** No pane or band row is wider than the drawable width; a longer row is cut with `…`, except the detail's argument and result text, which scroll.
- **R49** Each tool call the API ran itself inside a model response, on the main thread or in a subagent, is recorded once per id as an `apiTool` record in the turn it belongs to, with id, name, agentId, redacted and cut args, and ms (null when the response ended before its result); it counts in no receipt, total, status entry, toast, band or pane row.
- **R50** Each call records the `tool.check` verdict the tiers beneath telltale reached (`allow`, `ask` or `deny`, null when none was seen) and the settings rule that decided, redacted; the detail reads `duration includes a permission decision (dialog or classifier)` for `ask`, `no permission dialog or classifier in this time` for `allow` or `deny`, and `duration includes any permission prompt` when the verdict is unknown; for a tool that always needs the person, an `allow` does not dismiss its dialog, so its duration still includes the person's time; telltale's `tool.check` hook returns exactly what `next(e)` returned.

## License

MIT. See the [LICENSE](../../LICENSE) at the repository root.
