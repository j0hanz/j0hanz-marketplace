import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatState, readCourse, renderIndex } from '../skills/teach/course.mjs';

let tmp;
let full;
let empty;

const put = (root, rel, text = '') => {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
};
const crlf = (lines) => lines.join('\r\n') + '\r\n';
const REVIEWED = new Date('2026-11-19T12:00:00Z');
const NOW = Date.parse('2026-11-24T12:00:00Z');

before(() => {
  tmp = mkdtempSync(join(tmpdir(), 'tutor-'));
  full = join(tmp, 'my course', 'full');
  empty = join(tmp, 'my course', 'empty');
  mkdirSync(empty, { recursive: true });
  put(
    full,
    'MISSION.md',
    crlf([
      '# Mission: Rust ownership',
      '',
      '## Why',
      'Stop fighting the borrow',
      'checker at work.',
      '',
      '## Success looks like',
      '- x',
    ]),
  );
  put(
    full,
    'GLOSSARY.md',
    crlf([
      '# Rust Glossary',
      '',
      '## Terms',
      '',
      '**Move**:',
      'Transfer of **ownership** to a new binding.',
      '_Avoid_: Copy',
      '',
      '## Borrowing',
      '',
      '**Borrow**:',
      'A reference that uses a value without owning it.',
    ]),
  );
  put(full, 'NOTES.md', 'notes');
  put(full, 'RESOURCES.md', 'resources');
  put(
    full,
    'lessons/0001-moves.html',
    '<title>Moves &amp; copies</title><meta name="description" content="Who owns a value after let b = a">',
  );
  put(full, 'lessons/0002-review-moves.html', '<title>Review: moves</title>');
  put(full, 'lessons/0003-borrowing.html', '<title>Borrowing <rules></title>');
  put(full, 'lessons/draft.html', '<title>Draft</title>');
  put(full, 'lessons/0004-x.HTML', '<title>X</title>');
  put(
    full,
    'learning-records/0001-moves.md',
    '---\nstatus: superseded by LR-0002\n---\n# Moves transfer ownership\n',
  );
  put(full, 'learning-records/0002-moves-deeper.md', '# Moves include function arguments\n');
  put(full, 'reference/cheatsheet.html', '<title>Ownership cheat sheet</title>');
  put(full, 'assets/style.css');
  put(full, 'assets/quiz.js');
  utimesSync(join(full, 'lessons/0002-review-moves.html'), REVIEWED, REVIEWED);
});

after(() => rmSync(tmp, { recursive: true, force: true }));

test('readCourse parses the full fixture', () => {
  const c = readCourse(full);
  assert.equal(c.topic, 'Rust ownership');
  assert.equal(c.why, 'Stop fighting the borrow checker at work.');
  assert.deepEqual(
    c.lessons.map((l) => l.file),
    ['lessons/0001-moves.html', 'lessons/0002-review-moves.html', 'lessons/0003-borrowing.html'],
  );
  assert.equal(c.lessons[0].title, 'Moves & copies');
  assert.equal(c.lessons[0].summary, 'Who owns a value after let b = a');
  assert.equal(c.lessons[1].review, true);
  assert.equal(c.lessons[1].summary, '');
  assert.deepEqual(
    c.records.map((r) => r.superseded),
    [true, false],
  );
  assert.deepEqual(c.glossary, [
    {
      group: null,
      term: 'Move',
      definition: 'Transfer of **ownership** to a new binding.',
      avoid: 'Copy',
    },
    {
      group: 'Borrowing',
      term: 'Borrow',
      definition: 'A reference that uses a value without owning it.',
      avoid: null,
    },
  ]);
  assert.deepEqual(c.assets, ['quiz.js', 'style.css']);
});

test('formatState reports the full fixture', () => {
  const lines = formatState(readCourse(full), NOW).split('\n');
  assert.ok(lines.includes('mission: Rust ownership: Stop fighting the borrow checker at work.'));
  assert.ok(lines.includes('lessons: 3, last 0003-borrowing "Borrowing <rules>", next 0004'));
  assert.ok(lines.includes('review: last 0002-review-moves, 1 lesson since, 5 days ago'));
  assert.ok(
    lines.includes(
      'records: 2, last 0002-moves-deeper "Moves include function arguments", next 0003',
    ),
  );
  assert.ok(lines.includes('superseded: 0001-moves'));
  assert.ok(lines.includes('references: 1 (reference/cheatsheet.html)'));
  assert.ok(lines.includes('glossary: 2 terms'));
  assert.ok(lines.includes('assets: quiz.js, style.css'));
});

test('formatState on an empty folder', () => {
  const text = formatState(readCourse(empty));
  for (const line of [
    'mission: missing',
    'lessons: 0, next 0001',
    'review: none yet, 0 lessons',
    'records: 0, next 0001',
    'references: 0',
    'glossary: missing',
    'resources: missing',
    'notes: missing',
  ]) {
    assert.ok(text.split('\n').includes(line), line);
  }
  assert.match(text, /^assets: missing; starters in .+\/skills\/teach\/assets$/m);
  assert.doesNotMatch(text, /superseded:/);
});

test('renderIndex builds the course home', () => {
  const html = renderIndex(readCourse(full));
  assert.match(html, /<link rel="stylesheet" href="assets\/style.css"/);
  assert.match(html, /<p class="mission">Stop fighting the borrow checker at work.<\/p>/);
  assert.match(html, /class="continue"[\s\S]*href="lessons\/0003-borrowing.html"/);
  assert.ok(html.includes('Borrowing &lt;rules&gt;'));
  assert.ok(html.includes('Moves &amp; copies'));
  assert.ok(!html.includes('&amp;amp;'));
  assert.equal((html.match(/class="tag"/g) ?? []).length, 1);
  assert.ok(html.includes('Transfer of <strong>ownership</strong> to a new binding.'));
  assert.ok(html.includes('<span class="avoid">Avoid: Copy</span>'));
  assert.ok(html.includes('<h3>Borrowing</h3>'));
  assert.ok(html.includes('href="reference/cheatsheet.html"'));
  assert.ok(!html.includes('draft.html'));
});

test('renderIndex on an empty folder', () => {
  const html = renderIndex(readCourse(empty));
  assert.ok(html.includes('No lessons yet.'));
  assert.ok(!html.includes('class="continue"'));
  assert.ok(!html.includes('id="glossary"'));
  assert.ok(!html.includes('class="mission"'));
});

test('CLI: index writes the page, state exits 0, bad input exits non-zero', () => {
  const cli = fileURLToPath(new URL('../skills/teach/course.mjs', import.meta.url));
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  const wrote = run('index', full);
  assert.equal(wrote.status, 0);
  assert.match(wrote.stdout, /^wrote .+index\.html/);
  assert.ok(existsSync(join(full, 'index.html')));
  assert.equal(run('state', full).status, 0);
  assert.equal(run('bogus').status, 2);
  assert.equal(run('state', join(full, 'nope')).status, 1);
});

test('renderIndex keeps code spans and snake_case words intact in the glossary', () => {
  const def = (definition) => ({ group: null, term: 'T', definition, avoid: null });
  const html = renderIndex({
    topic: 'T',
    why: null,
    lessons: [],
    references: [],
    glossary: [
      def('Listed by `list_roots` and `search_text`.'),
      def('Field read_file and write_file share.'),
      def('An _important_ rule.'),
      def('Use `a < b` with **care**.'),
    ],
  });
  assert.ok(
    html.includes('<dd>Listed by <code>list_roots</code> and <code>search_text</code>.</dd>'),
  );
  assert.ok(html.includes('<dd>Field read_file and write_file share.</dd>'));
  assert.ok(html.includes('<dd>An <em>important</em> rule.</dd>'));
  assert.ok(html.includes('<dd>Use <code>a &lt; b</code> with <strong>care</strong>.</dd>'));
});
