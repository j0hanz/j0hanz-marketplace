import { text } from 'node:stream/consumers';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { ARTIFACT, CONVENTION, EFFORT_DIR, effortRoot, projectRoot, stemHome } from './effort.mjs';

const segmentsInside = (from, to) => {
  const rel = relative(from, to);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel) ? rel.split(/[\\/]/) : null;
};

const correctlyPlaced = (parts) =>
  EFFORT_DIR.test(parts[0]) &&
  (parts.length === 2 || (parts.length === 3 && parts[1] === 'tickets'));

const misplacement = (filePath, project) => {
  if (typeof filePath !== 'string' || !filePath) return null;
  const base = basename(filePath);
  const match = base.match(ARTIFACT);
  if (!match) return null;

  const abs = resolve(filePath);
  if (!segmentsInside(project, abs)) return null;

  const root = effortRoot(project);
  const parts = segmentsInside(root, abs);
  if (!parts) return null;
  if (correctlyPlaced(parts)) return null;

  const stem = match[1];
  const today = new Date().toLocaleDateString('en-CA');
  const corrected = join(root, stemHome(root, stem) ?? `${today}-${stem}`, base);

  const where = relative(project, corrected).replace(/\\/g, '/');
  return {
    corrected,
    reason:
      `A workbench artifact belongs in one dated effort directory, and this one is going ` +
      `outside every effort directory under docs/plan/. Convention: ${CONVENTION}. ` +
      `Write it to ${where} instead.`,
  };
};

if (import.meta.filename === process.argv[1]) {
  try {
    const payload = JSON.parse((await text(process.stdin)) || '{}');
    if (payload.tool_name !== 'Write') process.exit(0);
    const verdict = misplacement(payload.tool_input?.file_path, projectRoot(payload));
    if (!verdict) process.exit(0);
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: verdict.reason,
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
