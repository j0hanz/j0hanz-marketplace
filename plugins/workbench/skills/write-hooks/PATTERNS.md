# Hook patterns

Skeletons for shapes that recur. Adapt closest one, don't start cold.

Registration blocks go in plugin's `hooks/hooks.json`, top-level `description` declares `jq` dependency:

```json
{
  "description": "Guards and briefings for <plugin>. Requires jq on PATH; bash only.",
  "hooks": {}
}
```

Every script below opens same four lines, elided after first as `# --- preamble ---`:

```bash
#!/usr/bin/env bash
set -uo pipefail                                # -e omitted deliberately: see below
command -v jq >/dev/null 2>&1 || exit 0         # a gate degrades loudly instead — pattern 1
input=$(cat)                                    # stdin is readable once
```

`set -e` omission matters. Non-matching `grep` exits 1, under `-e` kills script into fail-open right when guard doing its job.

---

## 1. Gate — deny with a repair

Refusal agent can't act on gets retried verbatim. Name replacement.

```json
"PreToolUse": [{
  "matcher": "Bash",
  "hooks": [{
    "type": "command",
    "if": "Bash(git push *)",
    "command": "\"${CLAUDE_PLUGIN_ROOT}\"/hooks/guard-push.sh",
    "timeout": 5,
    "statusMessage": "Checking push safety..."
  }]
}]
```

```bash
#!/usr/bin/env bash
# fires:  PreToolUse · matcher Bash · if Bash(git push *)
# reads:  .tool_input.command
# emits:  permissionDecision deny + the replacement command, else nothing
# fails:  jq missing or input unparseable -> exit 0 + systemMessage; guard inert, loudly
# verify: bash hooks/guard-push.sh < last-payload.json; echo $?
set -uo pipefail

command -v jq >/dev/null 2>&1 || {
  printf '%s\n' '{"systemMessage":"guard-push: jq not found, force-push guard is inactive"}'
  exit 0
}

input=$(cat)
cmd=$(jq -r '.tool_input.command // empty' <<<"$input" 2>/dev/null)
[ -n "$cmd" ] || exit 0

# --force-with-lease is the safe form; let it through before testing for --force.
case "$cmd" in *--force-with-lease*) exit 0 ;; esac

if [[ "$cmd" =~ (^|[[:space:]])(-f|--force)([[:space:]]|$) ]]; then
  jq -nc '{hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason:
      "Force-push blocked. Use `git push --force-with-lease` instead — it refuses the push if someone else has pushed since your last fetch."
  }}'
fi
exit 0
```

`if` matters more than script: without it, process spawns every Bash call. Guard honest about limits too — `deny` holds even in `bypassPermissions` mode, but user can still disable hooks. Policy, not security.

---

## 2. Gate — turn-end evidence, with a loop guard

`stop_hook_active` check not optional. Without it, blocks until the built-in consecutive-block override (see Firing over and over).

```json
"Stop": [{
  "hooks": [{ "type": "command",
    "command": "\"${CLAUDE_PLUGIN_ROOT}\"/hooks/stop-evidence.sh", "timeout": 120 }]
}]
```

```bash
# --- preamble ---
# fires:  Stop (no matcher — Stop ignores one)
# reads:  .stop_hook_active
# emits:  additionalContext to continue the turn, else nothing
# fails:  exit 0, silent — never strand a turn because the gate itself broke
# verify: printf '{"stop_hook_active":false}' | bash hooks/stop-evidence.sh; echo $?

# Loop guard first, always.
[ "$(jq -r '.stop_hook_active // false' <<<"$input")" = "true" ] && exit 0

# Only speak when there is something to verify. `git status --porcelain` also covers untracked
# files and a repo with no commits yet, both of which `git diff --quiet HEAD` misses.
changes=$(git status --porcelain 2>/dev/null) || exit 0
[ -z "$changes" ] && exit 0

log=$(mktemp)
if ! npm test --silent >"$log" 2>&1; then
  jq -nc --arg tail "$(tail -n 20 "$log")" '{hookSpecificOutput: {
    hookEventName: "Stop",
    additionalContext: ("The working tree has changes and the test suite is failing. Last 20 lines:\n" + $tail)
  }}'
fi
rm -f "$log"
exit 0
```

`additionalContext` over `decision: "block"` deliberate. Both continue turn under same 8-block cap; `additionalContext` reads as feedback — correct, hook working as designed. Reserve `block` for violation.

Design against condition Claude cannot clear from inside turn. "Tests pass" clearable. "Coverage above 90%" often not, loops.

---

## 3. Gate — repeat-firing event with no `stop_hook_active`

`TeammateIdle`, `TaskCompleted`, `TaskCreated` fire again and again on same subject, carry no loop flag. Absence and exhaustion must not share representation — deleting entry at cap re-arms gate on next fire.

```json
"TaskCompleted": [{
  "hooks": [{ "type": "command",
    "command": "\"${CLAUDE_PLUGIN_ROOT}\"/hooks/gate-task.sh", "timeout": 60 }]
}]
```

```bash
# --- preamble ---
# fires:  TaskCompleted (no matcher)
# reads:  .session_id, .agent_id
# emits:  exit 2 + stderr to push back, at most twice per subject
# fails:  exit 0 — a false positive traps the agent; a false negative costs one message
# verify: printf '{"session_id":"s","agent_id":"a"}' | bash hooks/gate-task.sh; echo $?

dir="${CLAUDE_PLUGIN_DATA:-/tmp}/gate-task"; mkdir -p "$dir"
key=$(jq -r '"\(.session_id)-\(.agent_id // "main")"' <<<"$input" | tr -c 'a-zA-Z0-9-' _)
n=$(cat "$dir/$key" 2>/dev/null || echo 0)

[ "$n" = "-1" ] && exit 0                    # already gave up on this one — stay silent
if evidence_is_present; then                 # your predicate; fail open inside it
  rm -f "$dir/$key"; exit 0
fi

if [ "$n" -ge 2 ]; then
  echo -1 > "$dir/$key"                      # record the surrender — do NOT rm
  echo "gate-task: giving up on $key after 2 pushbacks" >&2   # never surrender silently
  exit 0
fi

echo $((n + 1)) > "$dir/$key"
echo "Tests have not been run since the last edit. Run them, then close the task." >&2
exit 2
```

If predicate reads transcript, two more traps: file lags live turn, so what you look for may not be flushed yet; own pushback lands in transcript as user-role entry, so hook parsing what it also writes finds own feedback, fires again. Prefix injected text, skip on read.

---

## 4. Brief — reason over the whole batch

`PostToolUse` fires once per tool, runs concurrently across parallel batch — never sees set. This event fires exactly once, with all of it.

```json
"PostToolBatch": [{
  "hooks": [{ "type": "command",
    "command": "\"${CLAUDE_PLUGIN_ROOT}\"/hooks/batch-brief.sh", "timeout": 10 }]
}]
```

```bash
# --- preamble ---
# fires:  PostToolBatch (no matcher; once per resolved batch, before the next model call)
# reads:  .tool_calls[] — tool_name and tool_input.file_path
# emits:  one additionalContext line naming the suites covering what the batch touched
# fails:  exit 0, silent
# verify: bash hooks/batch-brief.sh < last-payload.json

areas=$(jq -r '[ .tool_calls[]
    | select(.tool_name == "Edit" or .tool_name == "Write")
    | .tool_input.file_path // empty          # // empty, or jq emits the string "null"
    | if test("(^|/)(api|server)/") then "api" elif test("(^|/)ui/") then "ui" else empty end
  ] | unique | join(" ")' <<<"$input")

[ -n "$areas" ] || exit 0
jq -nc --arg a "$areas" '{hookSpecificOutput: {hookEventName: "PostToolBatch",
  additionalContext: ("This batch touched: " + $a + ". Suites: " +
    ([ $a | split(" ")[] | "npm run test:" + . ] | join(", ")) + ".")}}'
```

`tool_response` here serialized result model saw, not structured object `PostToolUse` gets; parse only what needed, these get large.

---

## 5. Brief — session start that knows how it started

```json
"SessionStart": [{
  "matcher": "startup|resume|fork",
  "hooks": [{ "type": "command",
    "command": "\"${CLAUDE_PLUGIN_ROOT}\"/hooks/session-brief.sh", "timeout": 5 }]
}]
```

```bash
# --- preamble ---
# fires:  SessionStart · matcher startup|resume|fork (matches on .source)
# reads:  .source, .session_title
# emits:  additionalContext (branch state) + sessionTitle when the user hasn't set one
# fails:  exit 0; no git just means a shorter brief
# verify: printf '{"source":"startup"}' | bash hooks/session-brief.sh

src=$(jq -r '.source // "startup"'   <<<"$input")
have=$(jq -r '.session_title // ""'  <<<"$input")
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0

# Facts, phrased so they are still true whenever they are read.
ctx="Current git branch: $branch."
[ "$src" = "resume" ] && ctx="$ctx This session was resumed; re-read files before editing them."

jq -nc --arg c "$ctx" --arg t "$branch" --arg have "$have" \
  '{hookSpecificOutput: ({hookEventName: "SessionStart", additionalContext: $c}
     + (if $have == "" then {sessionTitle: $t} else {} end))}'
```

Matcher deliberately omits `compact` and `clear`: brief re-firing every compaction re-pays for context conversation already has. Checking `session_title` first avoids clobbering name user chose. Plain stdout also reaches Claude here, JSON only needed to combine fields.

Three more `SessionStart` outputs: `reloadSkills: true` re-scans skill directories so skills hook just installed usable this session, `watchPaths` arms `FileChanged`, `initialUserMessage` seeds first turn. Separately, `$CLAUDE_ENV_FILE` present on `SessionStart`, `Setup`, `CwdChanged`, `FileChanged` — append `export` lines with `>>` so you don't erase another hook's variables.

---

## 6. Reflex — async verification that wakes an idle session

Non-decisive work belongs off critical path. Async hook cannot block anything: by time it finishes, action it would've judged already happened.

```json
"PostToolUse": [{
  "matcher": "Edit|Write",
  "hooks": [{
    "type": "command",
    "command": "\"${CLAUDE_PLUGIN_ROOT}\"/hooks/async-test.sh",
    "async": true,
    "asyncRewake": true,
    "timeout": 300
  }]
}]
```

```bash
# --- preamble ---
# fires:  PostToolUse · matcher Edit|Write · async + asyncRewake
# reads:  .tool_input.file_path
# emits:  pass -> additionalContext next turn; fail -> exit 2 + stderr, which wakes Claude now
# fails:  exit 0, silent
# verify: bash hooks/async-test.sh < last-payload.json; echo $?

f=$(jq -r '.tool_input.file_path // empty' <<<"$input")
case "$f" in *.ts|*.tsx) ;; *) exit 0 ;; esac

# Idempotence: identical tree state, identical verdict. Skip the re-run.
stamp="${CLAUDE_PLUGIN_DATA:-/tmp}/last-tested"
now=$(git status --porcelain 2>/dev/null | git hash-object --stdin)  # git hashes it: no sha1sum (absent on stock macOS)
[ "$now" = "$(cat "$stamp" 2>/dev/null)" ] && exit 0

if out=$(npm test --silent 2>&1); then
  printf '%s' "$now" > "$stamp"
  jq -nc '{hookSpecificOutput: {hookEventName: "PostToolUse",
    additionalContext: "Test suite passed on the current working tree."}}'
else
  printf 'Tests failed after editing %s:\n%s\n' "$f" "$(tail -n 20 <<<"$out")" >&2
  exit 2
fi
```

Without `asyncRewake`, output waits for next user turn. `.ts` filter lives in script since one `if` rule can't span both `Edit(*.ts)` and `Write(*.ts)`; one in-script `case` cheaper than two handler entries.

---

## 7. Rewrite — normalize input, and let the human see it

```json
"PreToolUse": [{
  "matcher": "Bash",
  "hooks": [{
    "type": "command",
    "if": "Bash(npm install *)",
    "command": "\"${CLAUDE_PLUGIN_ROOT}\"/hooks/pin-installs.sh",
    "timeout": 5
  }]
}]
```

```bash
# --- preamble ---
# fires:  PreToolUse · matcher Bash · if Bash(npm install *)
# reads:  .tool_input (the whole object)
# emits:  allow + updatedInput carrying --save-exact, plus systemMessage naming rewrite
# fails:  exit 0, silent — the original command stands
# verify: bash hooks/pin-installs.sh < last-payload.json | jq .

cmd=$(jq -r '.tool_input.command // empty' <<<"$input")
[ -n "$cmd" ] || exit 0
case "$cmd" in *--save-exact*) exit 0 ;; esac

# updatedInput REPLACES the entire input object — merge, never rebuild from scratch.
jq -c --arg new "$cmd --save-exact" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "allow",
    permissionDecisionReason: "Pinning this install to an exact version.",
    updatedInput: (.tool_input + {command: $new})
  },
  systemMessage: ("workbench: pinned install — " + $new)
}' <<<"$input"
```

`allow`, not `ask`: `updatedInput` honored **only** with `allow` (SKILL.md step 5), so `ask`
here shows prompt and silently drops rewrite — install runs unpinned, hook reports success.
Rewrite nobody sees is rewrite nobody can catch, so `systemMessage` names it in transcript.
`allow` also skips permission prompt this call would otherwise get — rewrite hook that must
keep prompt cannot carry `updatedInput` at all; put corrected value in reason, let agent
reissue.

---

## 8. Gate — judgment instead of rules

When decision needs reading rather than matching, hand to model. No script: `prompt` hooks answer `{"ok": bool, "reason": str}`, nothing else.

```json
"PreToolUse": [{
  "matcher": "Bash",
  "hooks": [{
    "type": "prompt",
    "if": "Bash(psql *)",
    "model": "claude-sonnet-5",
    "continueOnBlock": true,
    "timeout": 20,
    "prompt": "A database command is about to run: $ARGUMENTS\n\nReturn {\"ok\": false, \"reason\": \"...\"} only if it mutates or drops data on a non-local host — DROP, TRUNCATE, DELETE without WHERE, or UPDATE without WHERE. Reads, EXPLAIN, and anything against localhost are fine. When blocking, the reason must name the safer command to run instead. Otherwise return {\"ok\": true}."
  }]
}]
```

- `continueOnBlock: true` sets `continue: true` on generated block, turn survives, reason comes back as feedback. Default `false`, ends turn.
- Set `model` explicitly. Default fast model; verdict from same model that wrote command is first opinion wearing hat.
- Escalate to `"type": "agent"` only when verdict needs read files or run suite — gets tools, 60s default, fast model default. Keep production gates on command hooks.
- Neither type works on `SessionStart` or `Setup` (no conversation to reason over).

---

## 9. Reflex — the human channel

`terminalSequence` is supported path to terminal; Claude Code emits it through own writer, race-free, works inside tmux, screen, Windows.

```json
"Notification": [{
  "matcher": "permission_prompt|idle_prompt",
  "hooks": [{ "type": "command",
    "command": "\"${CLAUDE_PLUGIN_ROOT}\"/hooks/notify.sh", "timeout": 5 }]
}]
```

```bash
# --- preamble ---
# fires:  Notification · matcher permission_prompt|idle_prompt (matches .notification_type)
# reads:  .message
# emits:  terminalSequence — human channel only; the agent gets nothing here
# fails:  exit 0, silent
# verify: printf '{"message":"needs you"}' | bash hooks/notify.sh

body=$(jq -r '.message // "Claude Code needs your attention"' <<<"$input")

# printf octal escapes keep the control bytes off the command line;
# jq --arg escapes quotes and newlines in the message correctly.
seq=$(printf '\033]777;notify;%s;%s\007' "Claude Code" "$body")
jq -nc --arg s "$seq" '{terminalSequence: $s}'
```

Sequence outside allowlist not sanitised — whole field dropped.

---

## 10. Gate — the slash-command path `PreToolUse` misses

`PreToolUse` hook on `Skill` tool fires only when _Claude_ invokes skill. User typing `/deploy` never calls that tool. `UserPromptExpansion` only event on that path, matcher compared against command name.

```json
"UserPromptExpansion": [{
  "matcher": "deploy",
  "hooks": [{ "type": "command",
    "command": "\"${CLAUDE_PLUGIN_ROOT}\"/hooks/gate-deploy.sh", "timeout": 5 }]
}]
```

```bash
# --- preamble ---
# fires:  UserPromptExpansion · matcher deploy
# reads:  .command_args
# emits:  decision block + reason when no approval file exists, else additionalContext
# fails:  exit 0, silent — expansion proceeds
# verify: printf '{"command_name":"deploy","command_args":"prod"}' | bash hooks/gate-deploy.sh

args=$(jq -r '.command_args // ""' <<<"$input")

case "$args" in
  *prod*)
    if [ ! -f "${CLAUDE_PROJECT_DIR:-.}/.deploy-approved" ]; then
      jq -nc '{decision: "block",
        reason: "Production deploys need .deploy-approved in the project root. Create it after the change is signed off."}'
      exit 0
    fi
    jq -nc '{hookSpecificOutput: {hookEventName: "UserPromptExpansion",
      additionalContext: "Target is production. Confirm the migration plan before running anything destructive."}}'
    ;;
esac
exit 0
```

Top-level `decision` / `reason` universal JSON shape — on exit 0 only JSON blocking channel on events with no `hookSpecificOutput` variant of own (`TaskCompleted`, `TeammateIdle`, `PreCompact`, `SessionEnd`, `ConfigChange`). Exit 2 + stderr blocks on any event (SKILL.md step 5). Per-event fields like `permissionDecision` live under `hookSpecificOutput`, only mean something on event that defines them.
