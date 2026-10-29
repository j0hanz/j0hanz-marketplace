// Hook I/O for both hosts. Claude Code and GitHub Copilot CLI run the same hooks.json, but
// Copilot hands tools their own argument names and reads only flat output fields, so hooks
// read their payload and write their answer through here. Copied, not shared, into every
// plugin that has hooks: a plugin installs alone. This copy keeps only what scan.mjs uses.

// Copilot sets COPILOT_PLUGIN_ROOT for plugin hooks; Claude Code never does.
export const onCopilot = () => Boolean(process.env.COPILOT_PLUGIN_ROOT);

// Antigravity's hooks.json commands pass --antigravity; no documented env variable marks it.
export const onAntigravity = () => process.argv.includes('--antigravity');

// Copilot runtime tool names, as the Claude names the hooks already match on. Antigravity's
// hook payload names its own tools; multi_replace_file_content is on the docs' word alone.
const CLAUDE_TOOL = {
  create: 'Write',
  edit: 'Edit',
  bash: 'Bash',
  powershell: 'Bash',
  write_file: 'Write',
  edit_file: 'Edit',
  multi_replace_file_content: 'Edit',
  read_file: 'Read',
  run_command: 'Bash',
};

export const toolName = (payload = {}) => {
  const name = String(payload.tool_name ?? payload.toolName ?? payload.toolCall?.name ?? '');
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
// Antigravity: write_file {Path, Content}, edit_file {Path, Replacement}, run_command
// {CommandLine}, all inside toolCall.args.
export const toolInput = (payload = {}) => {
  const input = asObject(payload.tool_input ?? payload.toolArgs ?? payload.toolCall?.args);
  return {
    filePath: input.file_path ?? input.path ?? input.Path,
    written: input.content ?? input.file_text ?? input.Content,
    replacement: input.new_string ?? input.new_str ?? input.Replacement,
    command: input.command ?? input.CommandLine,
  };
};

// Context the model reads on this event. Antigravity has no context channel on tool events:
// its arm answers injectSteps, which only a PreInvocation hook may emit.
export const context = (event, text) =>
  JSON.stringify(
    onAntigravity()
      ? { injectSteps: [{ ephemeralMessage: text }] }
      : onCopilot()
        ? { additionalContext: text }
        : { hookSpecificOutput: { hookEventName: event, additionalContext: text } },
  );
