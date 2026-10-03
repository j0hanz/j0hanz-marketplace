import { readdirSync, existsSync, readFileSync } from 'node:fs';
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
import { context, notice, onCopilot, toolInput } from './client.mjs';

const PREFIX = 'workbench:';
const CHAIN = ['spec', 'spec-hunt', 'plan', 'plan-hunt', 'run', 'verify'];
// A hunt reviews the stage before it, so it is pending only until the next stage lands.
const HUNT = new Set(['spec-hunt', 'plan-hunt']);
// The stage a stem is missing names the skill that produces it, so state reads as a route.
const NEXT = {
  spec: 'write-specs',
  'spec-hunt': 'spec-hunt',
  plan: 'write-plan',
  'plan-hunt': 'plan-hunt',
  run: 'run-plan',
  verify: 'verify-specs',
};
// Each hunt writes one status line into its report, and a re-hunt appends a section, so the
// last recognized line is the live verdict. A failing one sends the stem back to the author.
const STATUS = /^(?:\*\*)?Status:(?:\*\*)? (clean|gaps|dead steps)[ \t]*\r?$/gm;
const FAILED = { 'spec-hunt': 'gaps', 'plan-hunt': 'dead steps' };
const verdict = (file) => [...readFileSync(file, 'utf8').matchAll(STATUS)].at(-1)?.[1];
// write-plan lets a plan of at most two steps skip plan-hunt; the route names that skip
// instead of contradicting it.
const SKIP = {
  'plan-hunt': ' (or run-plan, where write-plan skipped the hunt for a plan of at most two steps)',
};

let event = '';
// UserPromptExpansion replaces the prompt text, so it takes the message raw; every other
// event carries it as context.
const emit = (message) =>
  process.stdout.write(
    event === 'UserPromptExpansion' || !event ? message : context(event, message),
  );

try {
  const payload = JSON.parse((await text(process.stdin)) || '{}');
  event = String(payload.hook_event_name ?? '');
  const invoked = String(toolInput(payload).skill ?? payload.command_name ?? '')
    .trim()
    .replace(/^\//, '');
  // On every prompt the brief lands before the skill choice, not after it — but only when
  // it has something to route. The silence gate below is what keeps that free.
  const mine =
    event === 'SessionStart' ||
    event === 'UserPromptSubmit' ||
    invoked.startsWith(PREFIX) ||
    // Copilot names plugin skills bare (`tdd`, not `workbench:tdd`), like an expansion does.
    ((event === 'UserPromptExpansion' || onCopilot()) &&
      /^[\w-]+$/.test(invoked) &&
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
      const missing = (
        reached < 0
          ? kinds.has('diagnose')
            ? CHAIN.slice(CHAIN.indexOf('plan'))
            : []
          : CHAIN.slice(reached + 1)
      )
        // verify-specs checks a run against its spec. A stem with no spec (a diagnose fix) has
        // nothing to verify, and run-plan never hands it there.
        .filter((stage) => stage !== 'verify' || kinds.has('spec'));
      if (missing.length > 0) incomplete = true;
      // Hunts are reviews, not deliverables: the route names them, the "no …" list does not.
      const owed = missing.filter((stage) => !HUNT.has(stage));
      const last = CHAIN[reached];
      const failed =
        HUNT.has(last) && verdict(join(root, live, `${stem}.${last}.md`)) === FAILED[last];
      const next = failed
        ? `${NEXT[CHAIN[reached - 1]]} skill to fix what ${last} found, then the ${last} skill again`
        : `${NEXT[missing[0]]} skill${SKIP[missing[0]] ?? ''}`;
      lines.push(
        `  stem \`${stem}\`: ${has.join(', ')}${
          missing.length > 0 ? ` — no ${owed.join(', ')}; next: the ${next}` : ''
        }`,
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
  notice(event, `workbench brief hook: ${e?.message ?? e}`);
}
