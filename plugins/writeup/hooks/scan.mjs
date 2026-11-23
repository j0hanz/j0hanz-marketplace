// fires:  PostToolUse on Write|Edit|Bash|PowerShell (Copilot: create|edit|bash|powershell;
//         Antigravity: write_file|edit_file|run_command). A Bash command is split at unquoted
//         && || ; | and newlines (a line ending in \ or ` continues); each `git commit` or `gh
//         pr|issue create|edit|comment|review` segment is scanned on its own. Nothing else fires.
//         `scan.mjs gate` is the PreToolUse mode for public `gh` writes: it denies a command
//         whose body has hits, once per exact body hash per session (per repo when the client
//         sends no session id); the identical resubmission passes.
// reads:  tool_input.{file_path,content,new_string} or .command (Antigravity: toolCall.args
//         {Path, Content, Replacement, CommandLine}); a -F/--file/--body-file a segment
//         names, resolved against payload.cwd (workspacePaths[0] on Antigravity; a `cd`
//         earlier in the session is unseen)
// emits:  hookSpecificOutput.additionalContext (flat additionalContext on Copilot), or
//         nothing. Antigravity has no PostToolUse context channel, so there the findings
//         wait in a per-conversation state file for `scan.mjs deliver`, a PreInvocation
//         hook that answers injectSteps and clears the file.
// fails:  any parse or read error -> exit 0; the scan prints nothing, the gate answers allow
// verify: node hooks/scan.mjs < payload.json; echo $?   (plugins/writeup/test/scan.test.mjs)
import { basename, resolve } from 'node:path';
import { appendFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { text as readText } from 'node:stream/consumers';
import {
  allow,
  deny,
  drainAdvisory,
  parkAdvisory,
  pass,
  stateFile,
  toolInput,
  toolName,
  workspace,
} from './client.mjs';

const PLUGIN_KEY = 'writeup-unslop';

const LIST_OR_HEADING = /^\s*(?:#{1,6}|[-*+]|\d+[.)])\s/;

// Ids match the numbered rules in skills/unslop/SKILL.md.
export const RULES = [
  // AI vocabulary. Verb forms only for enhance/underscore: "enhancement" is a tracker label
  // and "an underscore" is a character, both common in code docs. "landscape" only as
  // "landscape of": orientation and layout docs use the literal word.
  {
    id: 7,
    pattern:
      /\b(?:additionally|crucial\w*|delv\w*|enduring|enhanc(?:e[sd]?|ing)|foster\w*|garner\w*|interplay\w*|intricate\w*|landscapes?\s+of|pivotal\w*|showcas(?:es|ed|ing)|tapestr\w*|testament\w*|underscor(?:es?\s+(?:the|how|that|why)|ed|ing)|vibrant\w*)\b/gi,
  },
  { id: 8, pattern: /\b(?:serves as|stands as|boasts)\b/gi },
  { id: 13, pattern: /—/g },
  // Title case heading: the heading text when 3+ words after the first are capitalized; sentence
  // case capitalizes the first. Case-sensitive.
  { id: 17, pattern: /(?<=^#{1,6} )(?=\S+(?:.*?\b[A-Z][a-z]{3,}){3}).+$/g },
  // Emoji on headings and list items only; the PR attribution footer is prose and stays quiet.
  // © ® ™ ℹ ‼ ⁉ are pictographic to Unicode but typography here.
  {
    id: 18,
    pattern: /(?![©®™ℹ‼⁉])\p{Extended_Pictographic}/gu,
    line: (l) => LIST_OR_HEADING.test(l),
  },
  { id: 19, pattern: /[“‘][^“”‘’\n]*[”’]|[“”‘’]/g },
  { id: 20, pattern: /I hope this helps|let me know if|\bof course!|\bcertainly!|smoking gun/gi },
  { id: 21, pattern: /\bgreat question\b|\babsolutely right\b/gi },
  { id: 23, pattern: /\bin order to\b|\bdue to the fact that\b|\bit is important to note\b/gi },
  { id: 24, pattern: /\b(?:could|might|may) potentially\b|\b(?:could|might) possibly\b/gi },
  { id: 31, pattern: /\b(?:utiliz\w*|leverag\w*|facilitat\w*|numerous|in the event that)\b/gi },
];

const blank = (s) => s.replace(/[^\r\n]/g, ' ');

// Fenced blocks and inline spans become spaces; newlines stay. A fence opens only at line
// start (up to 3 spaces in) and closes on a run of the same character at least as long, so
// ``` in prose and ```` around a ``` block both read as CommonMark does. Unclosed runs to
// the end.
const FENCE = /^ {0,3}((`|~)\2{2,})[^\r\n]*[\s\S]*?(?:^ {0,3}\1\2*[ \t]*\r?$|(?![\s\S]))/gm;
export const stripCode = (text) => text.replace(FENCE, blank).replace(/(`+)[^\r\n]*?\1/g, blank);

export const findSlop = (text) =>
  stripCode(text)
    .split(/\r?\n/)
    .flatMap((line, i) =>
      RULES.flatMap(({ id, pattern, line: applies }) =>
        applies && !applies(line)
          ? []
          : [...line.matchAll(pattern)].map((m) => ({ id, match: m[0], line: i + 1 })),
      ),
    )
    .sort((a, b) => a.line - b.line || a.id - b.id);

// Types allowed by skills/commit/SKILL.md; edit both together.
const COMMIT_TYPES = new Set([
  'feat',
  'fix',
  'refactor',
  'perf',
  'docs',
  'test',
  'chore',
  'build',
  'ci',
  'style',
  'revert',
]);
// Subjects git writes itself are not the agent's prose.
const GIT_GENERATED = /^(?:fixup! |squash! |amend! |Revert "|Merge )/;

export const lintSubject = (subject) => {
  if (typeof subject !== 'string') return [];
  const s = subject.trim();
  if (!s || GIT_GENERATED.test(s)) return [];
  const reasons = [];
  const n = [...s].length;
  if (n > 72) reasons.push(`${n} chars, limit 72`);
  if (s.endsWith('.')) reasons.push('ends in a period');
  const m = s.match(/^([a-z]+)(\([^)]*\))?!?: \S/);
  if (!m) reasons.push('not in type(scope): summary form');
  else if (!COMMIT_TYPES.has(m[1])) reasons.push(`unknown type "${m[1]}"`);
  return reasons.map((match) => ({ id: 'subject', match, line: 1 }));
};

const MAX_SHOWN = 20;
// Facts, not orders: imperative context reads as an injected instruction and gets shown to
// the user instead of used. Each line still names where the repair lives.
const GATE_ENDING =
  'The command did not run. The same text sent again unchanged runs; a rewrite without these patterns passes the scan.';
const ENDING = {
  file: 'A rewrite without these patterns passes the scan.',
  commit: 'An unpushed commit takes a new message with `git commit --amend`.',
  pr: GATE_ENDING,
  comment: GATE_ENDING,
  review: GATE_ENDING,
  issue: GATE_ENDING,
};
const GATED = new Set(['pr', 'comment', 'review', 'issue']);

// Shell words and segments, quote-aware: a quoted string is one word, so a `--file` inside an
// -m message is text, not a flag. A PowerShell here-string (@' or @" to a line starting '@ or
// "@) is one word whatever quotes it holds. Segments split at unquoted && || ; | and newlines,
// so a `gh pr create` chained after `git commit` is its own target. A line ending in an
// unquoted \ (bash) or ` (PowerShell) continues onto the next, so a multi-line command stays
// one segment. A bare heredoc body (`-F - <<EOF`) stays in its segment untokenized, up to the
// delimiter line; a body whose opener sits in an earlier segment is skipped. ponytail: one heredoc
// per line; a second `<<` on the same line replaces the first.
const TOKEN =
  /[\\`]\r?\n|@'\r?\n[\s\S]*?\n'@|@"\r?\n[\s\S]*?\n"@|"(?:\\[\s\S]|[^"\\])*"|'[^']*'|&&|\|\||[|;\n]|(?:[^\s"'|;&\\`]|[\\`](?!\r?\n))+/g;
const HEREDOC = /^<<-?([\w.-]*)$/;
const parse = (command) => {
  const segments = [{ start: 0, words: [] }];
  const token = new RegExp(TOKEN.source, 'g');
  let heredoc = null; // '' while the delimiter is still the next word
  let owner = 0; // index of the segment that opened the heredoc
  for (let m; (m = token.exec(command));) {
    if (m[0] === '\n' && heredoc) {
      const close = new RegExp(`^\\t*${heredoc.replace(/[.-]/g, '\\$&')}[ \\t]*\\r?$`, 'm');
      const found = close.exec(command.slice(token.lastIndex));
      token.lastIndex = found ? token.lastIndex + found.index + found[0].length : command.length;
      if (owner !== segments.length - 1) {
        segments.at(-1).end = m.index;
        segments.push({ start: token.lastIndex, words: [] });
      }
      heredoc = null;
      continue;
    }
    if (/^[\\`]\r?\n$/.test(m[0])) continue; // line continuation: same segment, no word
    if (/^(?:&&|\|\||[|;\n])$/.test(m[0])) {
      segments.at(-1).end = m.index;
      segments.push({ start: m.index + m[0].length, words: [] });
      continue;
    }
    const word = m[0].replace(/^(["'])([\s\S]*)\1$/, '$2');
    if (heredoc === '') heredoc = word;
    else if (HEREDOC.test(m[0])) {
      heredoc = m[0].match(HEREDOC)[1];
      owner = segments.length - 1;
    }
    segments.at(-1).words.push(word);
  }
  return segments.map((s) => ({ ...s, text: command.slice(s.start, s.end) }));
};

// `git commit -F msg.txt` and `gh pr create --body-file body.md` carry the prose in a file the
// command only names. Read it; `-` is stdin and stays unread.
const MESSAGE_FLAG = /^(?:-F|--file|--body-file)(?:=([\s\S]*))?$/;
const messageFile = (words, cwd) => {
  for (const [i, w] of words.entries()) {
    const m = w.match(MESSAGE_FLAG);
    if (!m) continue;
    const file = m[1] || words[i + 1];
    if (!file || file === '-') return null;
    try {
      return { file, text: readFileSync(resolve(cwd ?? '', file), 'utf8') };
    } catch {
      return null;
    }
  }
  return null;
};

// First -m value (or the -F file's first real line); a heredoc or here-string wrapper's opener
// line is skipped. Undefined when the message lives elsewhere (editor, stdin).
const OPENER = /^(?:\$\(cat <<-?['"]?[\w.-]+['"]?|@['"])\s*$/;
const subjectOf = (words, msg) => {
  let value;
  if (msg) value = msg.text.split(/\r?\n/).find((l) => l.trim() && !l.startsWith('#'));
  else {
    for (const [i, w] of words.entries()) {
      if (/^-[a-zA-Z]*m$|^--message$/.test(w)) value = words[i + 1];
      else if (w.startsWith('--message=')) value = w.slice(10);
      else continue;
      break;
    }
    const lines = value?.split(/\r?\n/);
    if (lines && OPENER.test(lines[0])) value = lines[1];
  }
  return value?.replace(/\r$/, '');
};

const GH = {
  pr: {
    create: ['pr', 'PR body'],
    edit: ['pr', 'PR body'],
    comment: ['comment', 'PR comment'],
    review: ['review', 'review body'],
  },
  issue: {
    create: ['issue', 'issue body'],
    edit: ['issue', 'issue body'],
    comment: ['comment', 'issue comment'],
  },
};
// git's global options sit between `git` and the subcommand; these take the next word as value.
const GIT_VALUE_OPTION = /^(?:-C|-c|--git-dir|--work-tree|--namespace|--config-env)$/;
const gitSubcommand = (words, i) => {
  let j = i + 1;
  while (words[j]?.startsWith('-')) j += GIT_VALUE_OPTION.test(words[j]) ? 2 : 1;
  return words[j];
};
const commandKind = (words) => {
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i] === 'git' && gitSubcommand(words, i) === 'commit')
      return ['commit', 'commit message'];
    const group = words[i] === 'gh' && Object.hasOwn(GH, words[i + 1]) ? GH[words[i + 1]] : null;
    if (group && Object.hasOwn(group, words[i + 2])) return group[words[i + 2]];
  }
  return null;
};

// Files an agent reads rather than a person: anything under .claude/, .copilot/ or .gemini/
// (memory, plans) and instruction files. Their house style (an em dash per index line, for
// one) is not slop.
const AGENT_FACING =
  /(?:^|[\\/])\.(?:claude|copilot|gemini)[\\/]|(?:^|[\\/])(?:CLAUDE|AGENTS|GEMINI|copilot-instructions)\.md$/i;

// One target per thing scanned; a shell command yields one per commit or gh segment, with
// lines counted inside that segment.
export const targets = (payload) => {
  const tool = toolName(payload);
  const { filePath, written, replacement, command } = toolInput(payload);
  if (tool === 'Write' || tool === 'Edit') {
    const path = String(filePath ?? '');
    const text = written ?? replacement;
    if (
      !/\.mdx?$/i.test(path) ||
      /node_modules[\\/]|skills[\\/]unslop[\\/]/.test(path) ||
      AGENT_FACING.test(path) ||
      typeof text !== 'string'
    )
      return [];
    return [{ kind: 'file', name: path, text, edit: tool === 'Edit' }];
  }
  if ((tool === 'Bash' || tool === 'PowerShell') && typeof command === 'string') {
    return parse(command).flatMap(({ text, words }) => {
      const found = commandKind(words);
      if (!found) return [];
      const [kind, name] = found;
      const msg = messageFile(words, workspace(payload));
      const t = msg
        ? { kind, name: `${name} (${msg.file})`, text: msg.text }
        : { kind, name, text };
      return [kind === 'commit' ? { ...t, subject: subjectOf(words, msg) } : t];
    });
  }
  return [];
};

export const message = (t, hits) =>
  [
    `writeup:unslop flagged ${hits.length} pattern${hits.length === 1 ? '' : 's'} in ${t.edit ? 'an edit to ' : ''}${t.name}:`,
    ...hits
      .slice(0, MAX_SHOWN)
      .map((h) =>
        h.id === 'subject'
          ? `- commit subject: ${h.match}`
          : `- rule ${h.id} "${h.match}" (line ${h.line}${t.edit ? ' of the edit' : ''})`,
      ),
    ...(hits.length > MAX_SHOWN ? [`- and ${hits.length - MAX_SHOWN} more`] : []),
    ENDING[t.kind],
  ].join('\n');

// PreToolUse: deny a public gh write whose body has hits, once per exact body.
export const gate = (payload) => {
  const file = stateFile('writeup-gate', payload, workspace(payload), 'txt');
  let seen = [];
  try {
    seen = readFileSync(file, 'utf8').split('\n');
  } catch {}
  const fresh = targets(payload)
    .filter((t) => GATED.has(t.kind))
    .flatMap((t) => {
      const hits = findSlop(t.text);
      const hash = createHash('sha256').update(t.text).digest('hex');
      return hits.length && !seen.includes(hash) ? [{ t, hits, hash }] : [];
    });
  if (!fresh.length) return allow();
  appendFileSync(file, fresh.map((f) => f.hash + '\n').join(''));
  return deny(fresh.map((f) => message(f.t, f.hits)).join('\n\n'));
};

// Imported by the test, run by the hook; a name check survives symlinked and junctioned roots.
if (basename(process.argv[1] ?? '') === 'scan.mjs') {
  const raw = await readText(process.stdin).catch(() => '');
  if (process.argv[2] === 'gate') {
    try {
      process.stdout.write(gate(JSON.parse(raw || '{}')));
    } catch {
      process.stdout.write(allow()); // fail open: a crash must never deny the tool
    }
  } else {
    try {
      const payload = JSON.parse(raw || '{}');
      if (process.argv[2] === 'deliver') {
        process.stdout.write(drainAdvisory(PLUGIN_KEY, payload));
      } else {
        const blocks = targets(payload)
          .filter((t) => !GATED.has(t.kind))
          .flatMap((t) => {
            const hits = [...lintSubject(t.subject), ...findSlop(t.text)];
            return hits.length ? [message(t, hits)] : [];
          });
        process.stdout.write(parkAdvisory(PLUGIN_KEY, payload, blocks.join('\n\n')));
      }
    } catch {
      process.stdout.write(pass());
      // fail open: never block a tool on a reflective hook
    }
  }
}
