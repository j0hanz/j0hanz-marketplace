// Hook I/O for Claude Code, GitHub Copilot CLI, and Antigravity CLI. Each client sends its own
// payload envelope, tool names, argument names, and stdout schema, so hooks read their payload
// and write their answer through here. Copied identically into every plugin that has JS hooks
// (enforced by scripts/validate.mjs): a plugin installs alone.
import { appendFileSync, readFileSync, renameSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Copilot sets COPILOT_PLUGIN_ROOT for plugin hooks; Claude Code never does.
export const onCopilot = () => Boolean(process.env.COPILOT_PLUGIN_ROOT);

// Antigravity's hooks.json commands pass --antigravity; no documented env variable marks it.
export const onAntigravity = () => process.argv.includes('--antigravity');

// Copilot and Antigravity runtime tool names, mapped to the Claude names hooks match on.
// multi_replace_file_content is on the Antigravity docs' word alone.
const CLAUDE_TOOL = {
  create: 'Write',
  edit: 'Edit',
  str_replace_editor: 'Edit',
  view: 'Read',
  bash: 'Bash',
  powershell: 'Bash',
  skill: 'Skill',
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

// Claude: Write {file_path, content}, Edit {file_path, new_string}, Bash {command}, Skill {skill}.
// Copilot: create {path, file_text}, edit {path, new_str}, bash/powershell {command}, skill {skill}.
// Antigravity: write_file {Path, Content}, edit_file {Path, Replacement}, run_command {CommandLine},
// multi_replace_file_content {TargetFile, ReplacementChunks[].ReplacementContent}, all inside
// toolCall.args.
export const toolInput = (payload = {}) => {
  const input = asObject(payload.tool_input ?? payload.toolArgs ?? payload.toolCall?.args);
  const chunks = Array.isArray(input.ReplacementChunks)
    ? input.ReplacementChunks.map((c) => c?.ReplacementContent)
        .filter((c) => typeof c === 'string')
        .join('\n')
    : undefined;
  return {
    filePath: input.file_path ?? input.path ?? input.Path ?? input.TargetFile,
    written: input.content ?? input.file_text ?? input.Content,
    replacement: input.new_string ?? input.new_str ?? input.Replacement ?? chunks,
    command: input.command ?? input.CommandLine,
    skill: input.skill,
  };
};

// Project working directory from the host envelope or environment.
export const workspace = (payload = {}) =>
  payload.cwd || payload.workspacePaths?.[0] || process.env.CLAUDE_PROJECT_DIR || process.cwd();

// Session or conversation identifier from the host envelope.
export const sessionId = (payload = {}, fallback = '') =>
  payload.session_id || payload.conversationId || fallback;

// PreToolUse pass. Antigravity denies a tool when PreToolUse prints nothing; the other clients
// treat empty stdout as allow.
export const allow = () => (onAntigravity() ? JSON.stringify({ decision: 'allow' }) : '');

// Non-PreToolUse silent exit. Antigravity requires a JSON object on Stop and PostToolUse; the
// other clients treat empty stdout as silence.
export const pass = () => (onAntigravity() ? '{}' : '');

// Context the model reads on this event. Antigravity has no context channel on tool events:
// its arm answers injectSteps, which only a PreInvocation hook may emit. When rawSessionStart
// is true, Claude's SessionStart receives plain text while Copilot still gets one JSON object.
export const context = (event, text, { rawSessionStart = false } = {}) => {
  if (onAntigravity()) {
    return JSON.stringify({ injectSteps: [{ ephemeralMessage: text }] });
  }
  if (onCopilot()) {
    return JSON.stringify({ additionalContext: text });
  }
  if (rawSessionStart && event === 'SessionStart') {
    return text;
  }
  return JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } });
};

// PreToolUse refusal.
export const deny = (reason) =>
  JSON.stringify(
    onAntigravity()
      ? { decision: 'deny', reason }
      : onCopilot()
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
// the context rides a one-turn block; Antigravity re-enters once with decision: continue.
export const stopContext = (event, text) =>
  JSON.stringify(
    onAntigravity()
      ? { decision: 'continue', reason: text }
      : onCopilot()
        ? { decision: 'block', reason: text }
        : { hookSpecificOutput: { hookEventName: event, additionalContext: text } },
  );

// A note for the user, not a decision. Copilot has no systemMessage: it shows the stderr of
// a hook that exits 2 — except on PreToolUse, where exit 2 denies the call, so there the
// note rides additionalContext instead. Antigravity has no systemMessage either: at Stop the
// note re-enters once as the reason the model relays (agy caps consecutive continuations),
// and elsewhere it rides an ephemeral step, which only PreInvocation may answer.
export const notice = (event, message) => {
  if (onAntigravity()) {
    process.stdout.write(
      JSON.stringify(
        event === 'Stop'
          ? { decision: 'continue', reason: message }
          : { injectSteps: [{ ephemeralMessage: message }] },
      ),
    );
  } else if (!onCopilot()) {
    process.stdout.write(JSON.stringify({ systemMessage: message }));
  } else if (event === 'PreToolUse') {
    process.stdout.write(JSON.stringify({ additionalContext: message }));
  } else {
    process.stderr.write(`${message}\n`);
    process.exitCode = 2;
  }
};

const advisoryFile = (pluginKey, payload) => {
  const id = String(sessionId(payload)).replace(/[^\w-]/g, '_');
  return join(tmpdir(), `${pluginKey}-${id}.txt`);
};

// PostToolUse advisory output. Antigravity has no PostToolUse context channel, so advisories
// wait in a per-plugin, per-conversation temp file for drainAdvisory() on PreInvocation.
export const parkAdvisory = (pluginKey, payload, text) => {
  if (onAntigravity()) {
    if (text) appendFileSync(advisoryFile(pluginKey, payload), `${text}\n\n`);
    return '{}';
  }
  return text ? context('PostToolUse', text) : '';
};

// PreInvocation pass that delivers and clears advisories parked by parkAdvisory().
export const drainAdvisory = (pluginKey, payload) => {
  // Rename first: it is atomic, so an append lands before it or in a fresh file, never lost.
  const parked = advisoryFile(pluginKey, payload);
  const file = `${parked}.${process.pid}`;
  let notes = '';
  try {
    renameSync(parked, file);
    notes = readFileSync(file, 'utf8');
    unlinkSync(file);
  } catch {
    // nothing waiting
  }
  return notes ? context('PreInvocation', notes.trim()) : '{}';
};
