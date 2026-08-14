import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { text } from 'node:stream/consumers';
import {
  ARTIFACT,
  CONVENTION,
  EFFORT_DIR,
  effortRoot,
  listEfforts,
  liveEffort,
  projectRoot,
} from './effort.mjs';

const PREFIX = 'workbench:';
const CHAIN = ['spec', 'plan', 'run', 'verify'];
// The stage a stem is missing names the skill that produces it, so state reads as a route.
const NEXT = { spec: 'write-specs', plan: 'write-plan', run: 'run-plan', verify: 'verify-specs' };

let event = '';
// UserPromptExpansion replaces the prompt text, so it takes the message raw; every other
// event carries it as context.
const emit = (message) =>
  process.stdout.write(
    event === 'UserPromptExpansion' || !event
      ? message
      : JSON.stringify({
          hookSpecificOutput: { hookEventName: event, additionalContext: message },
        }),
  );

try {
  const payload = JSON.parse((await text(process.stdin)) || '{}');
  event = String(payload.hook_event_name ?? '');
  const invoked = String(payload.tool_input?.skill ?? payload.command_name ?? '')
    .trim()
    .replace(/^\//, '');
  // On every prompt the brief lands before the skill choice, not after it — but only when
  // it has something to route. The silence gate below is what keeps that free.
  const mine =
    event === 'SessionStart' ||
    event === 'UserPromptSubmit' ||
    invoked.startsWith(PREFIX) ||
    (event === 'UserPromptExpansion' &&
      existsSync(new URL(`../skills/${invoked}/SKILL.md`, import.meta.url)));
  if (!mine) process.exit(0);
  const root = effortRoot(projectRoot(payload));
  const entries = existsSync(root) ? readdirSync(root, { withFileTypes: true }) : [];
  const efforts = listEfforts(root);
  // Only artifacts are misplaced here — a README.md under docs/plan/ is nobody's business.
  const loose = entries.filter((entry) => entry.isFile() && ARTIFACT.test(entry.name)).length;
  const strays = entries
    .filter((entry) => entry.isDirectory() && !EFFORT_DIR.test(entry.name))
    .map((entry) => entry.name);
  const lines = [];
  let incomplete = false;
  if (efforts.length === 0) {
    lines.push('workbench effort directory: none under docs/plan/', `  convention: ${CONVENTION}`);
  } else {
    const live = liveEffort(root, efforts);
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
      // Only stages past the furthest one reached are pending. A stage the route skipped on
      // purpose — diagnose bypasses spec — is behind, and routing back to it is wrong.
      const reached = CHAIN.reduce((best, stage, index) => (kinds.has(stage) ? index : best), -1);
      const missing =
        reached < 0 ? (kinds.has('diagnose') ? CHAIN.slice(1) : []) : CHAIN.slice(reached + 1);
      if (missing.length > 0) incomplete = true;
      lines.push(
        `  stem \`${stem}\`: ${has.join(', ')}${missing.length > 0 ? ` — no ${missing.join(', ')}; the ${NEXT[missing[0]]} skill produces the next one` : ''}`,
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
      `  docs/plan/ holds ${loose} loose artifact${s} — artifacts belong in an effort directory`,
    );
  }
  if (strays.length > 0) {
    lines.push(`  not a dated effort directory: ${strays.map((dir) => `${dir}/`).join(', ')}`);
  }
  // An unasked-for brief on every prompt is rent. Charge it only where there is a route to
  // name or a misplaced artifact to report; an explicit invocation always gets the state.
  if (event === 'UserPromptSubmit' && !incomplete && loose === 0 && strays.length === 0) {
    process.exit(0);
  }
  emit(lines.join('\n'));
} catch (e) {
  const note = `workbench brief hook: ${e?.message ?? e}`;
  process.stdout.write(JSON.stringify({ systemMessage: note }));
}
