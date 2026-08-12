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
// verify: node hooks/set-style.mjs --self-test
//         echo '{"command_args":"concise"}' | node hooks/set-style.mjs --hook; echo $?
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// One ordered row per style: key, settings value, menu description. Menu order is
// row order; a null value deletes the key, restoring Claude's built-in default.
// CHOICES and MENU both derive from these rows, so the two can never drift apart.
const STYLES = [
  [
    'concise',
    'output-styles:concise',
    'Terse, direct output — no filler, no unsolicited examples.',
  ],
  ['tldr', 'output-styles:tldr', 'One-line summary, then bullets — no prose filler.'],
  [
    'diagram-first',
    'output-styles:diagram-first',
    'Answer with a diagram or visual first, then minimal prose.',
  ],
  [
    'schematic',
    'output-styles:schematic',
    'Prose answer first, ASCII diagrams only — no narration or recap.',
  ],
  ['default', null, "Reset to Claude's built-in default output style."],
];

const CHOICES = Object.fromEntries(STYLES.map(([key, value]) => [key, value]));
// Shown when /set-style is typed with no argument, or an argument we don't know.
const MENU = STYLES.map(([key, , description]) => [key, description]);
// Longest key, so a longer style can't silently break the menu's column alignment.
const MENU_PAD = Math.max(...STYLES.map(([key]) => key.length));

const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');

// UserPromptExpansion sends command_args as one space-separated string. Tolerate an
// array too, so the parse survives if that shape ever changes back — and so argv,
// which really is an array, goes through this same parse.
function firstArg(commandArgs) {
  const text = Array.isArray(commandArgs) ? commandArgs.join(' ') : String(commandArgs ?? '');
  return text.trim().split(/\s+/)[0] ?? '';
}

// Match input against CHOICES with case and punctuation dropped from both sides, so
// "TL;DR" finds tldr and "Diagram First" finds diagram-first. Derived from CHOICES:
// adding a style needs no edit here.
function matchChoice(arg) {
  const key = arg.toLowerCase().replace(/[^a-z0-9]/g, '');
  return Object.keys(CHOICES).find((c) => c.replace(/-/g, '') === key) ?? null;
}

function menuLines(badArg) {
  const lines = badArg ? [`Unknown output style "${badArg}".`, ''] : [];
  lines.push('Usage: /set-style <style>');
  for (const [key, description] of MENU) lines.push(`  ${key.padEnd(MENU_PAD)} ${description}`);
  return lines;
}

// Both entry points print these throws verbatim, so each one names its own repair.
function readSettings(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    throw e;
  }
  // Strip a leading UTF-8 BOM: JSON.parse rejects it (not valid JSON per RFC 8259),
  // so a settings file saved with a BOM would otherwise read as "not valid JSON"
  // even though its content is fine.
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  if (raw.trim() === '') return {};
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch (e) {
    throw new Error(`${file} is not valid JSON (${e.message}) — fix it, refusing to overwrite.`);
  }
  // An array or a scalar would drop the assignment again on the way back through
  // JSON.stringify, reporting success while changing nothing.
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error(`${file} does not hold a JSON object — fix it, refusing to overwrite.`);
  }
  return obj;
}

// Apply the choice to an in-memory object; return true if a change was made.
function applyChoice(obj, choice) {
  const mapped = CHOICES[choice];
  if (mapped === null) {
    if (!Object.hasOwn(obj, 'outputStyle')) return false;
    delete obj.outputStyle;
    return true;
  }
  if (obj.outputStyle === mapped) return false;
  obj.outputStyle = mapped;
  return true;
}

// Temp file + rename, because a crash mid-write would otherwise truncate the file
// holding every other global setting the user has.
function writeSettings(file, obj) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.set-style.${process.pid}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  try {
    fs.renameSync(tmp, file);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e;
  }
}

// Warn if project/local settings in cwd override the global outputStyle.
function overrideWarnings(cwd) {
  const warnings = [];
  for (const name of ['.claude/settings.json', '.claude/settings.local.json']) {
    // When cwd is the user's home, these resolve to the global config files
    // (~/.claude/*), not project overrides — warning about them tells the user
    // their global setting overrides itself. Skip that case.
    if (path.resolve(cwd, name) === path.resolve(os.homedir(), name)) continue;
    let obj;
    try {
      obj = JSON.parse(fs.readFileSync(path.join(cwd, name), 'utf8'));
    } catch {
      continue; // absent, unreadable, or malformed — not ours to report
    }
    if (obj && Object.hasOwn(obj, 'outputStyle')) {
      warnings.push(
        `warning: ${name} sets "outputStyle" — project/local settings override the global one and may prevent this change from taking effect here.`,
      );
    }
  }
  return warnings;
}

// Write the choice through and return the lines to report. Throws on unusable settings.
function run(choice, cwd) {
  const obj = readSettings(SETTINGS);
  // Warn on the no-op path too: already-set plus a silent project override is exactly
  // the case where the style appears not to apply.
  const warnings = overrideWarnings(cwd);
  if (!applyChoice(obj, choice)) return ['Already set.', ...warnings];
  writeSettings(SETTINGS, obj);
  const label = choice === 'default' ? 'default (built-in)' : CHOICES[choice];
  return [
    `outputStyle set to: ${label}`,
    'Note: output style is read at session start — run /clear or start a new session for it to take effect.',
    ...warnings,
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
  const raw = firstArg(payload?.command_args);
  const choice = raw ? matchChoice(raw) : null;

  let lines;
  if (!choice) {
    lines = menuLines(raw);
  } else {
    try {
      lines = run(choice, typeof payload?.cwd === 'string' ? payload.cwd : process.cwd());
    } catch (e) {
      lines = [`set-style: ${e?.message ?? String(e)}`];
    }
  }

  process.stderr.write(lines.join('\n') + '\n');
  return 2;
}

function main(argv) {
  if (argv.length === 1 && argv[0] === '--self-test') return selfTest();
  if (argv.length === 1 && argv[0] === '--hook') return hookMain();

  const raw = firstArg(argv);
  const choice = raw ? matchChoice(raw) : null;
  if (!choice) {
    process.stderr.write(menuLines(raw).join('\n') + '\n');
    return 1;
  }
  try {
    for (const line of run(choice, process.cwd())) console.log(line);
  } catch (e) {
    process.stderr.write(`error: ${e?.message ?? String(e)}\n`);
    return 1;
  }
  return 0;
}

// ponytail: in-process self-test, no framework — smallest thing that fails if the
// merge, the arg parse, or the menu rendering breaks.
function selfTest() {
  const fails = [];
  const check = (ok, msg) => ok || fails.push(msg);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'set-style-'));
  const file = path.join(dir, 'settings.json');
  const roundTrip = (obj, choice) => {
    applyChoice(obj, choice);
    writeSettings(file, obj);
    return readSettings(file);
  };

  // 1) set on an absent file, reset, then set again through the matcher
  let obj = roundTrip(readSettings(file), 'concise');
  check(obj.outputStyle === 'output-styles:concise', `set concise => ${obj.outputStyle}`);
  obj = roundTrip(obj, 'default');
  check(!Object.hasOwn(obj, 'outputStyle'), `default left outputStyle=${obj.outputStyle}`);
  check(matchChoice('TL;DR') === 'tldr', `matchChoice("TL;DR") => ${matchChoice('TL;DR')}`);
  obj = roundTrip(obj, matchChoice('TL;DR'));
  check(obj.outputStyle === 'output-styles:tldr', `set tldr => ${obj.outputStyle}`);

  // 2) unrelated keys survive — the whole reason this merges instead of replacing
  fs.writeFileSync(file, JSON.stringify({ model: 'opus', outputStyle: 'stale' }));
  obj = roundTrip(readSettings(file), 'concise');
  check(obj.model === 'opus', 'merge dropped an unrelated key');

  // 3) a settings file we cannot merge into is refused, never overwritten
  for (const bad of ['[1,2]', '"hello"', '{oops']) {
    fs.writeFileSync(file, bad);
    let threw = false;
    try {
      readSettings(file);
    } catch {
      threw = true;
    }
    check(threw, `readSettings accepted ${bad}`);
  }

  // 4) every shipped style still round-trips through the matcher
  for (const key of Object.keys(CHOICES)) {
    check(matchChoice(key) === key, `matchChoice("${key}") => ${matchChoice(key)}`);
  }

  // 5) both menu shapes — a bare /set-style, and one carrying a style we don't know
  check(menuLines('').join('\n').includes('schematic'), 'menu does not list schematic');
  check(menuLines('bogus')[0].includes('"bogus"'), `bad-arg menu opened ${menuLines('bogus')[0]}`);

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
    check(firstArg(input) === want, `firstArg(${JSON.stringify(input)}) => "${firstArg(input)}"`);
  }

  // 7) a project override is reported even when the global was already correct
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude', 'settings.json'), '{"outputStyle":"x"}');
  check(overrideWarnings(dir).length === 1, 'project override went unreported');

  // 8) a BOM-prefixed settings file is accepted, not rejected as invalid JSON
  fs.writeFileSync(file, '﻿{"outputStyle":"output-styles:concise"}');
  check(readSettings(file).outputStyle === 'output-styles:concise', 'BOM settings rejected');

  fs.rmSync(dir, { recursive: true, force: true });
  for (const f of fails) console.log(`self-test FAIL: ${f}`);
  if (fails.length) return 1;
  console.log('self-test ok');
  return 0;
}

// exitCode, not process.exit(): exit() can cut off a piped stdout/stderr mid-write.
try {
  process.exitCode = main(process.argv.slice(2));
} catch (e) {
  process.stderr.write(`error: ${e?.message ?? String(e)}\n`);
  process.exitCode = 1;
}
