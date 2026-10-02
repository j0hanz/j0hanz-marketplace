// fires:  PostToolUse on Write|Edit|Bash (Copilot: create|edit|bash|powershell). Any Bash
//         command that is not `git commit` or `gh pr create|edit|comment|review` exits silent.
// reads:  tool_input.{file_path,content,new_string} or .command; a -F/--body-file it names
// emits:  hookSpecificOutput.additionalContext (flat additionalContext on Copilot), or nothing
// fails:  any parse or read error -> exit 0, no output; never blocks
// verify: node hooks/scan.mjs < payload.json; echo $?   (plugins/writeup/test/scan.test.mjs)
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  { id: 18, pattern: /\p{Extended_Pictographic}/gu, line: (l) => LIST_OR_HEADING.test(l) },
  { id: 19, pattern: /[“‘][^“”‘’\n]*[”’]|[“”‘’]/g },
  { id: 20, pattern: /I hope this helps|let me know if|\bof course!|\bcertainly!|smoking gun/gi },
  { id: 23, pattern: /\bin order to\b|\bdue to the fact that\b|\bit is important to note\b/gi },
  { id: 31, pattern: /\b(?:utiliz\w*|leverag\w*|facilitat\w*|numerous|in the event that)\b/gi },
];

const blank = (s) => s.replace(/[^\r\n]/g, ' ');

// Fenced blocks (unclosed runs to the end) and inline spans become spaces; newlines stay.
export const stripCode = (text) =>
  text.replace(/(```|~~~)[\s\S]*?(?:\1|$)/g, blank).replace(/(`+)[^\r\n]*?\1/g, blank);

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

// `git commit -F msg.txt` and `gh pr create --body-file body.md` carry the prose in a file the
// command only names. Read it; `-` is stdin and stays unread.
const MESSAGE_FILE = /(?:^|\s)(?:-F|--file|--body-file)(?:=|\s+)("[^"]*"|'[^']*'|[^\s'"]+)/;
const messageFile = (command, cwd) => {
  const m = command.match(MESSAGE_FILE);
  if (!m) return null;
  const file = m[1].replace(/^(["'])(.*)\1$/, '$2');
  if (file === '-') return null;
  try {
    return { file, text: readFileSync(cwd ? resolve(cwd, file) : file, 'utf8') };
  } catch {
    return null;
  }
};

const GH_PR = /\bgh\s+pr\s+(create|edit|comment|review)\b/;
const GH = {
  create: ['pr', 'PR body'],
  edit: ['pr', 'PR body'],
  comment: ['comment', 'PR comment'],
  review: ['review', 'review body'],
};

// Files an agent reads rather than a person: memory, plans and instruction files. Their
// house style (an em dash per index line, for one) is not slop.
const AGENT_FACING =
  /(?:^|[\\/])\.(?:claude|copilot)[\\/]|(?:^|[\\/])(?:CLAUDE|AGENTS|copilot-instructions)\.md$/i;

export const target = (payload) => {
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
      return null;
    return { kind: 'file', name: path, text, edit: tool === 'Edit' };
  }
  if (tool === 'Bash' && typeof command === 'string') {
    const isCommit = /\bgit\s+commit(?![-\w])/.test(command);
    const gh = isCommit ? null : command.match(GH_PR);
    if (!isCommit && !gh) return null;
    const [kind, name] = isCommit ? ['commit', 'commit message'] : GH[gh[1]];
    const msg = messageFile(command, payload.cwd);
    return msg
      ? { kind, name: `${name} (${msg.file})`, text: msg.text }
      : { kind, name, text: command };
  }
  return null;
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const payload = JSON.parse((await readText(process.stdin)) || '{}');
    const t = target(payload);
    const hits = t ? findSlop(t.text) : [];
    if (hits.length) process.stdout.write(context('PostToolUse', message(t, hits)));
  } catch {
    // fail open: never block a tool on a reflective hook
  }
}
