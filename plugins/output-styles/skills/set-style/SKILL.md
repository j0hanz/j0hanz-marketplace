---
name: set-style
description: 'Pick an output style (Concise, TL;DR, Diagram-first, or built-in Claude default) and apply it to your global Claude Code settings.'
disable-model-invocation: true
---

1. Use AskUserQuestion:
   - Header: "Output style"
   - Question: "Which output style do you want to enable globally?"
   - Options — exactly these, in this order (AskUserQuestion adds "Other" itself):

     | Option                  | Description                                                | Arg             |
     | ----------------------- | ---------------------------------------------------------- | --------------- |
     | Concise                 | Terse, direct output. No filler, no unsolicited examples.  | `concise`       |
     | TL;DR                   | One-line summary, then bullets. No prose filler.           | `tldr`          |
     | Diagram-first           | Answer with a diagram or visual first, then minimal prose. | `diagram-first` |
     | Built-in Claude default | Reset to Claude's built-in default output style.           | `default`       |

2. Run: `node "${CLAUDE_PLUGIN_ROOT}/scripts/set-style.mjs" <arg from the table>`

3. Relay the script's stdout verbatim, including any project/local override warning.
