// Hook I/O for both hosts. Claude Code and GitHub Copilot CLI run the same hooks.json, but
// Copilot hands tools their own argument names and reads only flat output fields, so hooks
// read their payload and write their answer through here. Copied, not shared, into every
// plugin that has hooks: a plugin installs alone. This copy keeps only what scan.mjs uses.

// Copilot sets COPILOT_PLUGIN_ROOT for plugin hooks; Claude Code never does.
export const onCopilot = () => Boolean(process.env.COPILOT_PLUGIN_ROOT);

// Copilot runtime tool names, as the Claude names the hooks already match on.
const CLAUDE_TOOL = { create: 'Write', edit: 'Edit', bash: 'Bash', powershell: 'Bash' };

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
    command: input.command,
  };
};

// Context the model reads on this event.
export const context = (event, text) =>
  JSON.stringify(
    onCopilot()
      ? { additionalContext: text }
      : { hookSpecificOutput: { hookEventName: event, additionalContext: text } },
  );
