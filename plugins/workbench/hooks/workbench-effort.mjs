import { readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { text } from 'node:stream/consumers';

const PREFIX = 'workbench:';
const EFFORT_DIR = /^\d{4}-\d{2}-\d{2}-/;
const ARTIFACT = /^(.+)\.([a-z][a-z-]*)\.md$/;
const CHAIN = ['spec', 'plan', 'run', 'verify'];

let event = '';
const emit = (message) =>
  process.stdout.write(
    event === 'PreToolUse'
      ? JSON.stringify({
          hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: message },
        })
      : message,
  );

try {
  const payload = JSON.parse((await text(process.stdin)) || '{}');
  event = String(payload.hook_event_name ?? '');
  const invoked = String(payload.tool_input?.skill ?? payload.command_name ?? '')
    .trim()
    .replace(/^\//, '');
  const mine =
    invoked.startsWith(PREFIX) ||
    (event === 'UserPromptExpansion' &&
      existsSync(new URL(`../skills/${invoked}/SKILL.md`, import.meta.url)));
  if (!mine) process.exit(0);
  const root = join(process.env.CLAUDE_PROJECT_DIR || payload.cwd || process.cwd(), 'docs', 'plan');
  const entries = existsSync(root) ? readdirSync(root, { withFileTypes: true }) : [];
  const efforts = entries
    .filter((entry) => entry.isDirectory() && EFFORT_DIR.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const loose = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.md')).length;
  const lines = [];
  if (efforts.length === 0) {
    lines.push(
      'workbench effort directory: none under docs/plan/',
      '  convention: docs/plan/YYYY-MM-DD-<name>/ holds <name>.spec.md, <name>.plan.md, <name>.run.md, <name>.verify.md',
    );
  } else {
    const touched = (dir) => {
      try {
        return readdirSync(join(root, dir))
          .filter((file) => file.endsWith('.md'))
          .reduce((newest, file) => Math.max(newest, statSync(join(root, dir, file)).mtimeMs), 0);
      } catch {
        return 0;
      }
    };
    const live = efforts
      .map((dir) => [dir, touched(dir)])
      .reduce((best, pair) => (pair[1] >= best[1] ? pair : best))[0];
    const files = readdirSync(join(root, live))
      .filter((file) => file.endsWith('.md'))
      .sort();
    const byStem = new Map();
    for (const file of files) {
      const match = file.match(ARTIFACT);
      if (!match) continue;
      const kinds = byStem.get(match[1]) ?? new Set();
      kinds.add(match[2]);
      byStem.set(match[1], kinds);
    }
    lines.push(`workbench effort directory: docs/plan/${live}/`);
    for (const [stem, kinds] of byStem) {
      const has = [
        ...CHAIN.filter((stage) => kinds.has(stage)),
        ...[...kinds].filter((stage) => !CHAIN.includes(stage)).sort(),
      ];
      const started = CHAIN.some((stage) => kinds.has(stage));
      const missing = started ? CHAIN.filter((stage) => !kinds.has(stage)) : [];
      lines.push(
        `  stem \`${stem}\`: ${has.join(', ')}${missing.length > 0 ? ` — no ${missing.join(', ')}` : ''}`,
      );
    }
    const other = files.filter((file) => !ARTIFACT.test(file));
    if (other.length > 0) lines.push(`  other: ${other.join(', ')}`);
    const ticketsDir = join(root, live, 'tickets');
    const tickets = existsSync(ticketsDir)
      ? readdirSync(ticketsDir).filter((file) => file.endsWith('.md')).length
      : 0;
    if (tickets > 0) lines.push(`  ${tickets} ticket${tickets === 1 ? '' : 's'}`);
    if (lines.length === 1) lines.push('  empty');
    const older = efforts.filter((dir) => dir !== live).reverse();
    if (older.length > 0) {
      const rest = older.length - 3;
      lines.push(
        `  other efforts: ${older.slice(0, 3).join(', ')}${rest > 0 ? ` (+${rest})` : ''}`,
      );
    }
  }
  if (loose > 0) {
    const s = loose === 1 ? '' : 's';
    lines.push(
      `  docs/plan/ holds ${loose} loose .md file${s} — artifacts belong in an effort directory`,
    );
  }
  emit(lines.join('\n'));
} catch (e) {
  const note = `workbench-effort hook: ${e?.message ?? e}`;
  process.stdout.write(JSON.stringify({ systemMessage: note }));
}
