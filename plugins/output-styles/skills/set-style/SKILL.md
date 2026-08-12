---
name: set-style
description: 'Pick an output style (Concise, TL;DR, Diagram-first, Schematic, or built-in Claude default) and apply it to your global Claude Code settings.'
disable-model-invocation: true
argument-hint: '[concise | tldr | diagram-first | schematic | default]'
---

The `UserPromptExpansion` hook normally handles `/set-style` and blocks this expansion.
Reaching here means it could not run — usually no `node` on PATH.

1. If no style was named, use AskUserQuestion:
   - Header: "Output style"
   - Question: "Which output style do you want to enable globally?"
   - Options — exactly these, in this order (AskUserQuestion adds "Other" itself):

     | Option                  | Description                                                | Arg             |
     | ----------------------- | ---------------------------------------------------------- | --------------- |
     | Concise                 | Terse, direct output. No filler, no unsolicited examples.  | `concise`       |
     | TL;DR                   | One-line summary, then bullets. No prose filler.           | `tldr`          |
     | Diagram-first           | Answer with a diagram or visual first, then minimal prose. | `diagram-first` |
     | Schematic               | Prose answer first, ASCII diagrams only. No recap.         | `schematic`     |
     | Built-in Claude default | Reset to Claude's built-in default output style.           | `default`       |

2. Run: `node "${CLAUDE_PLUGIN_ROOT}/hooks/set-style.mjs" <arg from the table>`

3. Relay the script's output verbatim, including any project/local override warning.

4. If `node` is missing, say so and stop — the style can be set by hand by putting
   `"outputStyle": "output-styles:<arg>"` in `~/.claude/settings.json` (or removing that
   key for `default`).
