// fires:  PostToolUse on Write|Edit|Bash (Copilot: create|edit|bash|powershell). A Bash
//         command is split at unquoted && || ; | and newlines; each `git commit` or
//         `gh pr create|edit|comment|review` segment is scanned on its own. Nothing else fires.
// reads:  tool_input.{file_path,content,new_string} or .command; a -F/--file/--body-file a
//         segment names, resolved against payload.cwd (a `cd` earlier in the session is unseen)
// emits:  hookSpecificOutput.additionalContext (flat additionalContext on Copilot), or nothing
// fails:  any parse or read error -> exit 0, no output; never blocks
// verify: node hooks/scan.mjs < payload.json; echo $?   (plugins/writeup/test/scan.test.mjs)
import { basename, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { text as readText } from 'node:stream/consumers';
import { context, toolInput, toolName } from './client.mjs';

const LIST_OR_HEADING = /^\s*(?:#{1,6}|[-*+]|\d+[.)])\s/;

// Ids match the numbered rules in skills/unslop/SKILL.md.
export const RULES = [
  // AI vocabulary. Verb forms only for enhance/underscore: "enhancement" is a tracker label
  // and "an underscore" is a character, both common in code docs.
  {
    id: 7,
    pattern:
      /\b(?:additionally|crucial\w*|delv\w*|enduring|enhanc(?:e[sd]?|ing)|foster\w*|garner\w*|interplay\w*|intricate\w*|landscape\w*|pivotal\w*|showcas(?:es|ed|ing)|tapestr\w*|testament\w*|underscor(?:es?\s+(?:the|how|that|why)|ed|ing)|vibrant\w*)\b/gi,
  },
  { id: 13, pattern: /—/g },
  // Title case heading: the heading text when it holds 3+ capitalized words. Case-sensitive.
  { id: 17, pattern: /(?<=^#{1,6} )(?=(?:.*?\b[A-Z][a-z]{3,}){3}).+$/g },
  // Emoji on headings and list items only; the PR attribution footer is prose and stays quiet.
  // © ® ™ ℹ ‼ ⁉ are pictographic to Unicode but typography here.
  {
    id: 18,
    pattern: /(?![©®™ℹ‼⁉])\p{Extended_Pictographic}/gu,
    line: (l) => LIST_OR_HEADING.test(l),
  },
  { id: 19, pattern: /[“‘][^“”‘’\n]*[”’]|[“”‘’]/g },
  { id: 20, pattern: /I hope this helps|let me know if|\bof course!|\bcertainly!|smoking gun/gi },
  { id: 23, pattern: /\bin order to\b|\bdue to the fact that\b|\bit is important to note\b/gi },
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

const MAX_SHOWN = 20;
// Facts, not orders: imperative context reads as an injected instruction and gets shown to
// the user instead of used. Each line still names where the repair lives.
const ENDING = {
  file: 'A rewrite without these patterns passes the scan.',
  commit: 'An unpushed commit takes a new message with `git commit --amend`.',
  pr: '`gh pr edit --body-file` replaces the PR body.',
  comment: '`gh pr comment --edit-last` replaces the comment.',
  review: 'A follow-up `gh pr comment` carries the correction.',
};

// Shell words and segments, quote-aware: a quoted string is one word, so a `--file` inside an
// -m message is text, not a flag. Segments split at unquoted && || ; | and newlines, so a
// `gh pr create` chained after `git commit` is its own target.
const TOKEN = /"(?:\\[\s\S]|[^"\\])*"|'[^']*'|&&|\|\||[|;\n]|[^\s"'|;&]+/g;
const parse = (command) => {
  const segments = [{ start: 0, words: [] }];
  for (const m of command.matchAll(TOKEN)) {
    if (/^(?:&&|\|\||[|;\n])$/.test(m[0])) {
      segments.at(-1).end = m.index;
      segments.push({ start: m.index + m[0].length, words: [] });
    } else segments.at(-1).words.push(m[0].replace(/^(["'])([\s\S]*)\1$/, '$2'));
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

const GH = {
  create: ['pr', 'PR body'],
  edit: ['pr', 'PR body'],
  comment: ['comment', 'PR comment'],
  review: ['review', 'review body'],
};
const commandKind = (words) => {
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i] === 'git' && words[i + 1] === 'commit') return ['commit', 'commit message'];
    if (words[i] === 'gh' && words[i + 1] === 'pr' && GH[words[i + 2]]) return GH[words[i + 2]];
  }
  return null;
};

// Files an agent reads rather than a person: memory, plans and instruction files. Their
// house style (an em dash per index line, for one) is not slop.
const AGENT_FACING =
  /(?:^|[\\/])\.(?:claude|copilot)[\\/]|(?:^|[\\/])(?:CLAUDE|AGENTS|copilot-instructions)\.md$/i;

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
  if (tool === 'Bash' && typeof command === 'string') {
    return parse(command).flatMap(({ text, words }) => {
      const found = commandKind(words);
      if (!found) return [];
      const [kind, name] = found;
      const msg = messageFile(words, payload.cwd);
      return [msg ? { kind, name: `${name} (${msg.file})`, text: msg.text } : { kind, name, text }];
    });
  }
  return [];
};

export const message = (t, hits) =>
  [
    `writeup:unslop flagged ${hits.length} pattern${hits.length === 1 ? '' : 's'} in ${t.edit ? 'an edit to ' : ''}${t.name}:`,
    ...hits
      .slice(0, MAX_SHOWN)
      .map((h) => `- rule ${h.id} "${h.match}" (line ${h.line}${t.edit ? ' of the edit' : ''})`),
    ...(hits.length > MAX_SHOWN ? [`- and ${hits.length - MAX_SHOWN} more`] : []),
    ENDING[t.kind],
  ].join('\n');

// Imported by the test, run by the hook; a name check survives symlinked and junctioned roots.
if (basename(process.argv[1] ?? '') === 'scan.mjs') {
  try {
    const payload = JSON.parse((await readText(process.stdin)) || '{}');
    const blocks = targets(payload).flatMap((t) => {
      const hits = findSlop(t.text);
      return hits.length ? [message(t, hits)] : [];
    });
    if (blocks.length) process.stdout.write(context('PostToolUse', blocks.join('\n\n')));
  } catch {
    // fail open: never block a tool on a reflective hook
  }
}
