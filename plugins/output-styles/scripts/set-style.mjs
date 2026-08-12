#!/usr/bin/env node
// set-style.mjs — set the user's GLOBAL outputStyle in ~/.claude/settings.json.
// Merges into the existing global settings file (never overwrites unrelated keys).
// Uses only Node built-ins: node:fs, node:os, node:path.
//
// Two entry points:
//   node set-style.mjs <choice>   CLI / skill fallback — prints to stdout.
//   node set-style.mjs --hook     UserPromptExpansion handler, see hooks/hooks.json.
//
// fires:  UserPromptExpansion, matcher (^|:)set-style$
// reads:  .command_args (a space-separated string, not an array), .cwd
// emits:  exit 2 + stderr, the documented way to block an expansion, so /set-style
//         never reaches the model. Not JSON: on exit 2 stderr is the only channel read.
// fails:  unreadable stdin -> exit 0 with no output, expansion proceeds and
//         skills/set-style/SKILL.md handles it the slow way
// verify: node scripts/set-style.mjs --self-test
//         echo '{"command_args":["concise"]}' | node scripts/set-style.mjs --hook; echo $?
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHOICES = {
  concise: 'output-styles:concise',
  tldr: 'output-styles:tldr',
  'diagram-first': 'output-styles:diagram-first',
  schematic: 'output-styles:schematic',
  default: null, // null => delete the key
};

// Shown when /set-style is typed with no argument, or an argument we don't know.
// Kept in the same order as CHOICES; the self-test fails if the two drift apart.
const MENU = [
  ['concise', 'Terse, direct output — no filler, no unsolicited examples.'],
  ['tldr', 'One-line summary, then bullets — no prose filler.'],
  ['diagram-first', 'Answer with a diagram or visual first, then minimal prose.'],
  ['schematic', 'Prose answer first, ASCII diagrams only — no narration or recap.'],
  ['default', "Reset to Claude's built-in default output style."],
];

// UserPromptExpansion sends command_args as one space-separated string. Tolerate an
// array too, so the parse survives if that shape ever changes back.
function firstArg(commandArgs) {
  const text = Array.isArray(commandArgs) ? commandArgs.join(' ') : String(commandArgs ?? '');
  return text.trim().split(/\s+/)[0] ?? '';
}

// Normalize user input: lower-case, strip non-alphanumeric, match known choices.
function normalize(arg) {
  const key = arg.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (key === 'tldr' || key === 'tlr') return 'tldr';
  if (key === 'concise') return 'concise';
  if (key === 'diagramfirst') return 'diagram-first';
  if (key === 'schematic') return 'schematic';
  if (key === 'default') return 'default';
  return null;
}

function menuLines(badArg) {
  const out = badArg ? [`Unknown output style "${badArg}".`, ''] : [];
  out.push('Usage: /set-style <style>');
  for (const [key, description] of MENU) out.push(`  ${key.padEnd(13)} ${description}`);
  return out;
}

function usage(stream) {
  stream.write('usage: node set-style.mjs <choice>\n');
  stream.write(`  choice: ${Object.keys(CHOICES).join(' | ')}\n`);
  stream.write('  (default removes outputStyle, restoring Claude built-in Default)\n');
}

function readSettings(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    throw e;
  }
  if (raw.trim() === '') return {};
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch (e) {
    const err = new Error(`settings.json is not valid JSON: ${file}: ${e.message}`);
    err.invalidJson = true;
    throw err;
  }
  return obj && typeof obj === 'object' ? obj : {};
}

// Apply the choice to an in-memory object; return true if a change was made.
function applyChoice(obj, choice) {
  const mapped = CHOICES[choice];
  if (mapped === null) {
    if (Object.prototype.hasOwnProperty.call(obj, 'outputStyle')) {
      delete obj.outputStyle;
      return true;
    }
    return false;
  }
  if (obj.outputStyle === mapped) return false;
  obj.outputStyle = mapped;
  return true;
}

function writeSettings(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

// Warn if project/local settings in cwd override the global outputStyle.
function overrideWarnings(cwd) {
  const warnings = [];
  for (const name of ['.claude/settings.json', '.claude/settings.local.json']) {
    const f = path.join(cwd, name);
    let raw;
    try {
      raw = fs.readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    try {
      const obj = JSON.parse(raw);
      if (obj && Object.prototype.hasOwnProperty.call(obj, 'outputStyle')) {
        warnings.push(
          `warning: ${name} sets "outputStyle" — project/local settings override the global one and may prevent this change from taking effect here.`,
        );
      }
    } catch {
      // ignore unreadable local files
    }
  }
  return warnings;
}

// Write the choice through and return the lines to report. Throws on unreadable settings.
function run(choice, cwd) {
  const file = path.join(os.homedir(), '.claude', 'settings.json');
  const obj = readSettings(file);
  if (!applyChoice(obj, choice)) return ['Already set.'];
  writeSettings(file, obj);
  const label = choice === 'default' ? 'default (built-in)' : CHOICES[choice];
  return [
    `outputStyle set to: ${label}`,
    'Note: output style is read at session start — run /clear or start a new session for it to take effect.',
    ...overrideWarnings(cwd),
  ];
}

// UserPromptExpansion handler. Answers on stderr and exits 2, which blocks the
// expansion, so the model is never invoked. Exit 0 with no output is the fail-open
// path: the expansion proceeds and the skill does the job instead.
function hookMain() {
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return 0;
  }
  // Only the first argument names a style. Trailing words are ignored rather than
  // rejected, so "/set-style concise please" still applies concise.
  const raw = firstArg(payload.command_args);
  const choice = raw ? normalize(raw) : null;

  let lines;
  if (!choice) {
    lines = menuLines(raw);
  } else {
    try {
      lines = run(choice, typeof payload.cwd === 'string' ? payload.cwd : process.cwd());
    } catch (e) {
      lines = [`set-style: ${e && e.message ? e.message : String(e)}`];
    }
  }

  process.stderr.write(lines.join('\n') + '\n');
  return 2;
}

function main(argv) {
  if (argv.length === 1 && argv[0] === '--self-test') return selfTest();
  if (argv.length === 1 && argv[0] === '--hook') return hookMain();
  if (argv.length !== 1) {
    usage(process.stderr);
    return 1;
  }
  const choice = normalize(argv[0]);
  if (!choice) {
    usage(process.stderr);
    process.stderr.write(`error: unknown choice "${argv[0]}"\n`);
    return 1;
  }

  let lines;
  try {
    lines = run(choice, process.cwd());
  } catch (e) {
    if (e.invalidJson) {
      process.stderr.write(`error: ${e.message}\n`);
      process.stderr.write('Refusing to overwrite the existing settings file.\n');
      return 1;
    }
    throw e;
  }
  for (const line of lines) console.log(line);
  return 0;
}

// ponytail: in-process self-test, no framework — smallest thing that fails if merge logic breaks.
function selfTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'set-style-'));
  const file = path.join(tmp, 'settings.json');

  // 1) set concise on empty file
  let obj = readSettings(file);
  applyChoice(obj, 'concise');
  writeSettings(file, obj);
  obj = readSettings(file);
  if (obj.outputStyle !== 'output-styles:concise') {
    console.log(`self-test FAIL: expected output-styles:concise, got ${obj.outputStyle}`);
    return 1;
  }

  // 2) set default -> key gone
  applyChoice(obj, 'default');
  writeSettings(file, obj);
  obj = readSettings(file);
  if (Object.prototype.hasOwnProperty.call(obj, 'outputStyle')) {
    console.log(`self-test FAIL: expected outputStyle absent, got ${obj.outputStyle}`);
    return 1;
  }

  // 3) "TL;DR" input normalizes to tldr
  const norm = normalize('TL;DR');
  if (norm !== 'tldr') {
    console.log(`self-test FAIL: normalize("TL;DR") => ${norm}, expected tldr`);
    return 1;
  }
  applyChoice(obj, norm);
  writeSettings(file, obj);
  obj = readSettings(file);
  if (obj.outputStyle !== 'output-styles:tldr') {
    console.log(`self-test FAIL: expected output-styles:tldr, got ${obj.outputStyle}`);
    return 1;
  }

  // 4) every shipped style is reachable and listed — this is the drift that hid schematic
  const listed = MENU.map(([key]) => key);
  const known = Object.keys(CHOICES);
  if (listed.join(',') !== known.join(',')) {
    console.log(`self-test FAIL: MENU [${listed}] does not match CHOICES [${known}]`);
    return 1;
  }
  for (const key of known) {
    if (normalize(key) !== key) {
      console.log(`self-test FAIL: normalize("${key}") => ${normalize(key)}`);
      return 1;
    }
  }

  // 5) both menu shapes — a bare /set-style, and one carrying a style we don't know
  if (!menuLines('').join('\n').includes('schematic')) {
    console.log('self-test FAIL: menu does not list schematic');
    return 1;
  }
  const rejected = menuLines('bogus');
  if (!rejected[0].includes('"bogus"')) {
    console.log(`self-test FAIL: bad-arg menu opened with ${rejected[0]}`);
    return 1;
  }

  // 6) the hook payload shape — command_args is a string, and reading it as an array
  // made every /set-style <style> fall through to the menu
  for (const [input, want] of [
    ['concise', 'concise'],
    ['  tldr  ', 'tldr'],
    ['concise please', 'concise'],
    [['concise'], 'concise'],
    ['', ''],
    [undefined, ''],
  ]) {
    const got = firstArg(input);
    if (got !== want) {
      console.log(
        `self-test FAIL: firstArg(${JSON.stringify(input)}) => "${got}", expected "${want}"`,
      );
      return 1;
    }
  }

  console.log('self-test ok');
  return 0;
}

try {
  process.exit(main(process.argv.slice(2)));
} catch (e) {
  process.stderr.write(`error: ${e && e.message ? e.message : String(e)}\n`);
  process.exit(1);
}
