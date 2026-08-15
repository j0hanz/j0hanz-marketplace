# j0hanz-marketplace

Claude Code plugin marketplace. Plugins live in `plugins/<name>/`; each holds its own `.claude-plugin/plugin.json`, skills, agents, and hooks. The catalog at `.claude-plugin/marketplace.json` lists them.

## Commands

```bash
npm run check        # lint + format:check + validate + typecheck + test — the pre-merge gate
npm test             # node --test
npm run validate     # claude plugin validate --strict per plugin, from the catalog
npm run site:data     # rebuilds site/src/data/marketplace.json and rewrites README's generated regions
```

`typecheck`, `site:dev`, and `site:build` chain `site:data`, so any of them rewrites README's `<!-- install:start -->` and `<!-- plugins:start -->` regions in place — never hand-edit those regions.

## Gate

No CI. Run `npm run check` before a change lands.

## Commits

Conventional subjects (`feat`, `fix`, `refactor`, `chore`, …), scoped to the plugin or file when it helps.
