// Phase 0 of plan 014, run once on a machine where Antigravity CLI (`agy`) is signed in. It
// answers what the docs leave open before any hook is ported:
//
//   node scripts/agy-probe/phase0.mjs setup [--home-test]
//       version, `agy plugin validate` on four of our plugins, an install from this repo's
//       GitHub folder, the agy-probe plugin installed, Copilot's hooks-file check when
//       `copilot` is on PATH, one headless agy session (`agy -p`) that exercises the probe,
//       and css installed, read back and uninstalled to see what agy's conversion of a Claude
//       Code plugin makes of its hooks. --home-test also tries an install under a throwaway
//       HOME; with no sign-in there, agy may open a browser.
//   node scripts/agy-probe/phase0.mjs report
//       writes .agy-probe/report.md, the one file to paste back.
//   node scripts/agy-probe/phase0.mjs clean [--force]
//       uninstalls agy-probe, then removes .agy-probe/ and the workspace once agy confirms the
//       plugin is gone. --force removes them anyway, for a machine where agy itself is gone.
import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import {
  copilotHooks,
  hooksConfig,
  LOG_NAME,
  mcpConfig,
  posix,
  report,
  TMP_LOG_NAME,
  TOKEN,
} from './lib.mjs';

const HERE = import.meta.dirname;
const ROOT = resolve(HERE, '..', '..');
const DIR = join(ROOT, '.agy-probe');
const STATE = join(DIR, 'state.json');
const LOG = join(DIR, 'log.jsonl');
const REPORT = join(DIR, 'report.md');
const PLUGIN = join(DIR, 'agy-probe');
// Outside the repo, so agy does not pick up this repo's AGENTS.md as rules for the session.
const WORKSPACE = join(tmpdir(), 'agy-probe-workspace');
const TMP_LOG = join(tmpdir(), TMP_LOG_NAME);

const say = (text = '') => process.stdout.write(`${text}\n`);
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
};
const quote = (value) => `"${value}"`;
// By absolute path: the session step leaves the shell in the workspace, outside the repo.
const self = (command) => `node ${quote(join(HERE, 'phase0.mjs'))} ${command}`;

// shell: true for the same reason as validate.mjs: `agy` and `copilot` may be .cmd shims on
// Windows. One command string, quoted by the caller, since Node 24 deprecates an argument
// list with shell: true. stdin is closed, so a command that wants input fails, not waits.
const execute = (bin, args, { env = {}, timeout = 120_000, cwd } = {}) =>
  spawnSync([bin, ...args].join(' '), {
    shell: true,
    encoding: 'utf8',
    timeout,
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NO_COLOR: '1', ...env },
  });

// A step's command and output, cut to keep state.json and the report readable.
const cut = (text, cap) =>
  text.length > cap ? `${text.slice(0, cap)}… (${text.length} chars)` : text;
const CAP = 6000;
const run = (bin, args, options) => {
  const result = execute(bin, args, options);
  return {
    command: cut([bin, ...args].join(' '), 120),
    status: result.status,
    timedOut: result.error?.code === 'ETIMEDOUT',
    output: cut(`${result.stdout ?? ''}${result.stderr ?? ''}`, CAP),
  };
};

const repoSlug = () => {
  try {
    const remote = execFileSync('git', ['config', '--get', 'remote.origin.url'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim();
    return remote.match(/([^/:]+\/[^/]+?)(?:\.git)?\/?$/)?.[1] ?? 'j0hanz/j0hanz-marketplace';
  } catch {
    return 'j0hanz/j0hanz-marketplace';
  }
};

// One line with no quotes, so it passes through cmd.exe and sh alike as one argument.
const PROMPT = [
  'This is a probe session for a hooks test. Do each step in order with your own tools.',
  'Step 1: create the file probe.txt containing the line one.',
  'Step 2: replace one with two in probe.txt.',
  'Step 3: in a single edit, change two to three and also add a last line four, two separate places in the file.',
  'Step 4: read probe.txt.',
  'Step 5: run the shell command node --version.',
  'Step 6: search this folder for the text three.',
  'Step 7: call the MCP tool probe_echo with the text hi; it comes from the agy-probe plugin.',
  'Step 8: use the probe-skill skill.',
  'Step 9: if an earlier message asked you to write a PROBE word, write it now; otherwise say no probe word.',
  'Finish with one line per step saying whether it worked.',
].join(' ');

function writeProbePlugin() {
  mkdirSync(PLUGIN, { recursive: true });
  for (const file of ['probe.mjs', 'lib.mjs']) copyFileSync(join(HERE, file), join(PLUGIN, file));
  // Beside the script, so the installed copy finds it too.
  writeJson(join(PLUGIN, 'env-baseline.json'), Object.keys(process.env));
  const paths = { probe: posix(join(PLUGIN, 'probe.mjs')), log: posix(LOG) };
  writeJson(join(PLUGIN, '.antigravity-plugin', 'plugin.json'), {
    name: 'agy-probe',
    version: '0.0.0',
    description: 'Records what Antigravity CLI hands hooks and MCP servers. Remove after the run.',
  });
  writeJson(join(PLUGIN, 'hooks.json'), hooksConfig(paths));
  writeJson(join(PLUGIN, 'mcp_config.json'), mcpConfig(paths));
  mkdirSync(join(PLUGIN, 'skills', 'probe-skill'), { recursive: true });
  writeFileSync(
    join(PLUGIN, 'skills', 'probe-skill', 'SKILL.md'),
    '---\nname: probe-skill\ndescription: Probe skill for the agy-probe run. Use only when asked for probe-skill.\n---\n\nReply with the words "probe skill loaded" and nothing else.\n',
  );
  return paths;
}

// Copilot reads `hooks.json` or `hooks/hooks.json` at a plugin root, and its docs do not say
// which wins. A plugin with both, each naming itself, installed under a throwaway home.
function writeCopilotProbe(paths) {
  const market = join(DIR, 'copilot-market');
  writeJson(join(market, '.claude-plugin', 'marketplace.json'), {
    name: 'agy-probe-market',
    owner: { name: 'agy-probe' },
    plugins: [{ name: 'hooks-probe', source: './hooks-probe', description: 'Hooks-file check' }],
  });
  const plugin = join(market, 'hooks-probe');
  writeJson(join(plugin, '.claude-plugin', 'plugin.json'), {
    name: 'hooks-probe',
    version: '0.0.0',
    description: 'Which hooks file Copilot CLI reads (plan 014, Phase 0).',
  });
  writeJson(join(plugin, 'hooks.json'), copilotHooks(paths, 'root-hooks.json'));
  writeJson(join(plugin, 'hooks', 'hooks.json'), copilotHooks(paths, 'hooks-dir'));
  return market;
}

function setup(args) {
  const steps = {};
  const step = (id, label, ...call) => {
    steps[id] = run(...call);
    const { status, timedOut } = steps[id];
    say(`${status === 0 ? '✔' : '✘'} ${label}${timedOut ? ' (timed out)' : ''}`);
    return steps[id];
  };

  if (step('version', 'agy --version', 'agy', ['--version']).status !== 0) {
    say('agy is not on PATH. Install Antigravity CLI and sign in, then run setup again.');
    process.exit(1);
  }
  // An earlier run's probe may still be installed, its hooks running from .agy-probe/. Only
  // clean, which uninstalls it first, may take that folder away.
  if (existsSync(DIR)) {
    say(`.agy-probe/ is left from an earlier run. Run ${self('clean')} first.`);
    process.exit(1);
  }
  mkdirSync(DIR, { recursive: true });
  rmSync(TMP_LOG, { force: true });

  for (const name of ['review', 'mcp-hub', 'css', 'tutor']) {
    const dir = join(ROOT, 'plugins', name);
    step(`validate-${name}`, `agy plugin validate plugins/${name}`, 'agy', [
      'plugin',
      'validate',
      quote(dir),
    ]);
  }

  const folder = `https://github.com/${repoSlug()}/tree/main/plugins/review`;
  step('install-subpath', `agy plugin install ${folder}`, 'agy', ['plugin', 'install', folder]);
  step('plugin-list', 'agy plugin list --json', 'agy', ['plugin', 'list', '--json']);

  const paths = writeProbePlugin();
  step('validate-probe', 'agy plugin validate (probe plugin)', 'agy', [
    'plugin',
    'validate',
    quote(PLUGIN),
  ]);
  if (args.includes('--home-test')) {
    const home = mkdtempSync(join(tmpdir(), 'agy-home-'));
    try {
      step(
        'home-override',
        'agy plugin install under a throwaway HOME',
        'agy',
        ['plugin', 'install', quote(PLUGIN)],
        { env: { HOME: home, USERPROFILE: home }, timeout: 60_000 },
      );
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  }
  step('install-probe', 'agy plugin install (probe plugin)', 'agy', [
    'plugin',
    'install',
    quote(PLUGIN),
  ]);

  if (run('copilot', ['--version']).status === 0) {
    const market = writeCopilotProbe(paths);
    const env = { COPILOT_HOME: join(DIR, 'copilot-home') };
    step(
      'copilot-add',
      'copilot plugin marketplace add (hooks probe)',
      'copilot',
      ['plugin', 'marketplace', 'add', quote(market)],
      { env },
    );
    step(
      'copilot-install',
      'copilot plugin install hooks-probe',
      'copilot',
      ['plugin', 'install', 'hooks-probe@agy-probe-market'],
      { env },
    );
    step(
      'copilot-session',
      'copilot -p (hooks probe session)',
      'copilot',
      ['-p', quote('Reply with the word ok.')],
      { env },
    );
  } else {
    say('- copilot not on PATH: skipped the hooks-file check');
  }

  // The session runs headless, in a fresh folder outside the repo, so nothing has to be pasted
  // and agy's own reply lands in the report.
  rmSync(WORKSPACE, { recursive: true, force: true });
  mkdirSync(WORKSPACE, { recursive: true });
  writeFileSync(join(DIR, 'prompt.txt'), `${PROMPT}\n`);
  say('… running one agy session in the workspace, which takes a few minutes');
  step('session', 'agy -p (probe session)', 'agy', ['-p', quote(PROMPT)], {
    cwd: WORKSPACE,
    timeout: 300_000,
  });

  // agy says it converts a Claude Code plugin on install. What it makes of one with hooks
  // decides how much of Phase 2 is left: css, installed after the session so its hooks stay
  // out of it, its files read back, and uninstalled.
  const css = `https://github.com/${repoSlug()}/tree/main/plugins/css`;
  step('convert-install', 'agy plugin install plugins/css (converted)', 'agy', [
    'plugin',
    'install',
    css,
  ]);
  steps['convert-files'] = convertedFiles(installedPath('css'));
  step('convert-uninstall', 'agy plugin uninstall css', 'agy', ['plugin', 'uninstall', 'css']);

  writeJson(STATE, { createdAt: new Date().toISOString(), workspace: WORKSPACE, steps });

  say();
  say(`Done. Now run ${self('report')} and paste the file it writes.`);
}

// Where agy installed a plugin, by its own listing; where it installs plugins, without one.
function installedPath(name) {
  const listed = execute('agy', ['plugin', 'list', '--json'], { timeout: 60_000 });
  try {
    const found = JSON.parse(listed.stdout).find((plugin) => plugin.name === name);
    if (found?.path) return found.path;
  } catch {
    // No agy, or no JSON from it.
  }
  return join(homedir(), '.gemini', 'config', 'plugins', name);
}

// Every JSON file agy wrote for a converted plugin (manifest, hooks, MCP), as one step's output.
function convertedFiles(root) {
  const found = [];
  const walk = (dir) => {
    for (const entry of existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : []) {
      const path = join(dir, entry.name);
      if (entry.isDirectory() && !['node_modules', '.git'].includes(entry.name)) walk(path);
      else if (entry.isFile() && entry.name.endsWith('.json')) found.push(path);
    }
  };
  walk(root);
  const output = found.map((path) => `== ${relative(root, path)}\n${linesOf(path).join('\n')}`);
  return {
    command: `read the JSON files under ${root}`,
    status: found.length ? 0 : 1,
    timedOut: false,
    output: cut(output.join('\n') || '(no JSON files: nothing installed there)', 12_000),
  };
}

// A file that exists but cannot be read is skipped, not fatal: the others may hold the run.
function linesOf(file) {
  try {
    return readFileSync(file, 'utf8').split('\n');
  } catch {
    return [];
  }
}

// Every place the probe may have written: the repo log, its plugin folder (installed and
// source copies), and the temp folder.
const readRecords = () => {
  const files = [LOG, join(installedPath('agy-probe'), LOG_NAME), join(PLUGIN, LOG_NAME), TMP_LOG];
  const lines = new Set(files.flatMap(linesOf));
  return [...lines].filter(Boolean).flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
};

function writeReport() {
  if (!existsSync(STATE)) {
    say('No .agy-probe/state.json: run setup first.');
    process.exit(1);
  }
  const records = readRecords();
  const paths = [...new Set(records.map((r) => r.transcript).filter(Boolean))].filter(existsSync);
  const hits = paths.reduce((n, path) => n + readFileSync(path, 'utf8').split(TOKEN).length - 1, 0);
  writeFileSync(
    REPORT,
    report({ state: readJson(STATE), records, transcripts: { checked: paths.length, hits } }),
  );
  say(`Wrote ${REPORT}. Paste the whole file back. Then: ${self('clean')}`);
}

// The installed probe runs its hooks from .agy-probe/, so deleting that while agy-probe is still
// installed leaves every agy session a PreToolUse hook that fails, which may deny tool calls.
// Only a listing that succeeded, read whole, and does not name agy-probe lets the files go: an
// agy that is missing, fails or times out proves nothing.
function clean(args) {
  execute('agy', ['plugin', 'uninstall', 'agy-probe']);
  const listed = execute('agy', ['plugin', 'list', '--json'], { timeout: 60_000 });
  const gone = listed.status === 0 && !String(listed.stdout).includes('agy-probe');
  if (!gone && !args.includes('--force')) {
    say(
      listed.status === 0
        ? 'agy-probe is still installed.'
        : 'Could not confirm agy-probe is uninstalled: `agy plugin list --json` did not succeed.',
    );
    say('Its hooks run from .agy-probe/, so that stays. In agy, run /plugin uninstall agy-probe,');
    say(`then ${self('clean')} again; add --force only if agy itself is gone.`);
    process.exit(1);
  }
  // The workspace and temp log a recorded run made; with no record, nothing of a run's to remove.
  const workspace = existsSync(STATE) ? readJson(STATE).workspace : undefined;
  rmSync(DIR, { recursive: true, force: true });
  if (workspace) {
    rmSync(workspace, { recursive: true, force: true });
    rmSync(TMP_LOG, { force: true });
  }
  say('Removed agy-probe, .agy-probe/ and the workspace. review stays installed in agy;');
  say('remove it with /plugin uninstall review if you do not want it.');
}

const [command, ...args] = process.argv.slice(2);
if (command === 'setup') setup(args);
else if (command === 'report') writeReport();
else if (command === 'clean') clean(args);
else {
  say('usage: node scripts/agy-probe/phase0.mjs <setup [--home-test] | report | clean [--force]>');
  process.exit(command ? 1 : 0);
}
