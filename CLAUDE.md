# j0hanz-marketplace

Development workspace for a plugin marketplace serving three clients: Claude Code, GitHub Copilot CLI and Antigravity CLI. Plugin source lives in `plugins/<name>/`; the catalog `.claude-plugin/marketplace.json` lists every plugin, and `.claude-plugin/plugin.json` inside each folder holds its manifest. Read those two for what exists. `GLOSSARY.md` defines the domain terms (Client, Plugin, Capability, Catalog, Mod, Gate, Advisory); use them in code, docs and commits.

## Every plugin stands alone

- Treat each plugin as an independent product. It ships on its own, versions on its own, and works with no other plugin present.
- Plugins here are source, not installed. A skill or hook running in your session comes from the installed copy under `~/.claude/plugins/cache/`; editing `plugins/<name>/` changes nothing in the running session.
- Several plugins cover similar ground (e.g. `review` and `writeup`'s review skill, `css` and `frontend`). Keep them separate: scope a change to the one plugin named in the task, and leave look-alikes untouched.
- A plugin references only files inside its own folder. Shared-looking files such as `hooks/client.mjs` are per-plugin copies.

## Commands

```bash
npm run check        # lint + format:check + validate + typecheck + test — the pre-merge gate
npm test             # node --test over scripts/ and plugins/*/test/ *.test.mjs
npm run validate     # claude plugin validate --strict per plugin, Copilot and Antigravity checks, mod tests
npm run site:data    # rebuilds site/src/data/marketplace.json and README's generated regions
```

`typecheck`, `site:dev` and `site:build` chain `site:data`, which rewrites README's `<!-- install:start -->`, `<!-- copilot:start -->`, `<!-- antigravity:start -->` and `<!-- plugins:start -->` regions. Edit README outside those regions only.

No CI: `npm run check` is the gate before a change lands. `.githooks/pre-commit` formats staged files; enable it once with `git config core.hooksPath .githooks`.

## Adding a plugin

1. Create `plugins/<name>/.claude-plugin/plugin.json` with `name`, `version`, `description`.
2. Add a catalog entry with `name`, `source: "./plugins/<name>"`, `description`, `category`.
3. Nothing to do under Copilot (a mod, or Claude Code-only features): add `"tags": ["claude-code-only"]`.
4. Otherwise, for Antigravity: add `.antigravity-plugin/plugin.json` with matching `name`, `version`, `description` (see Antigravity below).
5. Run `npm run check`; it regenerates README and validates every client.

## Releases

Run `/version-bump`. One release bumps one plugin's `version` in its `.claude-plugin/plugin.json` (and its Antigravity manifest when present) and commits that alone. The catalog and README carry no version.

## Hooks across clients

- Hooks read their payload and write their answer through the plugin's `hooks/client.mjs`, kept identical across plugins by `npm run validate`. Copilot sends its own tool names (`create`, `edit`) and argument names (`path`, `file_text`, `new_str`), and takes flat `additionalContext` / `permissionDecision` fields instead of `hookSpecificOutput`. `COPILOT_PLUGIN_ROOT` is set only under Copilot. Claude Code output stays unchanged.
- Under Copilot, hook stdout is one JSON document; plain text is dropped. A `PreToolUse` hook that crashes or exits non-zero denies the tool.
- Tool matchers name both spellings (`Write|Edit|create|edit`, `Skill|skill`); `SessionStart` matchers include Copilot's `new`. Every `node` hook `command` has a `powershell` twin using `$env:CLAUDE_PLUGIN_ROOT`.
- `SKILL.md` and agent frontmatter are strict YAML: quote a `description` that contains `: `.

## Antigravity CLI

- A plugin is on Antigravity when it carries `.antigravity-plugin/plugin.json`; the site and README derive its `agy plugin install <GitHub folder>` line from that file alone. A `claude-code-only` plugin has none.
- Antigravity shares `skills/` and `agents/`, but reads hooks from a root `hooks.json` and MCP servers from a root `mcp_config.json`, each in its own schema; it ignores `hooks/hooks.json` and `.mcp.json`. A plugin with hooks, MCP servers or agent `tools` lists gets its manifest once those are ported to that schema (`frontend` and `writeup` show the hook port, `filesystem-mcp` the MCP one). Contract: `plans/014-antigravity-cli-support.md`.
- A `SKILL.md` stays under 24 KB, and its `name` matches its folder.

## Mods

- A mod is a plugin whose `hooks/hooks.json` names a TypeScript hooks module (`"modules": ["./register.tsx"]`). Copilot does not run mods, so a mod carries the `claude-code-only` tag.
- Mod tests are `*.test.ts` under the plugin, run by `claude plugin test` from `npm run validate`; the root `npm test` collects only `*.test.mjs`.
- Loading a mod with `--plugin-dir` lays `.claude-plugin/types/` (gitignored) for the editor; it goes stale as Claude Code updates. `npm run validate` typechecks mods against the installed engine.

## Site and scripts

`site/` is the landing page (React, Vite, MUI, deployed on Vercel), built from the catalog by `scripts/build-site-data.mjs`. `scripts/validate.mjs` and `scripts/skill-lint.mjs` implement `npm run validate`.

## Commits

Conventional subjects (`feat`, `fix`, `refactor`, `chore`, …), scoped to the plugin or file when it helps.
