// The CI-command parsers, shared by nothing yet and extracted from probe.mjs so
// they can be run by `node --test` — probe.mjs executes its whole body at import
// and exports nothing, so an indentation-sensitive block scanner living there is
// a parser no gate can reach.

const NOISE = /^(echo|cd|export|set|source|#|sleep|ls|cat|mkdir|true|pwd)\b/;
// Fetching dependencies is every repo's CI, not this repo's gate. RUNNER is what
// separates a declared script from a command that merely contains its name. `run`
// requires a preceding manager (npm/pnpm/yarn/bun), so `docker run test` is not the
// `test` script — bare `run` would match any runner.
const SETUP = /\b(install|sync|restore|fetch|download|checkout|login|setup)\b/;
// `ci` is the one setup word that is also a suffix every repo names a gate with:
// `\bci\b` matches `pnpm test:ci` and `make verify-ci` and hides the CI-only
// command the Gates section exists to surface. It is only setup after a manager.
const BARE_CI = /^(npm|yarn|pnpm|bun)\s+ci\b/;
const RUNNER =
  '(?:(?<=(?:npm|pnpm|yarn|bun)\\s)run|run-script|make|just|npm|pnpm|yarn|bun|npx|uv|poetry|cargo|go)\\s+';

function* blocks(text, anchor) {
  // A CRLF checkout is the default on Windows. Left in place, the trailing \r
  // defeats every `$` below and the file reads as having no commands at all.
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const m = anchor.exec(lines[i]);
    if (!m) continue;
    const indent = m[1].length;
    const body = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      if (!lines[j].trim()) continue;
      if (lines[j].length - lines[j].trimStart().length <= indent) break;
      body.push(lines[j]);
    }
    yield [m, body];
  }
}

// CircleCI's block form is a mapping, not a script: `command:` holds the shell and
// every sibling key is metadata. GitHub's `run: |` body is raw shell, where a line
// shaped `name:` does not start — so dropping these keys is safe for both.
const STEP_KEY =
  /^(command|name|shell|environment|working_directory|background|no_output_timeout|when):\s*(.*)$/;

function runSteps(text) {
  const out = [];
  // The dash belongs to the indent. Measured before it, `- run: |` sets a depth
  // two columns short of the step's own keys and swallows `env:` as a command.
  for (const [m, body] of blocks(text, /^(\s*(?:-\s+)?)run:\s*(.*)$/)) {
    const inline = m[2].trim();
    if (inline && !/^[|>]/.test(inline)) {
      out.push(inline);
      continue;
    }
    for (const line of body) {
      const key = STEP_KEY.exec(line.trim());
      if (!key) out.push(line.trim());
      else if (key[1] === 'command' && key[2] && !/^[|>]/.test(key[2])) out.push(key[2]);
    }
  }
  return out;
}

function scriptSteps(text) {
  const out = [];
  for (const [, body] of blocks(text, /^(\s*)(?:before_script|script|after_script):\s*$/)) {
    for (const line of body) {
      const item = /^\s*-\s+(.*)$/.exec(line);
      if (item) out.push(item[1].trim().replace(/^["']|["']$/g, ''));
    }
  }
  return out;
}

export { BARE_CI, NOISE, RUNNER, runSteps, scriptSteps, SETUP };
