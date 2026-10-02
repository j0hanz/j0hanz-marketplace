import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { text as readText } from 'node:stream/consumers';
import { context, toolInput, toolName } from './client.mjs';

const LIST_OR_HEADING = /^\s*(?:#{1,6}|[-*+]|\d+[.)])\s/;
const rule = (id, label, pattern) => ({ id, label, pattern });

export const RULES = [
  // Verb forms only for enhance/underscore: "enhancement" is a tracker label and "an
  // underscore" is a character, both common in code docs.
  rule(
    7,
    'AI vocabulary',
    /\b(?:additionally|crucial\w*|delv\w*|enduring|enhanc(?:e[sd]?|ing)|foster\w*|garner\w*|interplay\w*|intricate\w*|landscape\w*|pivotal\w*|showcas(?:es|ed|ing)|tapestr\w*|testament\w*|underscor(?:es?\s+(?:the|how|that|why)|ed|ing)|vibrant\w*)\b/gi,
  ),
  rule(13, 'em dash', /—/g),
  // Case-sensitive; findSlop also requires 3+ capitalized words in the heading text.
  rule(17, 'title case heading', /^#{1,6} (.+)$/),
  // Headings and list items only; the PR attribution footer is prose and stays quiet.
  { ...rule(18, 'emoji', /\p{Extended_Pictographic}/gu), line: (l) => LIST_OR_HEADING.test(l) },
  rule(19, 'curly quotes', /[“‘][^“”‘’\n]*[”’]|[“”‘’]/g),
  rule(
    20,
    'chatbot phrase',
    /I hope this helps|let me know if|\bof course!|\bcertainly!|smoking gun/gi,
  ),
  rule(
    23,
    'filler phrase',
    /\bin order to\b|\bdue to the fact that\b|\bit is important to note\b/gi,
  ),
  rule(31, 'fancy word', /\b(?:utiliz\w*|leverag\w*|facilitat\w*|numerous|in the event that)\b/gi),
];

const blank = (s) => s.replace(/[^\r\n]/g, ' ');

// Fenced blocks (unclosed runs to the end) and inline spans become spaces; newlines stay.
export const stripCode = (text) =>
  text.replace(/(```|~~~)[\s\S]*?(?:\1|$)/g, blank).replace(/(`+)[^\r\n]*?\1/g, blank);

const isTitleCase = (heading) =>
  heading.split(/\s+/).filter((w) => /^[A-Z][a-z]{3,}/.test(w)).length >= 3;

export const findSlop = (text) =>
  stripCode(text)
    .split(/\r?\n/)
    .flatMap((line, i) =>
      RULES.flatMap(({ id, pattern, line: applies }) => {
        if (applies && !applies(line)) return [];
        if (id === 17) {
          const m = line.match(pattern);
          return m && isTitleCase(m[1]) ? [{ id, match: m[1], line: i + 1 }] : [];
        }
        return [...line.matchAll(pattern)].map((m) => ({ id, match: m[0], line: i + 1 }));
      }),
    )
    .sort((a, b) => a.line - b.line || a.id - b.id);

const MAX_SHOWN = 20;
const ENDING = {
  file: 'Rewrite these lines.',
  commit: 'Amend the commit if it is not pushed.',
  pr: 'Update the PR body with `gh pr edit`.',
  comment: 'Edit the comment with `gh pr comment --edit-last`.',
  review: 'Post the correction with `gh pr comment`.',
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
const GH_NAME = {
  create: 'PR body',
  edit: 'PR body',
  comment: 'PR comment',
  review: 'review body',
};
const GH_KIND = { create: 'pr', edit: 'pr', comment: 'comment', review: 'review' };

// Files an agent reads rather than a person: memory, plans and instruction files. Their
// house style (an em dash per index line, for one) is not slop.
const AGENT_FACING =
  /(?:^|\/)\.(?:claude|copilot)\/|(?:^|\/)(?:CLAUDE|AGENTS|copilot-instructions)\.md$/i;

export const target = (payload) => {
  const tool = toolName(payload);
  const { filePath, written, replacement, command } = toolInput(payload);
  if (tool === 'Write' || tool === 'Edit') {
    const path = String(filePath ?? '');
    const norm = path.replace(/\\/g, '/');
    const text = written ?? replacement;
    if (
      !/\.mdx?$/i.test(path) ||
      /node_modules\/|skills\/unslop\//.test(norm) ||
      AGENT_FACING.test(norm) ||
      typeof text !== 'string'
    )
      return null;
    return { kind: 'file', name: path, text, edit: tool === 'Edit' };
  }
  if (tool === 'Bash' && typeof command === 'string') {
    const isCommit = /\bgit\s+commit(?![-\w])/.test(command);
    const gh = isCommit ? null : command.match(GH_PR);
    if (!isCommit && !gh) return null;
    const kind = isCommit ? 'commit' : GH_KIND[gh[1]];
    const name = isCommit ? 'commit message' : GH_NAME[gh[1]];
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
