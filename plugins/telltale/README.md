# Telltale

![License](https://img.shields.io/github/license/j0hanz/j0hanz-marketplace)

See what your skills and MCP servers put in front of Claude, which tools it called, what it read back, and what it did next.

## What it is

Telltale is a Claude Code mod (a hooks module). It only observes: it never changes, delays or blocks a tool call, and it opens no network connection. It writes local files only. It needs Claude Code 2.1.287 or later (built and tested against 2.1.288). Copilot CLI does not run mods, so the plugin carries the `claude-code-only` catalog tag.

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

Run `/telltale` to open the pane on the Calls view, with the newest call selected. Press Enter to open its detail: the arguments, the text Claude read, its size, whether it was an error, what Claude did next, and which values from the result showed up in the answer. Press `b` to go back to the list. Press `2` for the Inventory, which shows what each MCP server, skill and memory file costs in context. Press `m` there to measure exactly.

`/telltale [calls|inventory]` picks the view. An empty argument or `calls` opens Calls, and `inventory` opens Inventory. Anything else opens Calls and replies `unknown view "<arg>"; views: calls, inventory`.

## The pane

| Key       | Where     | Action                                                                                                  |
| --------- | --------- | ------------------------------------------------------------------------------------------------------- |
| `1`       | anywhere  | Calls view                                                                                              |
| `2`       | anywhere  | Inventory view                                                                                          |
| Up / Down | Calls     | move the selection                                                                                      |
| Enter     | Calls     | open the detail of the selected call                                                                    |
| `b`       | detail    | return to the list                                                                                      |
| `m`       | Inventory | measure: ask Claude Code for an exact token count of MCP tools and memory files (skills stay estimates) |
| Esc       | anywhere  | close the pane                                                                                          |

## Settings

Set these in the plugin's settings in Claude Code.

| Setting        | Default            | Meaning                                                                                   |
| -------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| `logDir`       | `.claude/telltale` | Folder for per-turn logs, relative to the session's working directory                     |
| `fullPayloads` | `false`            | Also log each tool result's full text, redacted, not just the 300-character head and tail |

## Logs

Files live under `logDir`, relative to the session's working directory:

- `<logDir>/.gitignore` contains `*`. It is written before the first log file.
- `<logDir>/<session-id>/turn-<N>.jsonl` holds one turn's records. When a turn's records exceed 1,000,000 characters they go to `turn-<N>-part<K>.jsonl` files, each under that size. No record is dropped. `N` continues from the highest number already in the folder, so a resumed session appends.
- `<logDir>/<session-id>/context-<N>.json` is written at the end of the first turn after the conversation's starting context is built or rebuilt: session start, resume, after `/clear`, after a compaction.

A turn with no records writes no file.

### `call` record

One JSON object per line.

| field          | type           | meaning                                                                                                                                                      |
| -------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `type`         | `"call"`       |                                                                                                                                                              |
| `tool`         | string         | tool name, e.g. `mcp__orders__search` or `Read`                                                                                                              |
| `server`       | string or null | the `<server>` in `mcp__<server>__<tool>`; null for built-in tools                                                                                           |
| `agentId`      | string or null | subagent id, null on the main thread                                                                                                                         |
| `ms`           | number         | wall time including any permission prompt                                                                                                                    |
| `args`         | object         | the arguments, redacted; every string cut to 2,000 characters followed by `…[cut N chars]`                                                                   |
| `chars`        | number         | characters of result text Claude read                                                                                                                        |
| `estTokens`    | number         | `ceil(chars / 4)`                                                                                                                                            |
| `isError`      | boolean        | result was an error or was denied                                                                                                                            |
| `blocks`       | string[]       | content block kinds in the result (e.g. `["text"]`, `["image"]`)                                                                                             |
| `head`, `tail` | string         | first / last 300 characters of the redacted result text                                                                                                      |
| `next`         | string         | what Claude did next: `answered`, `retried` (same tool), `other-tool`, `asked-user`, `aborted`, `pending` (subagent still running when the file was written) |
| `usedInAnswer` | string[]       | up to 5 values (at least 4 chars, with a digit) that appear in both the result and the final answer, in result order                                         |
| `text`         | string         | the full redacted result text; only when `fullPayloads` is true                                                                                              |
| `truncated`    | `true`         | only when a single record exceeded the part limit and its largest fields were replaced by `…[cut N chars]`                                                   |

### `skill` record

```json
{ "type": "skill", "skill": "<name>", "chars": 1200, "estTokens": 300 }
```

### `context-<N>.json`

```json
{
  "reason": "start",
  "files": [{ "path": "CLAUDE.md", "kind": "...", "chars": 0 }],
  "tools": [{ "tool": "...", "server": "...", "chars": 0, "deferred": false }]
}
```

`reason` is `start`, `clear` or `compact`. `files` are the instruction files loaded (CLAUDE.md and imports). `tools` are the tool descriptions sent so far: `chars` is the length of the description text, and `deferred` is true for a deferred MCP tool listing.

### Reading the logs

```bash
jq -r 'select(.type=="call") | [.server // "-", .tool, .ms, .estTokens, .next] | @tsv' .claude/telltale/*/turn-*.jsonl
```

## Redaction

Redaction applies to the logs only. The pane shows raw data for the 200 most recent calls.

Before any cut, these patterns are replaced by `[redacted]` in argument values and result text:

- Anthropic keys (`sk-ant-` prefix) and other `sk-` keys of 20 or more characters
- GitHub tokens (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, 36 or more characters) and `github_pat_` tokens
- AWS access key IDs (`AKIA` plus 16 characters)
- Slack tokens (`xox` followed by `a`, `b`, `p` or `r`, then a dash)
- Google API keys (`AIza` plus 35 characters)
- bearer tokens (the token part)
- JWTs (three dot-separated parts, starting `eyJ`)
- private key blocks (`BEGIN ... PRIVATE KEY` to `END`)

A match may not follow a letter, digit, `_` or `-`, unless that letter ends a JSON escape (`\n`, `\r`, `\t`).

The whole value of any field named `password`, `passwd`, `secret`, `token`, `api_key`, `apikey`, `api-key`, `authorization`, `access_token`, `refresh_token` or `client_secret` (case-insensitive) is replaced too.

Tool, server and skill names, paths and field names are never redacted.

## Headless runs

Under `claude -p` the mod writes the same files and prints nothing of its own to stdout or stderr. No receipt is shown, and `/telltale` replies `the pane needs an interactive session`. A log-write failure goes to Claude Code's debug log (`--debug-file <path>`). In an interactive session the same failure shows one toast per session naming the folder.

## Requirements index

The source and tests cite these IDs (`R1` to `R25`, and "delta R12" and similar). Each line is the current wording. Update the matching line whenever behaviour changes.

- **R1** After a main-thread turn in which Claude or a subagent called an MCP tool or expanded a skill, one receipt line `telltale: …` appears under the answer with MCP call count, error count, `~t tok` (chars ÷ 4, rounded up per call; `k` from 1,000 with one decimal) and `skills:` once each in first-expansion order; built-in tools never count; a call another plugin made via `$.tool.call` never counts; when another hook already set a line under the answer, the receipt follows it.
- **R2** Subagent turns show no receipt; their calls count in the main turn that was running, or, between turns, in the next main turn that ends.
- **R3** Everything that reaches Claude (tool calls, results, descriptions, skill text, system prompt) is byte-identical to a session without the mod; a fault inside the mod never alters or blocks a call.
- **R4** Each completed call is recorded with tool, server, args, ms, chars, estTokens, isError, block kinds, 300-character head and tail, agentId, `next` and `usedInAnswer`.
- **R5** A main-thread turn with at least one record writes that turn's records, one JSON object per line, to its own file (or numbered parts under R15); a turn with no record writes nothing.
- **R6** Under `claude -p` the same files are written; nothing of the mod's own goes to stdout or stderr; a write failure is reported only through Claude Code's debug log; `/telltale` replies `the pane needs an interactive session`.
- **R7** Each skill expansion is recorded with skill name, chars and estTokens in the turn it belongs to.
- **R8** When the first turn after a context build ends, a new `context-<N>.json` is written (N past the highest present) with reason `start`, `clear` or `compact`, the instruction files loaded and the tool descriptions sent; only a main-conversation compaction that went ahead counts as `compact`.
- **R9** `/telltale` opens the pane at any width, or reuses and focuses it, showing the view R23 picks, with the newest row selected in Calls.
- **R10** Calls lists the most recent calls since session start or the last `/clear`, up to the 200 R25 keeps, newest first, each row with tool, server, duration, estimated tokens and an error marker.
- **R11** Up/Down move the selection, Enter opens the detail; new calls do not move an existing selection; the detail shows args and the text Claude read (pretty-printed only when the compact JSON round-trips losslessly and the indented form serializes (`JSON.stringify`) to at most 45,000 characters), size, error flag, next action and used-in-answer; `b` returns with the same row selected; Esc closes the pane; with nothing selected, or the selection evicted, the newest call is selected.
- **R12** At main-turn end each call is labelled from its agent's next complete response: `pending` (none yet, agent running), `aborted` (none, agent stopped), `answered` (no tool), `retried` (same tool), `asked-user` (`AskUserQuestion`), `other-tool`; calls from one response share a label; a `pending` row is relabelled in the pane when its agent responds, and becomes `aborted` if the agent stops; the written file keeps `pending`.
- **R13** For each call in the turn, up to 5 values (maximal runs of `[A-Za-z0-9_.:/-]`, trailing `.:/-` trimmed, ≥4 chars, with a digit) that appear in both the result and the main answer, in result order; no answer means an empty list.
- **R14** Before any cut or preview, the listed secret patterns and the whole values of the listed field names are replaced with `[redacted]` in argument values, result previews, logged result text and the `usedInAnswer` values; never in tool, server or skill names, paths or field names; a match may not follow a letter, digit, `_` or `-` unless that character ends a JSON escape; a private-key block matches anywhere.
- **R15** Records over the per-file limit are written across numbered parts, none dropped; a single oversized record has its largest fields replaced in turn by `…[cut N chars]` until it fits and is marked `"truncated": true`.
- **R16** If a log write fails, one notice per session names the folder; records stay in the pane; the turn is unaffected.
- **R17** `/clear` empties the Calls view (and returns from a detail); files already written stay.
- **R18** Inventory shows context cost in tokens in three groups, each ordered by cost: MCP tools by server (with loaded/deferred state), skills by plugin or by source (`user`, `project`, `other`), memory files; empty groups say `No MCP servers connected`, `No skills listed`, `No memory files loaded`.
- **R19** The log folder gets a `.gitignore` containing `*` before its first file.
- **R20** A field over 20,000 characters shows its first 20,000 followed by `<N> chars cut`, as stored, not indented.
- **R21** Inventory rows show `est` until `m` is pressed; `m` counts MCP tool and memory file rows exactly and marks them `measured` until the next press; skill rows stay `est`; a second `m` during a count is ignored; a failed count keeps the figures and shows `measure failed: <reason>`.
- **R22** If Claude Code cannot report context usage, Inventory shows `Context usage unavailable` and Calls keeps working.
- **R23** The pane shows a view row `1: Calls`, `2: Inventory`; `1`/`2` switch; the `/telltale` argument picks the view (case-insensitive, trimmed); an unknown argument opens Calls and replies `unknown view "<argument>"; views: calls, inventory`.
- **R24** Logged string argument values longer than 2,000 characters are cut to 2,000 followed by `…[cut N chars]`, after redaction.
- **R25** The pane keeps full, unredacted, uncut args and result text for the 200 most recent calls; older calls leave the list, which ends with `<n> older calls are in the logs`.

## License

MIT. See the [LICENSE](../../LICENSE) at the repository root.
