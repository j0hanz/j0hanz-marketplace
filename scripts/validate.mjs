// Validates the marketplace catalog and every plugin it lists.
// Reads the catalog rather than a hardcoded list, so new plugins are covered
// the moment they get an entry.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const { plugins } = JSON.parse(readFileSync('.claude-plugin/marketplace.json', 'utf8'));

const targets = ['.', ...plugins.map((p) => p.source).filter((s) => typeof s === 'string')];

let failed = 0;
for (const target of targets) {
  // shell: true — `claude` is a .cmd shim on Windows.
  const { status } = spawnSync('claude', ['plugin', 'validate', target, '--strict'], {
    stdio: 'inherit',
    shell: true,
  });
  if (status !== 0) failed++;
}

process.exit(failed ? 1 : 0);
