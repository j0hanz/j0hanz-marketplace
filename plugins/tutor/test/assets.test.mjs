import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../skills/teach/assets');
const css = readFileSync(join(dir, 'style.css'), 'utf8');
const js = readFileSync(join(dir, 'quiz.js'), 'utf8');

test('stylesheet styles every contract selector and stays offline', () => {
  for (const sel of [
    'body.home',
    '.mission',
    '.continue .card',
    '.num',
    'ol.lessons',
    'ul.references',
    '.tag',
    'dl.glossary',
    '.avoid',
    'nav.crumbs',
    '.win',
    '.source',
    '.ask',
    'form.quiz',
    '.feedback',
    '.correct',
    '.wrong',
    '.answer',
    '.picked',
    '.score',
    '.prereq',
    'details.solution',
    '.recap',
    '.next',
  ]) {
    assert.ok(css.includes(sel), sel);
  }
  assert.match(css, /prefers-color-scheme:\s*dark/);
  assert.match(css, /@media print/);
  assert.doesNotMatch(css, /@import|url\(\s*['"]?https?:/);
});

test('quiz widget is a classic script', () => {
  assert.doesNotMatch(js, /^\s*(import|export)\s/m);
  assert.ok(js.includes('data-answer') || js.includes('dataset.answer'));
  assert.ok(js.includes('Try again'));
});
