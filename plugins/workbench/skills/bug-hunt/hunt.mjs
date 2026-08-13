// usage:  node hunt.mjs [path ...] [--since <ref>]
// reads:  git, then the changed files themselves — never writes
// emits:  the brief — scope, changed set, blast radius, tells
// fails:  exit 2 when scope cannot be resolved without asking; exit 1 on no git

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { join, extname, relative, resolve, sep } from 'node:path';

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
// families where it means something, and `whole` runs it against the whole file
// rather than a line — a tag that fires on healthy code trains the reader to
// skip the whole list, and a promise chain spreads its .catch over four lines.
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
  { tag: 'UNAWAITED', re: /\.then\((?![\s\S]{0,300}?\.catch)/, only: ['js'], whole: true },
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

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// stderr piped, not inherited: resolving the default branch probes refs that are
// expected to be missing, and those fatals are not the user's problem.
const gitRaw = (...args) =>
  execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 32 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

// Trimmed by default — every caller but `status --porcelain` wants one value.
// Porcelain leads with a status column whose first char is a space for an
// unstaged edit, and trimming it shifts every path left by one.
const git = (...args) => gitRaw(...args).trim();

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
  const sinceAt = args.indexOf('--since');
  const named = args.filter(
    (a, i) => !a.startsWith('--') && !(sinceAt !== -1 && i === sinceAt + 1),
  );

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
  if (sinceAt !== -1) {
    const ref = args[sinceAt + 1];
    if (!ref) {
      console.error('--since needs a ref');
      process.exit(2);
    }
    return {
      rule: `changed since ${ref}`,
      files: git('diff', '--name-only', `${ref}..HEAD`).split('\n'),
    };
  }

  // Porcelain v1: two status chars, a space, then the path. A `D` in either
  // column means the file is gone — counting it puts a 0-line entry in scope.
  const dirty = gitRaw('status', '--porcelain')
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

function tells(files) {
  const hits = [];
  for (const file of files) {
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const fam = family(file);
    const lines = text.split('\n');
    for (const { tag, re, only, whole } of TELLS) {
      if (only && !only.includes(fam)) continue;
      if (whole) {
        for (const m of text.matchAll(new RegExp(re.source, `${re.flags}g`))) {
          const line = text.slice(0, m.index).split('\n').length;
          hits.push({ file, line, text: lines[line - 1] ?? '', tag });
        }
      } else {
        lines.forEach((line, i) => {
          if (line.length <= 500 && re.test(line))
            hits.push({ file, line: i + 1, text: line, tag });
        });
      }
    }
  }
  // Read order, not tell order — the reader walks a file top to bottom.
  hits.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return hits.map((h) => `${h.file}:${h.line}  ${h.tag.padEnd(9)} ${h.text.trim().slice(0, 90)}`);
}

function blastRadius(files) {
  const symbols = new Map();
  for (const file of files) {
    let lines;
    try {
      lines = readFileSync(file, 'utf8').split('\n');
    } catch {
      continue;
    }
    for (const line of lines) {
      for (const re of EXPORTS) {
        const name = re.exec(line)?.[1];
        if (name && name.length >= 4) symbols.set(name, file);
      }
    }
  }

  // Longest names first: a distinctive symbol earns the scan, `get` does not.
  const probes = [...symbols.keys()]
    .sort((a, b) => b.length - a.length)
    .slice(0, 40)
    .map((name) => [name, new RegExp(`\\b${name}\\b`), family(symbols.get(name))]);

  const changed = new Set(files);
  const universe = walk(process.cwd()).filter((p) => !changed.has(p));
  const callers = new Map();
  for (const path of universe) {
    const fam = family(path);
    let text;
    try {
      text = readFileSync(path, 'utf8');
    } catch {
      continue;
    }
    for (const [name, re, owner] of probes) {
      if (owner !== fam) continue;
      if (re.test(text)) {
        if (!callers.has(name)) callers.set(name, []);
        callers.get(name).push(path);
      }
    }
  }

  // A symbol hitting this many files is a common word, not a contract. Dropping
  // it beats a stoplist: the threshold tunes itself to whatever the repo names.
  let generic = 0;
  for (const [name, paths] of callers) {
    if (paths.length > 15) {
      callers.delete(name);
      generic += 1;
    }
  }
  return { symbols, callers, generic };
}

// Git reports paths from the repo root, so the whole run works from there.
// Left at the invocation directory, every readFileSync below misses and the
// brief reports a full changed set at zero lines — wrong, and silently so.
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

const files = [...new Set(scope.files.filter(Boolean).filter(auditable))];
const sized = files.map((f) => {
  try {
    return [f, readFileSync(f, 'utf8').split('\n').length];
  } catch {
    return [f, 0];
  }
});
const total = sized.reduce((n, [, l]) => n + l, 0);

const out = [];
out.push(
  `## Scope\n\n${scope.rule} — ${plural(files.length, 'file')}, ${plural(total, 'line')} to read.`,
);
if (files.length === 0) {
  out.push('\nNothing auditable in scope. Stop and say so.');
  console.log(out.join('\n'));
  process.exit(0);
}
if (files.length > 40 || total > 6000) {
  out.push(
    `\nOver one pass. Hunt the highest-risk subset first — external input, auth, money,\n` +
      `persistence, deletion — and name in the report exactly what you left unread.`,
  );
}

out.push(`\n## Changed\n`);
for (const [f, l] of sized.sort((a, b) => b[1] - a[1])) out.push(`${f}  (${plural(l, 'line')})`);

const { symbols, callers, generic } = blastRadius(files);
out.push(`\n## Blast radius\n`);
if (callers.size === 0) {
  out.push(
    symbols.size === 0
      ? 'No exported symbols found in the changed set — grep the contracts by hand.'
      : `${plural(symbols.size, 'exported symbol')}, no callers outside the changed set.`,
  );
} else {
  out.push('Read enough of each caller to judge the changed contract, then stop.\n');
  for (const [name, paths] of [...callers].sort((a, b) => b[1].length - a[1].length)) {
    out.push(`${name}  (${symbols.get(name)})`);
    for (const p of paths.slice(0, 8)) out.push(`    ${p}`);
    if (paths.length > 8) out.push(`    …and ${paths.length - 8} more`);
  }
}
if (generic > 0) {
  out.push(
    `\n${plural(generic, 'symbol')} hit more than 15 files and ${generic === 1 ? 'was' : 'were'}` +
      ` dropped as common words. Grep them by hand if the change touched their contract.`,
  );
}

const hits = tells(files);
out.push(`\n## Tells\n`);
out.push(
  hits.length === 0
    ? 'None. The taxonomy still applies — most defects carry no grep signature.'
    : `${plural(hits.length, 'place')} to look. Each is a question, not a finding.\n`,
);
for (const h of hits.slice(0, 120)) out.push(h);
if (hits.length > 120) out.push(`…and ${hits.length - 120} more`);

console.log(out.join('\n'));
