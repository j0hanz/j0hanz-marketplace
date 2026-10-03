# j0hanz-marketplace

Plugin marketplace for Claude Code and GitHub Copilot CLI. Plugins live in `plugins/<name>/`; each holds its own `.claude-plugin/plugin.json`, skills, agents, and hooks. The catalog at `.claude-plugin/marketplace.json` lists them; Copilot CLI reads the same file, so there is only one.

## Commands

```bash
npm run check        # lint + format:check + validate + typecheck + test — the pre-merge gate
npm test             # node --test
npm run validate     # claude plugin validate --strict per plugin, Copilot structural checks, Copilot install smoke test when `copilot` is on PATH
npm run site:data     # rebuilds site/src/data/marketplace.json and rewrites README's generated regions
```

`typecheck`, `site:dev`, and `site:build` chain `site:data`, so any of them rewrites README's `<!-- install:start -->`, `<!-- copilot:start -->`, and `<!-- plugins:start -->` regions in place — never hand-edit those regions.

## Two clients

- Hooks read their payload and write their answer through the plugin's `hooks/client.mjs` (`client.cjs` in mcp-hub): Copilot sends its own tool names (`create`, `edit`) and argument names (`path`, `file_text`, `new_str`), and takes flat `additionalContext` / `permissionDecision` fields, not `hookSpecificOutput`. `COPILOT_PLUGIN_ROOT` is set only under Copilot. Claude Code output must stay unchanged.
- Hook stdout is one JSON document under Copilot; plain text is dropped. A `PreToolUse` hook that crashes or exits non-zero denies the tool in Copilot.
- Tool matchers name both spellings (`Write|Edit|create|edit`, `Skill|skill`); `SessionStart` matchers include Copilot's `new`. Every `node` hook `command` has a `powershell` twin using `$env:CLAUDE_PLUGIN_ROOT`.
- `SKILL.md` and agent frontmatter must be strict YAML — quote a `description` that contains `: `.
- A plugin with nothing to do under Copilot carries the `claude-code-only` catalog tag.

## Mods

- A mod is a plugin whose `hooks/hooks.json` names a TypeScript hooks module (`"modules": ["./register.tsx"]`). Copilot does not run mods, so a mod carries the `claude-code-only` tag.
- Mod tests are `*.test.ts` under the plugin, run by `claude plugin test` from `npm run validate`. The root `npm test` collects only `*.test.mjs`.
- Loading a mod with `--plugin-dir` lays `.claude-plugin/types/`, which is gitignored. Load it once so `npm run validate` can typecheck it.

## Gate

No CI. Run `npm run check` before a change lands.

## Commits

Conventional subjects (`feat`, `fix`, `refactor`, `chore`, …), scoped to the plugin or file when it helps.
