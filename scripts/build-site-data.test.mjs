// Guards the generated site data. Every assertion here is something that breaks the
// landing page silently: a plugin listed but unbuildable, a skill with no description, a
// slash command that does not exist.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import test from 'node:test';
import { build } from './build-site-data.mjs';

const site = build();
const catalog = JSON.parse(readFileSync('.claude-plugin/marketplace.json', 'utf8'));

test('every catalog entry resolves to a complete plugin', () => {
  assert.deepEqual(
    site.plugins.map((p) => p.name),
    catalog.plugins.map((p) => p.name),
  );
  for (const [i, plugin] of site.plugins.entries()) {
    const entry = catalog.plugins[i];
    // Directory name, plugin.json name and catalog name must agree, or installation breaks.
    assert.equal(plugin.name, basename(entry.source), `${plugin.name}: directory name disagrees`);
    assert.match(plugin.version, /^\d+\.\d+\.\d+/, `${plugin.name}: no version in plugin.json`);
    assert.ok(plugin.category, `${plugin.name}: no category in the catalog entry`);
    assert.ok(plugin.skills.length > 0, `${plugin.name}: no skills found`);
  }
});

test('skills carry a description and any command is namespaced', () => {
  for (const plugin of site.plugins) {
    for (const skill of plugin.skills) {
      assert.ok(skill.description, `${plugin.name}:${skill.name} has no description`);
      // A model-loaded skill has no command at all; the page keys off its absence.
      if ('command' in skill) {
        assert.equal(
          skill.command,
          `/${plugin.name}:${skill.name}`,
          `${plugin.name}:${skill.name} has the wrong command`,
        );
      }
    }
  }
});

test('totals and categories are derived from the plugins', () => {
  const skills = site.plugins.flatMap((p) => p.skills);
  assert.equal(site.totals.plugins, site.plugins.length);
  assert.equal(site.totals.skills, skills.length);
  assert.equal(
    site.totals.agents,
    site.plugins.reduce((n, p) => n + p.agents.length, 0),
  );
  assert.deepEqual(site.categories, [...new Set(site.plugins.map((p) => p.category))].sort());
});

test('install commands use the real repo slug and marketplace name', () => {
  assert.match(site.repo, /^[^/]+\/[^/]+$/);
  assert.equal(site.addCommand, `/plugin marketplace add ${site.repo}`);
  for (const plugin of site.plugins) {
    assert.equal(plugin.installCommand, `/plugin install ${plugin.name}@${site.name}`);
  }
});

test('no field is blank', () => {
  const blanks = (value, path) => {
    if (typeof value === 'string') return value.trim() ? [] : [path];
    if (Array.isArray(value)) return value.flatMap((v, i) => blanks(v, `${path}[${i}]`));
    if (value && typeof value === 'object') {
      return Object.entries(value).flatMap(([k, v]) => blanks(v, `${path}.${k}`));
    }
    return [];
  };
  assert.deepEqual(blanks(site, 'site'), []);
});
