# Auditing and debugging hooks

Part of [write-hooks](SKILL.md), for the two branches that read hooks rather than write them:
judging a set already installed, and finding out why one never fires. Authoring a hook
from scratch needs none of this.

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

1. **Guards that don't guard** — exit 1 instead of 2; `set -e` with unguarded `grep`; any
   decision other than `allow` carrying `updatedInput` (`ask`, `escalate` and `deny` all
   drop rewrite silently, so hook reports success and original stands); `allow` mistaken
   for security grant.
2. **Hooks that never fire** — `if` on non-tool event; `mcp__server` with no `__.*`;
   unanchored regex matcher; matcher compared against something other than what author
   assumed; `Stop` hook in agent frontmatter still written for `Stop` (SKILL.md step 6).
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
   be compared against what assumed — check the matcher table in SKILL.md step 3.
3. `if` set on non-tool event removes handler entirely.
4. Wrong event for path. `PreToolUse` doesn't fire for files pulled in with `@` in prompt
   — those inlined with no tool call. Typing `/skillname` skips Skill tool.
   `PostToolUseFailure` skips permission denials and validation errors. `Stop` hook in agent
   frontmatter running as `SubagentStop` (SKILL.md step 6).
5. `claude --debug-file /tmp/h.log`, reproduce, read log.
6. Replay captured payload by hand. If script works standalone, defect's in
   wiring, not code.
7. `command not found` → use absolute path or `${CLAUDE_PLUGIN_ROOT}`; on macOS/Linux
   confirm `chmod +x`, or invoke through `bash` so bit doesn't matter.
