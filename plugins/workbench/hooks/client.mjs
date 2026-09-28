// Hook I/O for both hosts. Claude Code and GitHub Copilot CLI run the same hooks.json, but
// Copilot hands tools their own argument names and reads only flat output fields, so hooks
// read their payload and write their answer through here. Copied, not shared, into every
// plugin that has hooks: a plugin installs alone.

// Copilot sets COPILOT_PLUGIN_ROOT for plugin hooks; Claude Code never does.
export const onCopilot = () => Boolean(process.env.COPILOT_PLUGIN_ROOT);

// Copilot runtime tool names, as the Claude names the hooks already match on.
const CLAUDE_TOOL = {
  create: 'Write',
  edit: 'Edit',
  str_replace_editor: 'Edit',
  view: 'Read',
  bash: 'Bash',
  powershell: 'Bash',
  skill: 'Skill',
};

export const toolName = (payload = {}) => {
  const name = String(payload.tool_name ?? payload.toolName ?? '');
  return CLAUDE_TOOL[name] ?? name;
};

const asObject = (value) => {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value !== null && typeof value === 'object' ? value : {};
};

// Claude: Write {file_path, content}, Edit {file_path, new_string}.
// Copilot: create {path, file_text}, edit {path, new_str}.
export const toolInput = (payload = {}) => {
  const input = asObject(payload.tool_input ?? payload.toolArgs);
  return {
    filePath: input.file_path ?? input.path,
    written: input.content ?? input.file_text,
    replacement: input.new_string ?? input.new_str,
    skill: input.skill,
  };
};

// Context the model reads on this event.
export const context = (event, text) =>
  JSON.stringify(
    onCopilot()
      ? { additionalContext: text }
      : { hookSpecificOutput: { hookEventName: event, additionalContext: text } },
  );

// PreToolUse refusal.
export const deny = (reason) =>
  JSON.stringify(
    onCopilot()
      ? { permissionDecision: 'deny', permissionDecisionReason: reason }
      : {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: reason,
          },
        },
  );

// Context the model reads at Stop. Copilot's agentStop reads only decision/reason, so there
// the context rides a one-turn block; callers already honor stop_hook_active and dedupe.
export const stopContext = (event, text) =>
  JSON.stringify(
    onCopilot()
      ? { decision: 'block', reason: text }
      : { hookSpecificOutput: { hookEventName: event, additionalContext: text } },
  );

// A note for the user, not a decision. Copilot has no systemMessage: it shows the stderr of
// a hook that exits 2 — except on PreToolUse, where exit 2 denies the call, so there the
// note rides additionalContext instead.
export const notice = (event, message) => {
  if (!onCopilot()) {
    process.stdout.write(JSON.stringify({ systemMessage: message }));
  } else if (event === 'PreToolUse') {
    process.stdout.write(JSON.stringify({ additionalContext: message }));
  } else {
    process.stderr.write(`${message}\n`);
    process.exitCode = 2;
  }
};
