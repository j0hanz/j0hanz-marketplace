import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  copilotHooks,
  envOf,
  hooksConfig,
  LOG_NAME,
  logTargets,
  mcpConfig,
  report,
  shrink,
  TOKEN,
} from './agy-probe/lib.mjs';

const probe = fileURLToPath(new URL('./agy-probe/probe.mjs', import.meta.url));
const phase0 = fileURLToPath(new URL('./agy-probe/phase0.mjs', import.meta.url));

const scratch = (context) => {
  const dir = mkdtempSync(join(tmpdir(), 'agy-probe-test-'));
  context.after(() => rmSync(dir, { recursive: true, force: true }));
  return { dir, log: join(dir, 'log.jsonl') };
};
const records = (log) =>
  readFileSync(log, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));

// The probe as a hook, run in `cwd`; with no `log`, as the relative form runs.
const hook = ({ cwd, log }, event, form, payload) =>
  spawnSync(process.execPath, [probe, 'hook', event, form, ...(log ? [log] : [])], {
    cwd,
    input: JSON.stringify(payload),
    encoding: 'utf8',
  });

test('shrink keeps every key and cuts long strings and arrays', () => {
  const out = shrink({ CodeContent: 'x'.repeat(500), chunks: [1, 2, 3, 4, 5, 6, 7], ok: true });
  assert.deepEqual(Object.keys(out), ['CodeContent', 'chunks', 'ok']);
  assert.match(out.CodeContent, /… \(500 chars\)$/);
  assert.equal(out.chunks.length, 5);
  assert.equal(out.ok, true);
});

test('envOf shows only what the setup shell lacked, and hides credential-like values', () => {
  const env = { PATH: '/bin', AGY_CONVERSATION: 'c1', AGY_TOKEN: 'secret', PLUGIN_ROOT: '/p' };
  assert.deepEqual(envOf(env, new Set(['PATH'])), {
    AGY_CONVERSATION: 'c1',
    AGY_TOKEN: '<hidden>',
    PLUGIN_ROOT: '/p',
  });
  assert.deepEqual(Object.keys(envOf({ ...env, HOME: '/h' }, new Set())), [
    'AGY_CONVERSATION',
    'AGY_TOKEN',
    'PLUGIN_ROOT',
  ]);
});

test('the probe hooks cover every event, PreToolUse in the plugin-folder form alone', () => {
  const config = hooksConfig({ probe: '/abs/probe.mjs', log: '/abs/log.jsonl' })['agy-probe'];
  assert.deepEqual(Object.keys(config), [
    'SessionStart',
    'PreToolUse',
    'PostToolUse',
    'PreInvocation',
    'PostInvocation',
    'Stop',
  ]);
  assert.deepEqual(
    config.SessionStart.map((h) => h.command),
    [
      'node ./probe.mjs hook SessionStart relative',
      'node "/abs/probe.mjs" hook SessionStart absolute "/abs/log.jsonl"',
    ],
  );
  assert.deepEqual(
    config.PreToolUse[0].hooks.map((h) => h.command),
    ['node ./probe.mjs hook PreToolUse relative'],
  );
  assert.equal(config.PostToolUse[0].hooks.length, 2);
  assert.equal(config.Stop[0].matcher, undefined);
  assert.doesNotMatch(JSON.stringify(config), /PLUGIN_ROOT/);
  const servers = mcpConfig({ probe: '/abs/probe.mjs', log: '/abs/log.jsonl' }).mcpServers;
  assert.deepEqual(Object.keys(servers), ['probe-abs', 'probe-root', 'probe-rel']);
  assert.deepEqual(servers['probe-rel'].args, ['probe.mjs', 'mcp', 'relative']);
});

test('a hook answers {} and records the payload; SessionStart asks for the token', (context) => {
  const { dir } = scratch(context);
  const pre = hook({ cwd: dir }, 'PreToolUse', 'relative', {
    conversationId: 'c1',
    toolCall: { name: 'write_to_file', args: { TargetFile: '/w/a.txt', CodeContent: 'hi' } },
  });
  assert.equal(pre.status, 0);
  assert.equal(pre.stdout, '{}');

  const start = hook({ cwd: dir }, 'SessionStart', 'relative', { transcriptPath: '/t.jsonl' });
  const steps = JSON.parse(start.stdout).injectSteps;
  assert.equal(steps.length, 1);
  assert.doesNotMatch(steps[0].ephemeralMessage, new RegExp(TOKEN));

  const [first, second] = records(join(dir, LOG_NAME));
  assert.equal(first.payload.toolCall.args.TargetFile, '/w/a.txt');
  assert.equal(first.wroteTo, join(dir, LOG_NAME));
  assert.equal(second.transcript, '/t.jsonl');
});

test('a log path the probe cannot write falls back to its folder, naming the refusal', (context) => {
  const { dir } = scratch(context);
  const blocked = join(dir, 'missing', 'log.jsonl');
  const result = hook({ cwd: dir, log: blocked }, 'PostToolUse', 'absolute', { stepIdx: 1 });
  assert.equal(result.stdout, '{}');
  const [line] = records(join(dir, LOG_NAME));
  assert.deepEqual(line.failed, [{ path: blocked, error: 'ENOENT' }]);
  assert.deepEqual(logTargets(undefined, '/plugin', '/tmp').length, 2);
});

test('a hook given garbage on stdin still answers {}', (context) => {
  const { dir } = scratch(context);
  const result = spawnSync(process.execPath, [probe, 'hook', 'PreToolUse', 'relative'], {
    cwd: dir,
    input: 'not json',
    encoding: 'utf8',
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '{}');
});

test('the MCP probe answers the handshake, asks for roots, and records a call', async (context) => {
  const { log } = scratch(context);
  const child = spawn(process.execPath, [probe, 'mcp', 'absolute', log, '--root=/plugin'], {
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  context.after(() => child.kill());
  const lines = [];
  let buffer = '';
  const waitFor = (match) =>
    new Promise((resolve) => {
      const check = () => {
        const found = lines.find(match);
        if (found) resolve(found);
        else child.stdout.once('data', check);
      };
      check();
    });
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    const parts = buffer.split('\n');
    buffer = parts.pop();
    lines.push(...parts.filter(Boolean).map((line) => JSON.parse(line)));
  });
  const send = (message) =>
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);

  send({
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-06-18', capabilities: { roots: {} } },
  });
  assert.equal((await waitFor((m) => m.id === 1)).result.serverInfo.name, 'agy-probe');
  send({ method: 'notifications/initialized' });
  await waitFor((m) => m.method === 'roots/list');
  send({ id: 'probe-roots', result: { roots: [{ uri: 'file:///work' }] } });
  send({ id: 2, method: 'tools/list' });
  assert.equal((await waitFor((m) => m.id === 2)).result.tools[0].name, 'probe_echo');
  send({ id: 3, method: 'tools/call', params: { name: 'probe_echo', arguments: { text: 'hi' } } });
  assert.equal((await waitFor((m) => m.id === 3)).result.content[0].text, 'probe ok: hi');

  const events = records(log).map((r) => r.event);
  assert.deepEqual(events.slice(0, 2), ['start', 'initialize']);
  assert.ok(events.includes('roots/list result'));
  assert.ok(events.includes('tools/call'));
});

test('the report answers each Phase 0 question from the records', () => {
  const at = { argv: [], cwd: '/plugin', env: {} };
  const markdown = report({
    state: {
      createdAt: '2026-10-29',
      steps: {
        version: { command: 'agy --version', status: 0, output: '1.4.10' },
        'validate-review': { command: 'agy plugin validate', status: 0, output: 'ok' },
        'copilot-session': { command: 'copilot -p', status: 0, output: 'ok' },
        session: { command: 'agy -p', status: 0, output: 'Step 7: worked' },
      },
    },
    records: [
      { ...at, kind: 'hook', event: 'SessionStart', via: 'relative', payload: {} },
      {
        ...at,
        kind: 'hook',
        event: 'SessionStart',
        via: 'absolute',
        payload: {},
        wroteTo: '/plugin/probe-log.jsonl',
        failed: [{ path: '/repo/.agy-probe/log.jsonl', error: 'EPERM' }],
      },
      {
        ...at,
        kind: 'hook',
        event: 'PreToolUse',
        via: 'relative',
        payload: {
          toolCall: { name: 'write_to_file', args: { TargetFile: 'a', CodeContent: 'b' } },
        },
      },
      { ...at, kind: 'hook', event: 'CopilotSessionStart', via: 'hooks-dir', payload: {} },
      { ...at, kind: 'mcp', event: 'start', via: 'relative', argv: ['mcp', 'relative'] },
      { ...at, kind: 'mcp', event: 'roots/list result', via: 'relative', result: { roots: [] } },
    ],
    transcripts: { checked: 1, hits: 1 },
  });
  assert.match(markdown, /- The agy session \(`agy -p`\): exit 0\n\n```\nStep 7: worked/);
  assert.match(markdown, /\| SessionStart \| 1 \| 1 \|/);
  assert.match(markdown, /\| PreToolUse \| 1 \| 0 \|/);
  assert.match(markdown, /A relative command \(`\.\/probe\.mjs`\) resolves: yes/);
  assert.match(markdown, /Refused before that: `\/repo\/\.agy-probe\/log\.jsonl \(EPERM\)`/);
  assert.match(markdown, /\| `write_to_file` \| PreToolUse \| TargetFile, CodeContent \|/);
  assert.match(markdown, /reached the model: yes/);
  assert.match(markdown, /Root `hooks\.json` ran: no/);
  assert.match(markdown, /`hooks\/hooks\.json` ran: yes/);
  assert.match(markdown, /Result of `roots\/list`/);
  assert.match(markdown, /\$\{PLUGIN_ROOT\}` expands in `args`: no/);
  assert.match(markdown, /a bare script name resolves: yes/);
  assert.match(markdown, /## 6\. Install under a throwaway HOME\n\n- Install: not run/);
  assert.match(
    markdown,
    /## 7\. A Claude Code plugin converted on install \(css\)\n\n- Install: not run/,
  );
});

test('the Copilot hooks probe names its file and carries the powershell twin', () => {
  const [entry] = copilotHooks({ probe: 'C:/p/probe.mjs', log: 'C:/p/log.jsonl' }, 'hooks-dir')
    .hooks.SessionStart[0].hooks;
  assert.equal(
    entry.command,
    'node "C:/p/probe.mjs" hook CopilotSessionStart hooks-dir "C:/p/log.jsonl"',
  );
  assert.equal(entry.powershell, entry.command);
});

// phase0.mjs finds .agy-probe/ beside the scripts folder it sits in, so these run a copy in a
// scratch root and never reach the real one.
const scratchRoot = (context) => {
  const root = mkdtempSync(join(tmpdir(), 'agy-probe-root-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const scripts = join(root, 'scripts', 'agy-probe');
  mkdirSync(scripts, { recursive: true });
  for (const file of ['phase0.mjs', 'lib.mjs']) {
    copyFileSync(join(dirname(phase0), file), join(scripts, file));
  }
  const probeFile = join(root, '.agy-probe', 'agy-probe', 'probe.mjs');
  const leaveEarlierRun = () => {
    mkdirSync(dirname(probeFile), { recursive: true });
    writeFileSync(probeFile, '');
  };
  const runPhase0 = (args, env) =>
    spawnSync(process.execPath, [join(scripts, 'phase0.mjs'), ...args], {
      encoding: 'utf8',
      env,
    });
  return { root, probeFile, leaveEarlierRun, runPhase0 };
};

// PATH is spelled Path on Windows; drop every spelling before setting it.
const withPath = (path, extra = {}) => ({
  ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^path$/i.test(name))),
  PATH: path,
  ...extra,
});

// A stand-in agy that prints AGY_LIST for `plugin list --json` and succeeds at everything else.
// A shell script, so these tests skip Windows.
const fakeAgy = (context) => {
  const bin = mkdtempSync(join(tmpdir(), 'agy-probe-bin-'));
  context.after(() => rmSync(bin, { recursive: true, force: true }));
  const agy = join(bin, 'agy');
  writeFileSync(
    agy,
    '#!/bin/sh\nif [ "$*" = "plugin list --json" ]; then echo "$AGY_LIST"; else echo ok; fi\n',
  );
  chmodSync(agy, 0o755);
  return bin;
};
const posixOnly = { skip: process.platform === 'win32' && 'the stand-in agy is a shell script' };

test('setup stops before touching anything when agy is not on PATH', (context) => {
  const { root, runPhase0 } = scratchRoot(context);
  const result = runPhase0(['setup'], withPath(''));
  assert.equal(result.status, 1);
  assert.match(result.stdout, /agy is not on PATH/);
  assert.equal(existsSync(join(root, '.agy-probe')), false);
});

test('setup leaves an earlier run alone and points at clean', posixOnly, (context) => {
  const { probeFile, leaveEarlierRun, runPhase0 } = scratchRoot(context);
  leaveEarlierRun();
  const result = runPhase0(['setup'], withPath(fakeAgy(context)));
  assert.equal(result.status, 1);
  assert.match(result.stdout, /left from an earlier run\. Run node ".+phase0\.mjs" clean first/);
  assert.equal(existsSync(probeFile), true);
});

test('clean keeps the probe files unless agy confirms the plugin is gone', (context) => {
  const { probeFile, leaveEarlierRun, runPhase0 } = scratchRoot(context);
  leaveEarlierRun();
  const missing = runPhase0(['clean'], withPath(''));
  assert.equal(missing.status, 1);
  assert.match(missing.stdout, /Could not confirm agy-probe is uninstalled/);
  assert.equal(existsSync(probeFile), true);

  const forced = runPhase0(['clean', '--force'], withPath(''));
  assert.equal(forced.status, 0);
  assert.equal(existsSync(probeFile), false);
});

test(
  'clean removes the probe files once the plugin list no longer names it',
  posixOnly,
  (context) => {
    const { probeFile, leaveEarlierRun, runPhase0 } = scratchRoot(context);
    const bin = fakeAgy(context);
    leaveEarlierRun();
    const listed = runPhase0(['clean'], withPath(bin, { AGY_LIST: '[{"name":"agy-probe"}]' }));
    assert.equal(listed.status, 1);
    assert.match(listed.stdout, /agy-probe is still installed/);
    assert.equal(existsSync(probeFile), true);

    const gone = runPhase0(['clean'], withPath(bin, { AGY_LIST: '[{"name":"review"}]' }));
    assert.equal(gone.status, 0);
    assert.equal(existsSync(probeFile), false);
  },
);
