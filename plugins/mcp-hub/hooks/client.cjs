// Hook I/O for both hosts. Claude Code and GitHub Copilot CLI run the same hooks.json, but
// Copilot hands tools their own argument names and parses stdout only as JSON with flat
// output fields, so these hooks read their payload and write their answer through here.

// Copilot sets COPILOT_PLUGIN_ROOT for plugin hooks; Claude Code never does.
const onCopilot = () => Boolean(process.env.COPILOT_PLUGIN_ROOT);

// Copilot runtime tool names, as the Claude names the hooks already match on.
const CLAUDE_TOOL = { create: 'Write', edit: 'Edit', str_replace_editor: 'Edit' };

const toolName = (input) => {
  const name = String(input?.tool_name ?? input?.toolName ?? '');
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

// Claude: {file_path}; Copilot: {path}.
const toolFilePath = (input) => {
  const args = asObject(input?.tool_input ?? input?.toolArgs);
  return args.file_path ?? args.path;
};

// Context the model reads on this event. Plain stdout reaches Claude's SessionStart context;
// Copilot drops any stdout that does not parse as JSON.
const context = (event, text) => {
  if (onCopilot()) return JSON.stringify({ additionalContext: text });
  return event === 'SessionStart'
    ? text
    : JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } });
};

module.exports = { context, onCopilot, toolFilePath, toolName };
