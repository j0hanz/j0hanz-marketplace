import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { findSlop, stripCode, RULES } from '../hooks/scan.mjs';

test('each rule flags its sample', () => {
  const samples = {
    7: 'We delve into it.',
    13: 'Fast — and small.',
    17: '## Getting Started With Docker',
    18: 'Done 🎉',
    19: 'He said “hi”.',
    20: 'I hope this helps.',
    23: 'In order to run it.',
    31: 'We utilize caching.',
  };
  for (const [id, text] of Object.entries(samples))
    assert.deepEqual(
      findSlop(text).map((h) => h.id),
      [Number(id)],
      text,
    );
});
test('a lone curly quote is one hit', () => {
  assert.deepEqual(
    findSlop('it’s fine').map((h) => h.id),
    [19],
  );
});
test('clean prose has no hits', () => {
  assert.deepEqual(
    findSlop('The parser rejects a bad date and exits with code 2.\n## API reference'),
    [],
  );
});
test('inflections hit, lookalikes do not', () => {
  assert.equal(findSlop('It underscores and is leveraging.').length, 2);
  assert.deepEqual(findSlop('We deliver numeric results.'), []);
});
test('code is ignored and newlines survive', () => {
  const text = 'a\n```\ndelve — 🎉\n```\nuse `utilize()` here\nwe delve';
  assert.equal(stripCode(text).split('\n').length, text.split('\n').length);
  assert.deepEqual(findSlop(text), [{ id: 7, match: 'delve', line: 6 }]);
});
test('CRLF reports the same line numbers', () => {
  assert.deepEqual(findSlop('ok\r\nwe delve\r\n'), findSlop('ok\nwe delve\n'));
});
test('every rule id still exists in unslop', () => {
  const skill = readFileSync(new URL('../skills/unslop/SKILL.md', import.meta.url), 'utf8');
  for (const { id } of RULES)
    assert.match(skill, new RegExp(`^${id}\\. \\*\\*`, 'm'), `rule ${id}`);
});
