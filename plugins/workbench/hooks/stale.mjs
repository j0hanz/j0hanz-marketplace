import { appendFileSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { text } from 'node:stream/consumers';
import { projectRoot } from './effort.mjs';

const SKIP = new Set(['node_modules', '.git', '.venv', '__pycache__']);
const CACHED = /[\\/]plugins[\\/]cache[\\/]/;

export const newest = (dir, depth = 0) => {
  if (depth > 8) return 0;
  let best = 0;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) best = Math.max(best, newest(path, depth + 1));
    else {
      try {
        best = Math.max(best, statSync(path).mtimeMs);
      } catch {}
    }
  }
  return best;
};

export const staleness = (pluginRoot, project) => {
  try {
    if (!pluginRoot || !CACHED.test(pluginRoot)) return null;
    let manifest;
    try {
      manifest = JSON.parse(
        readFileSync(join(pluginRoot, '.claude-plugin', 'plugin.json'), 'utf8'),
      );
    } catch {
      return null;
    }
    const name = manifest?.name;
    if (!name) return null;
    const source = join(project, 'plugins', name);
    try {
      if (!statSync(source).isDirectory()) return null;
    } catch {
      return null;
    }
    const sourceAt = newest(source);
    if (!(sourceAt > newest(pluginRoot))) return null;
    return [
      `plugins/${name}/ in this working tree is newer than the loaded copy.`,
      `Loaded: ${pluginRoot}, version ${manifest.version ?? 'unknown'}.`,
      `Skills, hooks and relative links in this session resolve from the loaded copy.`,
    ].join('\n');
  } catch {
    return null;
  }
};

if (import.meta.filename === process.argv[1]) {
  try {
    const payload = JSON.parse((await text(process.stdin)) || '{}');
    if (payload.stop_hook_active) process.exit(0);
    const said = payload.transcript_path ? `${payload.transcript_path}.workbench-stale` : null;
    if (said) {
      try {
        statSync(said);
        process.exit(0);
      } catch {}
      try {
        appendFileSync(said, 'checked\n');
      } catch {}
    }
    const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || dirname(import.meta.dirname);
    const note = staleness(pluginRoot, projectRoot(payload));
    if (!note) process.exit(0);
    process.stdout.write(JSON.stringify({ systemMessage: note }));
  } catch {
    process.exit(0);
  }
}
