import { text } from 'node:stream/consumers';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { ARTIFACT, EFFORT_DIR, effortRoot, listEfforts, liveEffort } from './effort.mjs';

const segmentsInside = (from, to) => {
  const rel = relative(from, to);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel) ? rel.split(/[\\/]/) : null;
};

const ALLOWED_SUBDIRS = new Set(['tickets']);

const correctlyPlaced = (parts) =>
  EFFORT_DIR.test(parts[0]) &&
  (parts.length === 2 || (parts.length === 3 && ALLOWED_SUBDIRS.has(parts[1])));

export const classify = (filePath, root) => {
  try {
    if (!filePath) return null;
    const base = basename(filePath);
    const match = base.match(ARTIFACT);
    if (!match) return null;

    const abs = resolve(filePath);
    if (!segmentsInside(dirname(dirname(root)), abs)) return null;

    const parts = segmentsInside(root, abs);
    if (parts && correctlyPlaced(parts)) return null;

    const live = liveEffort(root, listEfforts(root));
    const dir = live ?? `${new Date().toISOString().slice(0, 10)}-${match[1]}`;
    const corrected = join(root, dir, base);
    if (resolve(corrected) === abs) return null;

    const where = live ? `the live effort directory docs/plan/${live}/` : `docs/plan/${dir}/`;
    return {
      corrected,
      reason:
        `A workbench artifact belongs in one dated effort directory, and this one is going ` +
        `outside every effort directory under docs/plan/. Convention: ` +
        `docs/plan/YYYY-MM-DD-<name>/ holds <name>.spec.md, <name>.plan.md, <name>.run.md, ` +
        `<name>.verify.md and the rest of the set. Approving this call writes it to ${where} ` +
        `instead; rejecting keeps the path as written.`,
    };
  } catch {
    return null;
  }
};

if (import.meta.filename === process.argv[1]) {
  try {
    const payload = JSON.parse((await text(process.stdin)) || '{}');
    if (payload.tool_name !== 'Write') process.exit(0);
    const input = payload.tool_input ?? {};
    const verdict = classify(input.file_path, effortRoot(payload));
    if (!verdict) process.exit(0);
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'escalate',
          permissionDecisionReason: verdict.reason,
          updatedInput: { ...input, file_path: verdict.corrected },
        },
      }),
    );
  } catch (e) {
    const why = String(e?.message ?? e).split('\n')[0];
    process.stdout.write(
      JSON.stringify({
        systemMessage: `workbench gate: check skipped (${why}). Writes are not being gated.`,
      }),
    );
  }
}
