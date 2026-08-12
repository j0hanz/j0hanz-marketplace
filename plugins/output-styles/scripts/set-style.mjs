#!/usr/bin/env node
// set-style.mjs — set the user's GLOBAL outputStyle in ~/.claude/settings.json.
// Merges into the existing global settings file (never overwrites unrelated keys).
// Uses only Node built-ins: node:fs, node:os, node:path.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHOICES = {
  concise: 'output-styles:concise',
  tldr: 'output-styles:tldr',
  'diagram-first': 'output-styles:diagram-first',
  default: null, // null => delete the key
};

// Normalize user input: lower-case, strip non-alphanumeric, match known choices.
function normalize(arg) {
  const key = arg.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (key === 'tldr' || key === 'tlr') return 'tldr';
  if (key === 'concise') return 'concise';
  if (key === 'diagramfirst') return 'diagram-first';
  if (key === 'default') return 'default';
  return null;
}

function usage(stream) {
  stream.write('usage: node set-style.mjs <choice>\n');
  stream.write('  choice: concise | tldr | diagram-first | default\n');
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
function warnOverrides(cwd) {
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
        console.log(
          `warning: ${name} sets "outputStyle" — project/local settings override the global one and may prevent this change from taking effect here.`,
        );
      }
    } catch {
      // ignore unreadable local files
    }
  }
}

function main(argv) {
  if (argv.length === 1 && argv[0] === '--self-test') {
    return selfTest();
  }
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

  const cwd = process.cwd();

  const file = path.join(os.homedir(), '.claude', 'settings.json');
  let obj;
  try {
    obj = readSettings(file);
  } catch (e) {
    if (e.invalidJson) {
      process.stderr.write(`error: ${e.message}\n`);
      process.stderr.write('Refusing to overwrite the existing settings file.\n');
      return 1;
    }
    throw e;
  }

  const changed = applyChoice(obj, choice);
  if (!changed) {
    console.log('Already set.');
    return 0;
  }
  writeSettings(file, obj);

  const label = choice === 'default' ? 'default (built-in)' : CHOICES[choice];
  console.log(`outputStyle set to: ${label}`);
  console.log(
    'Note: output style is read at session start — run /clear or start a new session for it to take effect.',
  );

  warnOverrides(cwd);
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

  console.log('self-test ok');
  return 0;
}

try {
  process.exit(main(process.argv.slice(2)));
} catch (e) {
  process.stderr.write(`error: ${e && e.message ? e.message : String(e)}\n`);
  process.exit(1);
}
