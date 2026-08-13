import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { text } from 'node:stream/consumers';

const PREFIX = 'workbench:';
const EFFORT_DIR = /^\d{4}-\d{2}-\d{2}-/;
const ARTIFACT = /^(.+)\.(spec|plan|run|verify|map|hunt|test-plan|cases|regression)\.md$/;

let event = '';
try {
  const payload = JSON.parse((await text(process.stdin)) || '{}');
  event = String(payload.hook_event_name ?? '');
  const invoked = String(payload.tool_input?.skill ?? payload.command_name ?? '').trim();
  const prefixed = invoked.startsWith(PREFIX);
  if (event === 'PreToolUse' && !prefixed) process.exit(0);
  const skills = new Set(
    readdirSync(new URL('../skills/', import.meta.url), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  );
  if (!skills.has(prefixed ? invoked.slice(PREFIX.length) : invoked)) process.exit(0);
  const root = join(process.env.CLAUDE_PROJECT_DIR || payload.cwd || process.cwd(), 'docs', 'plan');
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch (e) {
    if (e?.code !== 'ENOENT') throw e;
    process.exit(0);
  }
  const efforts = entries
    .filter((entry) => entry.isDirectory() && EFFORT_DIR.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  if (efforts.length === 0) process.exit(0);
  const live = efforts[efforts.length - 1];
  const files = readdirSync(join(root, live))
    .filter((file) => file.endsWith('.md'))
    .sort();
  const stem = files.map((file) => file.match(ARTIFACT)?.[1]).find(Boolean);
  const lines = [`workbench effort directory: docs/plan/${live}/`];
  lines.push(
    files.length > 0
      ? `  holds ${files.join(', ')}${stem ? ` — stem \`${stem}\`` : ''}`
      : '  empty',
  );
  const older = efforts.length - 1;
  if (older > 0) {
    lines.push(`  ${older} older effort director${older === 1 ? 'y' : 'ies'}`);
  }
  const message = lines.join('\n');
  process.stdout.write(
    event === 'PreToolUse'
      ? JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            additionalContext: message,
          },
        })
      : message,
  );
} catch (e) {
  const note = `workbench-effort hook: ${e?.message ?? e}`;
  process.stdout.write(event === 'PreToolUse' ? JSON.stringify({ systemMessage: note }) : note);
  process.exit(0);
}
