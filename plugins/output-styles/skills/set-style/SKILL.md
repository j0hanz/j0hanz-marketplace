---
name: set-style
description: 'Pick an output style (Concise, TL;DR, Diagram-first, or built-in Claude default) and apply it to your global Claude Code settings.'
disable-model-invocation: true
---

1. Use AskUserQuestion to present ONE single-select question:
   - Header: "Output style"
   - Question: "Which output style do you want to enable globally?"
   - Options (in this order):
     - "Concise" — "Terse, direct output. No filler, no unsolicited examples."
     - "TL;DR" — "One-line summary, then bullets. No prose filler."
     - "Diagram-first" — "Answer with a diagram or visual first, then minimal prose."
     - "Built-in Claude default" — "Reset to Claude's built-in default output style."
   - Do NOT add an "Other" option; AskUserQuestion provides it automatically.

2. Map the selection to a script argument:
   - Concise -> `concise`
   - TL;DR -> `tldr`
   - Diagram-first -> `diagram-first`
   - Built-in Claude default -> `default`

3. Run the apply script with Bash:

   ```
   node "$CLAUDE_PLUGIN_ROOT/scripts/set-style.mjs" <arg>
   ```

4. Report the script's stdout to the user. Then state clearly: the change takes effect after `/clear` or a new session — output style is read at session start. If the script warned about a project/local settings override, relay that warning verbatim.

5. If the user picked "Built-in Claude default", confirm their global `outputStyle` was removed (restoring default).
