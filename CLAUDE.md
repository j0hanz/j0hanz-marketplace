# j0hanz-marketplace

Dev workspace for plugin marketplace serving three clients: Claude Code, GitHub Copilot CLI, Antigravity CLI. Plugin source in `plugins/<name>/`; catalog `.claude-plugin/marketplace.json` lists every plugin, `.claude-plugin/plugin.json` in each folder holds its manifest. Read those two for what exists. `GLOSSARY.md` defines domain terms (Client, Plugin, Capability, Catalog, Mod, Gate, Advisory); use them in code, docs, commits.

## Every plugin stands alone

- Treat each plugin as independent product. Ships alone, versions alone, works with no other plugin present.
- Plugins here are source, not installed. Skill or hook running in your session comes from installed copy under `~/.claude/plugins/cache/`; editing `plugins/<name>/` changes nothing in running session.
- Several plugins overlap (e.g. `review` and `writeup`'s review skill, `css` and `frontend`). Keep separate: scope change to the one plugin named in task, leave look-alikes untouched.
- Plugin references only files inside own folder. Shared-looking files like `hooks/client.mjs` are per-plugin copies.

## Commands

```bash
npm run check        # lint + format:check + validate + typecheck + test — the pre-merge gate
npm test             # node --test over scripts/ and plugins/*/test/ *.test.mjs
npm run validate     # claude plugin validate --strict per plugin, Copilot and Antigravity checks, mod tests
npm run site:data    # rebuilds site/src/data/marketplace.json and README's generated regions
```

`typecheck`, `site:dev`, `site:build` chain `site:data`, which rewrites README's `<!-- install:start -->`, `<!-- copilot:start -->`, `<!-- antigravity:start -->`, `<!-- plugins:start -->` regions. Edit README outside those regions only.

No CI: `npm run check` is gate before change lands. `.githooks/pre-commit` formats staged files; enable once with `git config core.hooksPath .githooks`.

## Adding a plugin

1. Create `plugins/<name>/.claude-plugin/plugin.json` with `name`, `version`, `description`.
2. Add catalog entry with `name`, `source: "./plugins/<name>"`, `description`, `category`.
3. Nothing to do under Copilot (mod, or Claude Code-only features): add `"tags": ["claude-code-only"]`.
4. Otherwise, for Antigravity: add `.antigravity-plugin/plugin.json` with matching `name`, `version`, `description` (see Antigravity below).
5. Run `npm run check`; regenerates README, validates every client.

## Releases

Run `/version-bump`. One release bumps one plugin's `version` in its `.claude-plugin/plugin.json` (plus Antigravity manifest if present) and commits that alone. Catalog and README carry no version.

## Hooks across clients

- Hooks read payload and write answer through plugin's `hooks/client.mjs`, kept identical across plugins by `npm run validate`. Copilot sends own tool names (`create`, `edit`) and arg names (`path`, `file_text`, `new_str`), takes flat `additionalContext` / `permissionDecision` fields instead of `hookSpecificOutput`. `COPILOT_PLUGIN_ROOT` set only under Copilot. Claude Code output stays unchanged.
- Under Copilot, hook stdout is one JSON document; plain text dropped. `PreToolUse` hook that crashes or exits non-zero denies tool.
- Tool matchers name both spellings (`Write|Edit|create|edit`, `Skill|skill`); `SessionStart` matchers include Copilot's `new`. Every `node` hook `command` has `powershell` twin using `$env:CLAUDE_PLUGIN_ROOT`.
- `SKILL.md` and agent frontmatter are strict YAML: quote `description` containing `:`.

## Antigravity CLI

- Plugin is on Antigravity when it carries `.antigravity-plugin/plugin.json`; site and README derive its `agy plugin install <GitHub folder>` line from that file alone. `claude-code-only` plugin has none.
- Antigravity shares `skills/` and `agents/`, but reads hooks from root `hooks.json` and MCP servers from root `mcp_config.json`, each own schema; ignores `hooks/hooks.json` and `.mcp.json`. Plugin with hooks, MCP servers or agent `tools` lists gets manifest once those ported to that schema (`frontend` and `writeup` show hook port, `filesystem-mcp` the MCP one). Contract: `plans/014-antigravity-cli-support.md`.
- Keep `SKILL.md` under 24 KB, its `name` matching its folder.

## Mods

- Mod = plugin whose `hooks/hooks.json` names TypeScript hooks module (`"modules": ["./register.tsx"]`). Copilot does not run mods, so mod carries `claude-code-only` tag.
- Mod tests are `*.test.ts` under plugin, run by `claude plugin test` from `npm run validate`; root `npm test` collects only `*.test.mjs`.
- Loading mod with `--plugin-dir` lays `.claude-plugin/types/` (gitignored) for editor; goes stale as Claude Code updates. `npm run validate` typechecks mods against installed engine.

## Site and scripts

`site/` is landing page (React, Vite, MUI, deployed on Vercel), built from catalog by `scripts/build-site-data.mjs`. `scripts/validate.mjs` and `scripts/skill-lint.mjs` implement `npm run validate`.

## Commits

Use conventional subjects (`feat`, `fix`, `refactor`, `chore`, …), scoped to plugin or file when it helps.
