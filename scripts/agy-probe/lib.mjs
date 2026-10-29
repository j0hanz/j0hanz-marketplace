// The pure half of plan 014's Phase 0 kit: what the probe records, and how the report reads it
// back. probe.mjs runs inside Antigravity CLI and phase0.mjs drives the run; both import from
// here, so the test can check the parts that decide what the report claims.
import { join } from 'node:path';

// The SessionStart probe asks the model to write this, in two halves so the request itself
// never contains it. Finding it in a transcript means injectSteps reached the model.
export const TOKEN_HEAD = 'PROBE-SESSIONSTART';
export const TOKEN_TAIL = '7F3A';
export const TOKEN = `${TOKEN_HEAD}-${TOKEN_TAIL}`;

const LIMIT = 160;
const isObject = (value) => value !== null && typeof value === 'object';

// Payloads carry file bodies and the prompt. The port needs their keys, not their text, so
// every string is cut short and arrays keep their first few items.
export const shrink = (value, depth = 0) => {
  if (typeof value === 'string') {
    return value.length > LIMIT ? `${value.slice(0, LIMIT)}… (${value.length} chars)` : value;
  }
  if (!isObject(value)) return value;
  if (depth >= 6) return Array.isArray(value) ? `[${value.length} items]` : '{…}';
  if (Array.isArray(value)) return value.slice(0, 5).map((item) => shrink(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, shrink(item, depth + 1)]),
  );
};

const OWN = /^(?:ANTIGRAVITY|AGY|GEMINI|PLUGIN|PROBE)/i;
const SECRET = /TOKEN|KEY|SECRET|PASS|AUTH|CRED|COOKIE/i;

// What a hook or server was handed beyond the shell that ran setup: a client marker, if agy
// sets one, shows up here. Without that baseline, only the names a client would plausibly use.
export const envOf = (env, baseline) =>
  Object.fromEntries(
    Object.keys(env)
      .filter((name) => (baseline.size ? !baseline.has(name) : OWN.test(name)))
      .sort()
      .map((name) => [name, SECRET.test(name) ? '<hidden>' : shrink(env[name])]),
  );

// Hook commands run through a shell on Windows too; node takes forward slashes there.
export const posix = (path) => path.replaceAll('\\', '/');

// Where the probe tries to write, in order, until one works. The first run inside agy logged
// nothing to the repo while the same script, run by hand, did; so the probe also tries the
// folder it runs in (the plugin's, for hooks and servers) and the temp folder, and every line
// says which paths failed before it landed.
export const LOG_NAME = 'probe-log.jsonl';
export const TMP_LOG_NAME = 'agy-probe-log.jsonl';
export const logTargets = (log, cwd, tmp) => [
  ...new Set([log, join(cwd, LOG_NAME), join(tmp, TMP_LOG_NAME)].filter(Boolean)),
];

// Two ways to name the probe script. Antigravity's validator says `${PLUGIN_ROOT}` is not set
// for hook commands and that they run in the plugin folder, so `./probe.mjs` is what the port
// will use: it goes on every event, PreToolUse included, unquoted and with no repo path to
// trip over. The absolute form, which also writes to the repo first, rides along where a
// failure is harmless, to show whether a hook may reach outside its plugin folder.
const FORMS = {
  relative: () => 'node ./probe.mjs',
  absolute: ({ probe }) => `node "${probe}"`,
};
const tail = (form, { log }) => (form === 'absolute' ? ` "${log}"` : '');

export function hooksConfig(paths) {
  const handler = (event, form) => ({
    type: 'command',
    command: `${FORMS[form](paths)} hook ${event} ${form}${tail(form, paths)}`,
    timeout: 10,
  });
  const both = (event) => Object.keys(FORMS).map((form) => handler(event, form));
  // Matchers wrap tool events only; the other events take bare handlers.
  return {
    'agy-probe': {
      SessionStart: both('SessionStart'),
      PreToolUse: [{ matcher: '', hooks: [handler('PreToolUse', 'relative')] }],
      PostToolUse: [{ matcher: '', hooks: both('PostToolUse') }],
      PreInvocation: [handler('PreInvocation', 'relative')],
      PostInvocation: [handler('PostInvocation', 'relative')],
      Stop: [handler('Stop', 'relative')],
    },
  };
}

// Three servers, one per way of naming the script: by absolute path (it also passes both
// placeholders as an argument and as env, to show where each expands), through
// `${PLUGIN_ROOT}` in `args`, and by bare name, which resolves only if agy starts plugin
// servers in the plugin folder.
export const mcpConfig = ({ probe, log }) => ({
  mcpServers: {
    'probe-abs': {
      command: 'node',
      args: [probe, 'mcp', 'absolute', log, '--root=${PLUGIN_ROOT}'],
      env: { PROBE_ROOT: '${PLUGIN_ROOT}', PROBE_DATA: '${PLUGIN_DATA}' },
    },
    'probe-root': { command: 'node', args: ['${PLUGIN_ROOT}/probe.mjs', 'mcp', 'plugin-root'] },
    'probe-rel': { command: 'node', args: ['probe.mjs', 'mcp', 'relative'] },
  },
});

// Copilot's side of the hooks-file check: a SessionStart hook that names the file it sits in.
// It carries the powershell twin every hook here does: Copilot on Windows runs that field, and
// without it neither file would run there, for a reason that has nothing to do with which
// file Copilot reads. The paths are absolute, so one command serves both.
export const copilotHooks = ({ probe, log }, file) => {
  const command = `node "${probe}" hook CopilotSessionStart ${file} "${log}"`;
  return {
    hooks: {
      SessionStart: [{ hooks: [{ type: 'command', command, powershell: command, timeout: 10 }] }],
    },
  };
};

const fence = (text, lang = '') => ['```' + lang, String(text ?? '').trim() || '(empty)', '```'];
const json = (value) => fence(JSON.stringify(value, null, 2), 'json');
const yesNo = (value) => (value ? 'yes' : 'no');
const unique = (values) => [...new Set(values)];

const stepLines = (step, label) => {
  if (!step) return [`- ${label}: not run`];
  const outcome = step.timedOut ? 'timed out' : `exit ${step.status}`;
  return [`- ${label} (\`${step.command}\`): ${outcome}`, '', ...fence(step.output)];
};

const TOOL_EVENTS = new Set(['PreToolUse', 'PostToolUse']);

// Where the lines landed, and which paths refused them first: a path that fails for every
// line from agy is one agy does not let its hooks or servers write to.
const writeLines = (records) => {
  const landed = unique(records.map((r) => r.wroteTo).filter(Boolean));
  const refused = unique(
    records.flatMap((r) => (r.failed ?? []).map((f) => `${f.path} (${f.error})`)),
  );
  const list = (items, none) => items.map((item) => `\`${item}\``).join(', ') || none;
  return [
    `- Logged to: ${list(landed, '(nowhere)')}`,
    `- Refused before that: ${list(refused, 'nothing')}`,
  ];
};

function hookSection(records) {
  const hooks = records.filter((r) => r.kind === 'hook' && !r.event.startsWith('Copilot'));
  if (!hooks.length) {
    return [
      'No hook ran, and none could write anywhere: not to the repo, its plugin folder or the',
      'temp folder. The session output above says whether agy ran at all.',
    ];
  }
  const events = unique(hooks.map((r) => r.event));
  const forms = Object.keys(FORMS);
  const fired = (event, form) => hooks.filter((r) => r.event === event && r.via === form).length;
  const cwdOf = (form) => unique(hooks.filter((r) => r.via === form).map((r) => r.cwd));
  const added = Object.assign({}, ...hooks.map((r) => r.env));

  const tools = new Map();
  for (const r of hooks.filter((r) => TOOL_EVENTS.has(r.event))) {
    const call = r.payload?.toolCall ?? {};
    const name = call.name ?? '(no toolCall.name)';
    const entry = tools.get(name) ?? { events: new Set(), keys: new Set() };
    entry.events.add(r.event);
    for (const key of Object.keys(isObject(call.args) ? call.args : {})) entry.keys.add(key);
    tools.set(name, entry);
  }

  const samples = new Map();
  for (const r of hooks) {
    const key = TOOL_EVENTS.has(r.event) ? `${r.event} ${r.payload?.toolCall?.name}` : r.event;
    if (!samples.has(key)) samples.set(key, r.payload);
  }

  return [
    `| Event | ${forms.map((f) => `\`${f}\``).join(' | ')} |`,
    `| --- | ${forms.map(() => '---').join(' | ')} |`,
    ...events.map((e) => `| ${e} | ${forms.map((f) => fired(e, f)).join(' | ')} |`),
    '',
    `- A relative command (\`./probe.mjs\`) resolves: ${yesNo(hooks.some((r) => r.via === 'relative'))}`,
    ...writeLines(hooks),
    ...forms.map(
      (f) => `- Working directory, \`${f}\` form: ${cwdOf(f).join(', ') || '(never ran)'}`,
    ),
    '',
    'Variables the hooks saw that the setup shell did not have:',
    '',
    ...json(added),
    '',
    '### Tools',
    '',
    '| Tool | Events | `toolCall.args` keys |',
    '| --- | --- | --- |',
    ...[...tools].map(
      ([name, t]) => `| \`${name}\` | ${[...t.events].join(', ')} | ${[...t.keys].join(', ')} |`,
    ),
    '',
    '### One payload per event and tool',
    '',
    ...[...samples].flatMap(([key, payload]) => [`#### ${key}`, '', ...json(payload), '']),
  ];
}

function copilotSection(state, records) {
  const steps = state.steps ?? {};
  if (!steps['copilot-session']) return ['Not run: `copilot` was not on PATH.'];
  const fired = (via) => records.some((r) => r.event === 'CopilotSessionStart' && r.via === via);
  return [
    `- Root \`hooks.json\` ran: ${yesNo(fired('root-hooks.json'))}`,
    `- \`hooks/hooks.json\` ran: ${yesNo(fired('hooks-dir'))}`,
    '',
    ...stepLines(steps['copilot-add'], 'Marketplace add'),
    '',
    ...stepLines(steps['copilot-install'], 'Install'),
    '',
    ...stepLines(steps['copilot-session'], 'Session'),
  ];
}

function mcpSection(records) {
  const mcp = records.filter((r) => r.kind === 'mcp');
  if (!mcp.length) {
    return ['No probe server started, or none could write anywhere. See the session output.'];
  }
  const started = mcp.filter((r) => r.event === 'start');
  const first = (event) => mcp.find((r) => r.event === event);
  const roots = first('roots/list result');
  const initialize = first('initialize');
  const ran = (form) => yesNo(started.some((r) => r.via === form));
  return [
    ...started.flatMap((r) => [
      `- \`${r.via}\` server started in \`${r.cwd}\` with argv \`${r.argv.join(' ')}\``,
    ]),
    `- \`probe-root\` started, so \`\${PLUGIN_ROOT}\` expands in \`args\`: ${ran('plugin-root')}`,
    `- \`probe-rel\` started, so a bare script name resolves: ${ran('relative')}`,
    ...writeLines(mcp),
    '',
    'Variables the servers saw that the setup shell did not have:',
    '',
    ...json(Object.assign({}, ...started.map((r) => r.env))),
    '',
    'Client capabilities and info from `initialize`:',
    '',
    ...json({
      capabilities: initialize?.params?.capabilities,
      clientInfo: initialize?.params?.clientInfo,
    }),
    '',
    roots
      ? 'Result of `roots/list`:'
      : 'No `roots/list` result: the client declared no roots capability, or never answered.',
    ...(roots ? ['', ...json(roots.result)] : []),
    '',
    'First `tools/call`:',
    '',
    ...json(first('tools/call')?.params ?? null),
  ];
}

export function report({ state, records, transcripts }) {
  const steps = state.steps ?? {};
  const validated = Object.keys(steps).filter(
    (id) => id.startsWith('validate-') && id !== 'validate-probe',
  );
  return [
    '# Antigravity CLI: Phase 0 report',
    '',
    `Plan 014. Setup ran ${state.createdAt}; report written ${new Date().toISOString()}.`,
    '',
    ...stepLines(steps.version, 'Version'),
    '',
    '## 1. Install from a repo subfolder',
    '',
    ...stepLines(steps['install-subpath'], 'Install'),
    '',
    ...stepLines(steps['plugin-list'], 'Installed plugins'),
    '',
    '## 2. What `agy plugin validate` says about our plugins',
    '',
    ...validated.flatMap((id) => [...stepLines(steps[id], id.slice('validate-'.length)), '']),
    '## 3. Hooks',
    '',
    ...stepLines(steps.session, 'The agy session'),
    '',
    `- injectSteps from SessionStart reached the model: ${
      transcripts.checked
        ? `${yesNo(transcripts.hits)} (token found ${transcripts.hits} times in ${transcripts.checked} transcript(s))`
        : 'unknown (no transcript found)'
    }`,
    '',
    ...hookSection(records),
    '',
    '## 4. Copilot: root `hooks.json` or `hooks/hooks.json`',
    '',
    ...copilotSection(state, records),
    '',
    '## 5. MCP',
    '',
    ...mcpSection(records),
    '',
    '## 6. Install under a throwaway HOME',
    '',
    ...stepLines(steps['home-override'], 'Install'),
    '',
    '## 7. A Claude Code plugin converted on install (css)',
    '',
    ...stepLines(steps['convert-install'], 'Install'),
    '',
    ...stepLines(steps['convert-files'], 'What agy wrote'),
    '',
    ...stepLines(steps['convert-uninstall'], 'Uninstall'),
    '',
    '## The probe plugin',
    '',
    ...stepLines(steps['validate-probe'], 'Validate'),
    '',
    ...stepLines(steps['install-probe'], 'Install'),
    '',
  ].join('\n');
}
