import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const EFFORT_DIR = /^\d{4}-\d{2}-\d{2}-/;

export const ARTIFACT =
  /^(.+)\.(test-plan|plan-hunt|spec-hunt|regression|diagnose|refactor|handoff|verify|cases|hunt|spec|plan|run|map)\.md$/;

export const projectRoot = (payload = {}) =>
  process.env.CLAUDE_PROJECT_DIR || payload.cwd || process.cwd();

export const effortRoot = (payload = {}) => join(projectRoot(payload), 'docs', 'plan');

export const listEfforts = (root) => {
  const entries = existsSync(root) ? readdirSync(root, { withFileTypes: true }) : [];
  return entries
    .filter((entry) => entry.isDirectory() && EFFORT_DIR.test(entry.name))
    .map((entry) => entry.name)
    .sort();
};

export const liveEffort = (root, efforts) => {
  if (efforts.length === 0) return null;
  const newestMtime = (dir) => {
    try {
      return readdirSync(join(root, dir))
        .filter((file) => file.endsWith('.md'))
        .reduce((newest, file) => Math.max(newest, statSync(join(root, dir, file)).mtimeMs), 0);
    } catch {
      return 0;
    }
  };
  return efforts
    .map((dir) => [dir, newestMtime(dir)])
    .reduce((best, pair) => (pair[1] >= best[1] ? pair : best))[0];
};
