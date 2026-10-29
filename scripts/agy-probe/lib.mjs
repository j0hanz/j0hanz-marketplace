// The pure half of plan 014's Phase 0 kit: what the probe records, and how the report reads it
// back. probe.mjs runs inside Antigravity CLI and phase0.mjs drives the run; both import from
// here, so the test can check the parts that decide what the report claims.

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

// Three ways to name the probe script: an absolute path, which always works, then the two
// forms the port would rather use. A form that does not resolve fails its own hook only,
// and only on events where a failure is harmless (never PreToolUse, which a failing hook may
// turn into a denial).
const FORMS = {
  absolute: (probe) => probe,
  'plugin-root': () => '${PLUGIN_ROOT}/probe.mjs',
  relative: () => './probe.mjs',
};

export function hooksConfig({ probe, log }) {
  const handler = (event, form) => ({
    type: 'command',
    command: `node "${FORMS[form](probe)}" hook ${event} ${form} "${log}"`,
    timeout: 10,
  });
  const everyForm = (event) => Object.keys(FORMS).map((form) => handler(event, form));
  // Matchers wrap tool events only; the other events take bare handlers.
  return {
    'agy-probe': {
      SessionStart: everyForm('SessionStart'),
      PreToolUse: [{ matcher: '', hooks: [handler('PreToolUse', 'absolute')] }],
      PostToolUse: [{ matcher: '', hooks: everyForm('PostToolUse') }],
      PreInvocation: [handler('PreInvocation', 'absolute')],
      PostInvocation: [handler('PostInvocation', 'absolute')],
      Stop: [handler('Stop', 'absolute')],
    },
  };
}

// Two servers: one launched by absolute path, so it starts whatever agy does with
// placeholders, and one that starts only if `${PLUGIN_ROOT}` expands in `args`. The first
// also passes both placeholders as an argument and as env, to show where each one expands.
export const mcpConfig = ({ probe, log }) => ({
  mcpServers: {
    'probe-abs': {
      command: 'node',
      args: [probe, 'mcp', 'absolute', log, '--root=${PLUGIN_ROOT}'],
      env: { PROBE_ROOT: '${PLUGIN_ROOT}', PROBE_DATA: '${PLUGIN_DATA}' },
    },
    'probe-root': {
      command: 'node',
      args: ['${PLUGIN_ROOT}/probe.mjs', 'mcp', 'plugin-root', log],
    },
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

function hookSection(records) {
  const hooks = records.filter((r) => r.kind === 'hook' && !r.event.startsWith('Copilot'));
  if (!hooks.length) {
    return [
      'No hook ran. Either the agy session (step 2 of what setup printed) has not happened',
      'yet, or the probe did not install: see the end of this report.',
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
    `- \`\${PLUGIN_ROOT}\` expands in a hook command: ${yesNo(hooks.some((r) => r.via === 'plugin-root'))}`,
    `- A relative command (\`./probe.mjs\`) resolves: ${yesNo(hooks.some((r) => r.via === 'relative'))}`,
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
  if (!mcp.length) return ['Neither probe server started: they start with the agy session.'];
  const started = mcp.filter((r) => r.event === 'start');
  const first = (event) => mcp.find((r) => r.event === event);
  const roots = first('roots/list result');
  const initialize = first('initialize');
  return [
    ...started.flatMap((r) => [
      `- \`${r.via}\` server started in \`${r.cwd}\` with argv \`${r.argv.join(' ')}\``,
    ]),
    `- \`probe-root\` started, so \`\${PLUGIN_ROOT}\` expands in \`args\`: ${yesNo(started.some((r) => r.via === 'plugin-root'))}`,
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
    '## The probe plugin',
    '',
    ...stepLines(steps['validate-probe'], 'Validate'),
    '',
    ...stepLines(steps['install-probe'], 'Install'),
    '',
  ].join('\n');
}
