# j0hanz-marketplace

A Claude Code plugin marketplace. `.claude-plugin/marketplace.json` catalogs the plugins under `plugins/`; each plugin is self-contained. Layout and install flow: README.md.

## Commands

Node tooling is one root `package.json`. Run every script from the repo root; plugins have no manifests of their own. `npm run check` is the full pipeline.

Python tooling is ruff, configured at the repo root: `ruff check .`

After changing a manifest or any component, run `npm run validate`. It reads the catalog, so it covers the marketplace and every plugin listed in it without being told about new ones.

## Conventions

A plugin's identity is three values that must agree: its directory name, `name` in its `plugin.json`, and `name` in its marketplace entry. Renaming means changing all three.

Plugin names are one lowercase word, contain no "claude", and differ from every skill the plugin ships — invocation reads `<plugin>:<skill>`.

Set `version` in `plugin.json` only. A `version` in the marketplace entry as well is silently ignored.

Address plugin-internal paths from hooks and scripts through `${CLAUDE_PLUGIN_ROOT}`. Installation copies a plugin into a cache, so any path reaching outside its own directory stops resolving.

New skills go in `skills/<name>/SKILL.md`, new agents in `agents/<name>.md`. `commands/` is the legacy flat-file form; do not add to it.

Keep `plugins/` free of nested git repositories. A vendored `.git` turns the directory into a gitlink and none of the plugin's files get committed.

## Schemas

Manifest, skill, agent, and hook schemas evolve. Read <https://code.claude.com/docs/en/plugin-marketplaces> and <https://code.claude.com/docs/en/plugins-reference> rather than recalling field names.
