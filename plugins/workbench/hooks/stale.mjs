import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { text } from 'node:stream/consumers';
import { projectRoot } from './effort.mjs';

const SKIP = new Set(['node_modules', '.git', '.venv', '__pycache__']);
const CACHED = /[\\/]plugins[\\/]cache[\\/]/;
const MAX_DEPTH = 8;

const slug = (v) => String(v ?? 'main').replace(/[^\w-]/g, '_');

const newestMtime = (dir, depth = 0) => {
  if (depth > MAX_DEPTH) return 0;
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
    if (entry.isDirectory()) best = Math.max(best, newestMtime(path, depth + 1));
    else {
      try {
        best = Math.max(best, statSync(path).mtimeMs);
      } catch {}
    }
  }
  return best;
};

const stalenessNote = (pluginRoot, project) => {
  if (!pluginRoot || !CACHED.test(pluginRoot)) return null;
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(pluginRoot, '.claude-plugin', 'plugin.json'), 'utf8'));
  } catch {
    return null;
  }
  const name = manifest?.name;
  if (typeof name !== 'string' || !name) return null;
  const source = join(project, 'plugins', name);
  try {
    if (!statSync(source).isDirectory()) return null;
  } catch {
    return null;
  }
  const sourceAt = newestMtime(source);
  const loadedAt = newestMtime(pluginRoot);
  if (sourceAt <= loadedAt) return null;
  return [
    `plugins/${name}/ in this working tree is newer than the loaded copy.`,
    `Loaded: ${pluginRoot}, version ${manifest.version ?? 'unknown'}.`,
    'Skills, hooks and relative links in this session resolve from the loaded copy.',
  ].join('\n');
};

if (import.meta.filename === process.argv[1]) {
  try {
    const payload = JSON.parse((await text(process.stdin)) || '{}');
    if (payload.stop_hook_active) process.exit(0);
    const marker = join(tmpdir(), `workbench-stale-${slug(payload.session_id)}.txt`);
    if (existsSync(marker)) process.exit(0);
    const note = stalenessNote(process.env.CLAUDE_PLUGIN_ROOT, projectRoot(payload));
    if (!note) process.exit(0);
    try {
      writeFileSync(marker, 'warned\n');
    } catch {}
    process.stdout.write(JSON.stringify({ systemMessage: note }));
  } catch {
    process.exit(0);
  }
}
