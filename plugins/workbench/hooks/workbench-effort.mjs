import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const EFFORT_DIR = /^\d{4}-\d{2}-\d{2}-/;
const ARTIFACT = /^(.+)\.(spec|plan|run|verify|map|hunt|test-plan|cases|regression)\.md$/;

try {
  const payload = JSON.parse(readFileSync(0, 'utf8'));
  const invoked = String(payload.tool_input?.skill ?? payload.command_name ?? '').trim();
  const scoped = /^(?:workbench:)?(.+)$/.exec(invoked);
  if (!scoped) process.exit(0);

  const skills = new Set(
    readdirSync(new URL('../skills/', import.meta.url), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  );
  if (!skills.has(scoped[1])) process.exit(0);

  const root = join(process.env.CLAUDE_PROJECT_DIR ?? payload.cwd ?? process.cwd(), 'docs', 'plan');
  const efforts = readdirSync(root, { withFileTypes: true })
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
  const text = lines.join('\n');

  process.stdout.write(
    payload.hook_event_name === 'PreToolUse'
      ? JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            additionalContext: text,
          },
        })
      : text,
  );
} catch {
  process.exit(0);
}
