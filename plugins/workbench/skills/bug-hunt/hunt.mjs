// usage:  node hunt.mjs [path ...] [--since <ref>]
// reads:  git, then the changed files themselves — never writes
// emits:  the brief — scope, changed set, blast radius, tells
// fails:  exit 2 when scope cannot be resolved without asking; exit 1 on no git

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { join, extname, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';

const SKIP_DIR = new Set([
  '.git',
  'node_modules',
  'vendor',
  'dist',
  'build',
  'target',
  '.venv',
  'venv',
  '__pycache__',
  'coverage',
  '.next',
  '.nuxt',
  '.svelte-kit',
  'out',
  'bin',
  'obj',
]);
// Only patterns a CODE extension can actually reach — `auditable` gates on
// CODE first, so lockfiles and snapshots never get this far.
const SKIP_FILE = /\.min\.\w+$|\.generated\./;
const CODE = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.go',
  '.rs',
  '.rb',
  '.java',
  '.kt',
  '.cs',
  '.php',
  '.swift',
  '.c',
  '.h',
  '.cc',
  '.cpp',
  '.sh',
]);

// A symbol is only a contract inside its own language. Cross-language matches
// are string coincidences — `build` in a .py file is not a caller of a .mjs export.
const FAMILY = {
  '.ts': 'js',
  '.tsx': 'js',
  '.js': 'js',
  '.jsx': 'js',
  '.mjs': 'js',
  '.cjs': 'js',
  '.py': 'py',
  '.go': 'go',
  '.rs': 'rs',
  '.rb': 'rb',
  '.java': 'jvm',
  '.kt': 'jvm',
  '.cs': 'cs',
  '.php': 'php',
  '.swift': 'swift',
  '.sh': 'sh',
  '.c': 'c',
  '.h': 'c',
  '.cc': 'c',
  '.cpp': 'c',
};
const family = (p) => FAMILY[extname(p)] ?? 'other';

// Each tell names a place to look, never a finding. `only` scopes it to the
// families where it means something. Every tell runs against the whole file
// rather than line by line — a tag that fires on healthy code trains the reader
// to skip the list, and the shapes worth tagging spread over lines: an empty
// catch sits on two, a promise chain carries its .catch four down.
const TELLS = [
  { tag: 'SWALLOWED', re: /catch\s*(\([^)]*\))?\s*\{\s*\}|except[^:\n]*:\s*pass\b|rescue\s+nil\b/ },
  {
    tag: 'BROAD',
    re: /except\s+(Exception|BaseException)\b|catch\s*\(\s*(e|err|error)?\s*\)\s*\{[^}]{0,40}(return|continue)\s*;?\s*\}/,
  },
  {
    tag: 'ESCAPE',
    re: /\bas\s+any\b|@ts-ignore|@ts-expect-error|#\s*type:\s*ignore|\.unwrap\(\)|\bpanic!\(/,
  },
  { tag: 'UNAWAITED', re: /\.then\((?![\s\S]{0,300}?\.catch)/, only: ['js'] },
  {
    tag: 'SECRET',
    re: /(api[_-]?key|secret|passwd|password|token|private[_-]?key)\s*[:=]\s*["'][^"'\s]{8,}["']/i,
  },
  {
    tag: 'SQL',
    re: /(execute|query|exec|raw|prepare)\s*\(\s*(["'`][^"'`]*["'`]\s*\+|f["']|`[^`]*\$\{)/i,
  },
  { tag: 'LOOSE', re: /[^=!<>+\-*/&|]\s(==|!=)\s[^=]/, only: ['js', 'php'] },
  { tag: 'MARKER', re: /\b(TODO|FIXME|XXX|HACK)\b/ },
];

const EXPORTS = [
  /^\s*export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/,
  /^\s*export\s+(?:type|interface|enum)\s+([A-Za-z_$][\w$]*)/,
  /^\s*(?:public\s+)?(?:async\s+)?def\s+([a-zA-Z_]\w*)/,
  /^\s*class\s+([A-Za-z_]\w*)/,
  /^\s*func\s+(?:\([^)]*\)\s*)?([A-Z]\w*)/,
  /^\s*pub\s+(?:async\s+)?(?:fn|struct|enum|trait)\s+([A-Za-z_]\w*)/,
];

// PROBE_LIMIT and COMMON_WORD_FILES are quoted back in the sentences that
// disclose them, so each reads one name — a cap that drifts from its own
// disclosure turns the brief into a liar. TAG_WIDTH derives from the tags
// themselves: add a tag and the column stays aligned.
const MIN_SYMBOL_LENGTH = 4;
const PROBE_LIMIT = 40;
const COMMON_WORD_FILES = 15;
const CALLERS_SHOWN = 8;
const TELLS_SHOWN = 120;
const ONE_PASS_FILES = 40;
const ONE_PASS_LINES = 6000;
const TAG_WIDTH = Math.max(...TELLS.map((t) => t.tag.length));

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const were = (n) => (n === 1 ? 'was' : 'were');

// stderr piped, not inherited: resolving the default branch probes refs that are
// expected to be missing, and those fatals are not the user's problem.
// trimEnd, never trim: `status --porcelain` leads with a status column whose
// first char is a space for an unstaged edit, and stripping it shifts every path
// left by one. Trailing newline is all any caller here needs gone.
const git = (...args) =>
  execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 32 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trimEnd();

const auditable = (p) =>
  CODE.has(extname(p)) &&
  !SKIP_FILE.test(p.split('/').pop()) &&
  !p.split('/').some((part) => SKIP_DIR.has(part));

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIR.has(entry.name)) walk(join(dir, entry.name), out);
    } else {
      const p = relative(process.cwd(), join(dir, entry.name)).split(sep).join('/');
      if (auditable(p)) out.push(p);
    }
  }
  return out;
}

// `from` is the directory the user invoked in — named paths are relative to it,
// while everything else here is relative to the repo root we already chdir'd to.
function resolveScope(args, from) {
  // strict: an unknown flag or a `--since` with no ref throws here rather than
  // being dropped on the floor, which would silently audit some other scope.
  let since, named;
  try {
    const parsed = parseArgs({
      args,
      options: { since: { type: 'string' } },
      allowPositionals: true,
    });
    since = parsed.values.since;
    named = parsed.positionals;
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }

  // Named paths win over --since, and a scope silently overriding another is the
  // failure the strict parse above exists to prevent. Ask instead.
  if (named.length > 0 && since !== undefined) {
    console.error('name paths or pass --since, not both');
    process.exit(2);
  }

  if (named.length > 0) {
    const files = [];
    for (const p of named) {
      const abs = resolve(from, p);
      let stat;
      try {
        stat = statSync(abs);
      } catch {
        console.error(`no such path: ${p}`);
        process.exit(2);
      }
      files.push(
        ...(stat.isDirectory() ? walk(abs) : [relative(process.cwd(), abs).split(sep).join('/')]),
      );
    }
    return { rule: `named on the command line (${named.join(', ')})`, files };
  }
  if (since !== undefined) {
    if (!since) {
      console.error('--since needs a ref');
      process.exit(2);
    }
    return {
      rule: `changed since ${since}`,
      files: git('diff', '--name-only', `${since}..HEAD`).split('\n'),
    };
  }

  // Porcelain v1: two status chars, a space, then the path. A `D` in either
  // column means the file is gone — keeping it only buys an unreadable-file
  // line in the brief for a deletion there is nothing left to audit.
  const dirty = git('status', '--porcelain')
    .split('\n')
    .map((l) => /^(..) (.*)$/.exec(l))
    .filter((m) => m && !m[1].includes('D'))
    .map((m) => m[2].replace(/^.*? -> /, '').replace(/^"|"$/g, ''));
  if (dirty.length > 0) return { rule: 'uncommitted changes in the working tree', files: dirty };

  const head = git('rev-parse', '--abbrev-ref', 'HEAD');
  let base = '';
  for (const candidate of ['origin/HEAD', 'main', 'master']) {
    try {
      const resolved = git('rev-parse', '--abbrev-ref', candidate).replace(/^origin\//, '');
      git('rev-parse', '--verify', resolved); // resolving the ref is not having the branch
      base = resolved;
      break;
    } catch {}
  }
  if (base && head !== base) {
    try {
      // Shallow clones can share no ancestor at all — that is a question for the
      // user, not a crash.
      const merge = git('merge-base', base, 'HEAD');
      if (merge) {
        return {
          rule: `branch ${head} against ${base} (${merge.slice(0, 8)})`,
          files: git('diff', '--name-only', `${merge}..HEAD`).split('\n'),
        };
      }
    } catch {}
  }
  return null;
}

// Scope names the paths; this opens them, once, for every pass that follows. A
// file that will not open leaves by name rather than riding along as a 0-line
// entry nobody audits.
function readScope(paths) {
  const source = new Map();
  const unreadable = [];
  for (const file of new Set(paths.filter(Boolean).filter(auditable))) {
    try {
      source.set(file, readFileSync(file, 'utf8'));
    } catch {
      unreadable.push(file);
    }
  }
  return { source, unreadable };
}

function tells(source) {
  // Keyed, not pushed: a whole-file scan matches per occurrence, and one tag
  // twice on one line is one place to look, not two.
  const found = new Map();
  for (const [file, text] of source) {
    const fam = family(file);
    const lines = text.split('\n');
    // Offsets once per file. Slicing the prefix per match to count newlines is
    // quadratic, and a marker on every line of a 20k-line file is 20k matches.
    const starts = [];
    let at = 0;
    for (const line of lines) {
      starts.push(at);
      at += line.length + 1;
    }
    for (const { tag, re, only } of TELLS) {
      if (only && !only.includes(fam)) continue;
      // matchAll walks forward, so the cursor only ever advances — one pass over
      // the offsets per tell, not one per match. Reset it with the tell.
      let cursor = 0;
      for (const m of text.matchAll(new RegExp(re.source, `${re.flags}g`))) {
        while (cursor + 1 < starts.length && starts[cursor + 1] <= m.index) cursor += 1;
        const line = cursor + 1;
        found.set(`${file}:${line}:${tag}`, { file, line, text: lines[line - 1] ?? '', tag });
      }
    }
  }
  const hits = [...found.values()];
  // Read order, not tell order — the reader walks a file top to bottom.
  hits.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return hits.map(
    (hit) =>
      `${hit.file}:${hit.line}  ${hit.tag.padEnd(TAG_WIDTH)} ${hit.text.trim().slice(0, 90)}`,
  );
}

function blastRadius(source) {
  const symbols = new Map();
  for (const [file, text] of source) {
    for (const line of text.split('\n')) {
      for (const re of EXPORTS) {
        const name = re.exec(line)?.[1];
        if (name && name.length >= MIN_SYMBOL_LENGTH) symbols.set(name, file);
      }
    }
  }

  // Longest names first: a distinctive symbol earns the scan, `get` does not.
  const ranked = [...symbols.keys()].sort((a, b) => b.length - a.length);
  const probes = ranked
    .slice(0, PROBE_LIMIT)
    .map((name) => [name, new RegExp(`\\b${name}\\b`), family(symbols.get(name))]);

  const universe = walk(process.cwd()).filter((file) => !source.has(file));
  const callers = new Map();
  for (const file of universe) {
    const fam = family(file);
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const [name, re, owner] of probes) {
      if (owner !== fam) continue;
      if (re.test(text)) {
        if (!callers.has(name)) callers.set(name, []);
        callers.get(name).push(file);
      }
    }
  }

  // A symbol hitting this many files is a common word, not a contract. Dropping
  // it beats a stoplist: the threshold tunes itself to whatever the repo names.
  let generic = 0;
  for (const [name, paths] of callers) {
    if (paths.length > COMMON_WORD_FILES) {
      callers.delete(name);
      generic += 1;
    }
  }
  return { symbols, callers, generic, unprobed: ranked.length - probes.length };
}

// Git reports paths from the repo root, so the whole run works from there.
// Left at the invocation directory, every read below misses and the brief
// reports the whole changed set unreadable — loud, but for the wrong reason.
const invokedIn = process.cwd();
try {
  process.chdir(git('rev-parse', '--show-toplevel'));
} catch {
  console.error('not a git repository — name the files or directories to audit');
  process.exit(1);
}

const scope = resolveScope(process.argv.slice(2), invokedIn);
if (!scope) {
  console.error(
    'clean tree on the default branch — nothing resolves on its own.\n' +
      'Ask which, then re-run: named paths, or --since <ref>.',
  );
  process.exit(2);
}

const { source, unreadable } = readScope(scope.files);
const changed = [...source].map(([file, text]) => [file, text.split('\n').length]);
const total = changed.reduce((n, [, lines]) => n + lines, 0);

const brief = [];
brief.push(
  `## Scope\n\n${scope.rule} — ${plural(changed.length, 'file')}, ${plural(total, 'line')} to read.`,
);
if (unreadable.length > 0) {
  brief.push(
    `\n${plural(unreadable.length, 'file')} in scope could not be read and left the audit:`,
  );
  for (const file of unreadable) brief.push(`    ${file}`);
}
if (changed.length === 0) {
  brief.push('\nNothing auditable in scope. Stop and say so.');
  console.log(brief.join('\n'));
  process.exit(0);
}
if (changed.length > ONE_PASS_FILES || total > ONE_PASS_LINES) {
  brief.push(
    `\nOver one pass. Hunt the highest-risk subset first — external input, auth, money,\n` +
      `persistence, deletion — and name in the report exactly what you left unread.`,
  );
}

brief.push(`\n## Changed\n`);
for (const [file, lines] of changed.sort((a, b) => b[1] - a[1]))
  brief.push(`${file}  (${plural(lines, 'line')})`);

const { symbols, callers, generic, unprobed } = blastRadius(source);
brief.push(`\n## Blast radius\n`);
if (callers.size === 0) {
  brief.push(
    symbols.size === 0
      ? 'No exported symbols found in the changed set — grep the contracts by hand.'
      : `${plural(symbols.size - unprobed, 'exported symbol')} probed, no callers outside the changed set.`,
  );
} else {
  brief.push('Read enough of each caller to judge the changed contract, then stop.\n');
  for (const [name, paths] of [...callers].sort((a, b) => b[1].length - a[1].length)) {
    brief.push(`${name}  (${symbols.get(name)})`);
    for (const caller of paths.slice(0, CALLERS_SHOWN)) brief.push(`    ${caller}`);
    if (paths.length > CALLERS_SHOWN) brief.push(`    …and ${paths.length - CALLERS_SHOWN} more`);
  }
}
if (generic > 0) {
  brief.push(
    `\n${plural(generic, 'symbol')} hit more than ${COMMON_WORD_FILES} files and ${were(generic)}` +
      ` dropped as common words. Grep them by hand if the change touched their contract.`,
  );
}
if (unprobed > 0) {
  brief.push(
    `\n${plural(unprobed, 'shorter symbol')} fell past the ${PROBE_LIMIT}-symbol probe limit and` +
      ` ${were(unprobed)} never scanned for callers. Grep them by hand.`,
  );
}

const hits = tells(source);
brief.push(`\n## Tells\n`);
brief.push(
  hits.length === 0
    ? 'None. The taxonomy still applies — most defects carry no grep signature.'
    : `${plural(hits.length, 'place')} to look. Each is a question, not a finding.\n`,
);
for (const hit of hits.slice(0, TELLS_SHOWN)) brief.push(hit);
if (hits.length > TELLS_SHOWN) brief.push(`…and ${hits.length - TELLS_SHOWN} more`);

console.log(brief.join('\n'));
