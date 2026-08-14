import assert from 'node:assert/strict';
import test from 'node:test';
import { BARE_CI, NOISE, runSteps, scriptSteps, SETUP } from '../lib/ci.mjs';

// What the Gates section calls setup — everything else earns a `← not declared`
// mark when no declared command runs it.
const setup = (cmd) => SETUP.test(cmd) || BARE_CI.test(cmd);

const ACTIONS = [
  'jobs:',
  '  build:',
  '    steps:',
  '      - uses: actions/checkout@v4',
  '      - run: npm ci',
  '      - run: npm test',
  '      - name: lint and build',
  '        run: |',
  '          npm run lint',
  '          npm run build',
  '        env:',
  '          CI: true',
].join('\n');

test('an inline run step is one command', () => {
  const got = runSteps(ACTIONS);
  assert.ok(got.includes('npm ci'));
  assert.ok(got.includes('npm test'));
});

test('a run block contributes one command per line', () => {
  const got = runSteps(ACTIONS);
  assert.ok(got.includes('npm run lint'));
  assert.ok(got.includes('npm run build'));
});

test('a sibling key at the step depth is not a command', () => {
  // `- run: |` measures its indent including the dash, so `env:` and its body sit
  // at or above the step's own depth and end the block.
  const got = runSteps(ACTIONS);
  assert.ok(!got.some((cmd) => cmd.startsWith('env')));
  assert.ok(!got.includes('CI: true'));
});

test('a CRLF checkout parses identically to LF', () =>
  assert.deepEqual(runSteps(ACTIONS.replace(/\n/g, '\r\n')), runSteps(ACTIONS)));

const CIRCLE = [
  'jobs:',
  '  build:',
  '    steps:',
  '      - checkout',
  '      - run: npm run lint',
  '      - run:',
  '          name: unit',
  '          command: npm run coverage',
].join('\n');

test('a circleci block step yields its command, not its metadata', () =>
  assert.deepEqual(runSteps(CIRCLE), ['npm run lint', 'npm run coverage']));

test('a shell line shaped like a mapping key survives a github run block', () => {
  // GitHub's `run: |` body is raw shell — the key filter must not eat it.
  const yaml = [
    '    steps:',
    '      - run: |',
    '          echo name: x',
    '          npm test',
  ].join('\n');
  assert.deepEqual(runSteps(yaml), ['echo name: x', 'npm test']);
});

const GITLAB = [
  'test:',
  '  before_script:',
  '    - npm ci',
  '  script:',
  '    - "npm run lint"',
  '    - npm test',
  'stages:',
  '  - test',
].join('\n');

test('gitlab script items are commands, quotes stripped', () =>
  assert.deepEqual(scriptSteps(GITLAB), ['npm ci', 'npm run lint', 'npm test']));

test('a list outside a script key is not a command', () =>
  assert.ok(!scriptSteps(GITLAB).includes('test')));

test('noise is the shell plumbing every repo runs', () => {
  assert.ok(NOISE.test('cd build'));
  assert.ok(NOISE.test('echo done'));
  assert.ok(!NOISE.test('npm test'));
});

test('dependency fetching is setup, not a gate', () => {
  assert.ok(setup('npm ci'));
  assert.ok(setup('uv sync'));
  assert.ok(setup('actions/checkout@v4'));
  assert.ok(!setup('npm test'));
});

test('a script whose name ends in ci is a gate, not setup', () => {
  assert.ok(!setup('pnpm test:ci'));
  assert.ok(!setup('make verify-ci'));
  assert.ok(!setup('npm run build:ci'));
});

test('bare ci belongs to a package manager, not to any word', () => {
  assert.ok(BARE_CI.test('npm ci'));
  assert.ok(BARE_CI.test('yarn ci'));
  assert.ok(!BARE_CI.test('pnpm test:ci'));
  assert.ok(!BARE_CI.test('npm run ci'));
});
