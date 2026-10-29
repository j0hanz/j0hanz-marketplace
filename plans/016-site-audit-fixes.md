# Plan 016: Site audit fixes (category per client, CSP hash, a11y, cleanup)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the eight findings of the 2026-10-29 `site/` audit: the category filter offers only categories the chosen client can install, the CSP hash has one source, screen readers get the labels the page means to give, and dead or duplicated code goes.

**Architecture:** Four independent tasks. Task 1 moves the per-client category rule into a pure module `site/src/catalog.ts` that `node --test` can import directly (Node 24 strips the erasable types). Task 2 makes `vite.config.mts` read the hash from `vercel.json` instead of a second copy. Tasks 3 and 4 are attribute- and line-level edits in existing components.

**Tech Stack:** Node 24 ESM, `node:test`, React 19 + MUI 9, Vite 8, TypeScript 7 typecheck.

**Spec:** the `site/` audit report from the 2026-10-29 session, summarized under "Findings" below; there is no separate file.

## Findings (the spec)

1. Under Antigravity CLI the `learning` category button shows an empty grid (`tutor` has no `.antigravity-plugin/plugin.json`). Buttons come from `site.categories` (`Catalog.tsx:198`), unaware of the client filter (`useCatalogFilter.ts:56`).
2. `THEME_SCRIPT_HASH` (`vite.config.mts:36`) and `script-src` in `vercel.json:20` are two copies; the build checks only the first, so a drifted `vercel.json` ships a CSP that blocks the theme script.
3. `aria-label` on role-less elements is ignored: section count (`Section.tsx:47`), `model-loaded` tag (`SkillIndex.tsx:157`), hook chip (`Catalog.tsx:92-100`).
4. Below `md` the `<nav aria-label="Sections">` is empty; `MobileMenu` (`Nav.tsx:164`) sits outside it.
5. `RevealOnEnter.tsx:13` puts the `display: contents` wrapper in `pending`; it never intersects, so the early return never fires and every render rebuilds the observer.
6. `mui.ts:161-165` `MuiToggleButtonGroup` override duplicates `segmented`'s `borderLeft` in `theme/tokens.ts`.
7. `Command.tsx:65` live region holds "Copy" at rest, so the reset after "Copied" is announced.
8. Stale comments: `icons.tsx:30` ("one caller"; there are four), `index.css:126-131` (install "steps"; the panel now holds a picker and one command).

## Global Constraints

- Node `>=24` (`package.json` engines); no new dependencies.
- Root `npm test` collects `scripts/*.test.mjs` and `plugins/*/test/**/*.test.mjs`; a site test therefore lives in `scripts/`.
- `site/src/catalog.ts` uses only erasable TypeScript (`import type`, annotations) so plain `node` can import it.
- Never hand-edit README's generated regions; `typecheck` rewrites them.
- No plugin changes, so no version bumps.
- Gate: `npm run check` passes before the branch lands. Conventional subjects scoped `site` (or `vite` for Task 2).

## Review Focus

1. Stored client `antigravity` plus `?category=learning`: the grid shows all Antigravity plugins with `All` selected, not an empty list. Checked by hand in Task 1 Step 6.
2. Switching Antigravity → Claude Code after picking `learning` under Claude: the `learning` choice comes back, since state keeps it and only the effective category falls back. Task 1 Step 6.
3. A category with no plugin under any client: dropped, not rendered as a dead button. Pinned by `drops a category no plugin has` (Task 1).
4. `vercel.json` with no `sha256-` token: the build fails with a clear message, not `undefined` in a compare. Task 2 Step 3.
5. Section count read by a screen reader: one phrase ("13 plugins"), not "13" and then "13 plugins". Task 3 Step 1 keeps the digits `aria-hidden`.

---

### Task 1: Category buttons follow the chosen client

Finding 1.

**Files:**

- Create: `site/src/catalog.ts`
- Create: `scripts/site-catalog.test.mjs`
- Modify: `site/src/hooks/useCatalogFilter.ts:33-61` (state, filter, return)
- Modify: `site/src/components/Catalog.tsx:198` (button source), import line 20

**Interfaces:**

- Consumes: `Plugin`, `ClientId` types from `site/src/site.ts`.
- Produces: `categoriesFor(plugins: readonly Plugin[], categories: readonly string[], client: ClientId): string[]` in `site/src/catalog.ts`, keeping the order of `categories`. `useCatalogFilter` returns two new or changed fields: `categories: string[]` (the result above) and `category: string` (now the effective one: the chosen category if it is in `categories`, else `ALL`).

- [ ] **Step 1: Write the failing tests** in `scripts/site-catalog.test.mjs`

Fixture helper: `plugin(category, { copilot = 'c', antigravity = 'a' } = {})` → `{ category, installs: { claude: 'x', copilot, antigravity } }`.

```js
import { categoriesFor } from '../site/src/catalog.ts';

const plugins = [
  plugin('learning', { antigravity: null }),
  plugin('frontend'),
  plugin('productivity', { copilot: null, antigravity: null }),
];
const all = ['learning', 'frontend', 'productivity', 'quality'];

test('claude keeps every category a plugin has, in order', () => {
  assert.deepEqual(categoriesFor(plugins, all, 'claude'), ['learning', 'frontend', 'productivity']);
});
test('antigravity drops categories with no antigravity plugin', () => {
  assert.deepEqual(categoriesFor(plugins, all, 'antigravity'), ['frontend']);
});
test('copilot drops a category whose only plugin is claude-code-only', () => {
  assert.deepEqual(categoriesFor(plugins, all, 'copilot'), ['learning', 'frontend']);
});
test('drops a category no plugin has', () => {
  assert.equal(categoriesFor(plugins, all, 'claude').includes('quality'), false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test scripts/site-catalog.test.mjs`
Expected: FAIL, `ERR_MODULE_NOT_FOUND` for `site/src/catalog.ts`.

- [ ] **Step 3: Implement `categoriesFor` in `site/src/catalog.ts`**

`categories.filter((c) => plugins.some((p) => p.category === c && p.installs[client]))`. Import the types with `import type { ClientId, Plugin } from './site';`.

- [ ] **Step 4: Run to verify it passes**

Run: `node --test scripts/site-catalog.test.mjs`
Expected: 4 pass, 0 fail.

- [ ] **Step 5: Wire it into the hook and the catalog**

In `useCatalogFilter`: rename the state to `[chosen, setCategory]`; `const categories = useMemo(() => categoriesFor(site.plugins, site.categories, client), [client]);` `const category = categories.includes(chosen) ? chosen : ALL;` Use `category` in the URL effect, the `visible` filter and the return; add `categories` to the return. Keep the URL-read validation against `site.categories`, so a category hidden only by the client survives a client switch back.

In `Catalog.tsx:198`: map `filter.categories` (destructure `categories` with the others at line 119). Drop `site` from the line-20 import if typecheck reports it unused.

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npm test`
Expected: exit 0.

Run `npm run site:dev`, open `/?category=learning`, pick Antigravity: no `learning` button, `All` selected, every Antigravity card shows. Pick Claude Code: `learning` selected again, `tutor` card shows.

- [ ] **Step 7: Commit**

```bash
git add site/src/catalog.ts scripts/site-catalog.test.mjs site/src/hooks/useCatalogFilter.ts site/src/components/Catalog.tsx
git commit -m "fix(site): offer only categories the chosen client can install"
```

### Task 2: One source for the theme script's CSP hash

Finding 2.

**Files:**

- Modify: `vite.config.mts:36` (constant), `:73-80` (check and message)

**Interfaces:**

- Consumes: `vercel.json` `headers[].headers[]` entry with `key: "Content-Security-Policy"`.
- Produces: nothing new. `THEME_SCRIPT_HASH` stays a module constant, now read from `vercel.json`.

- [ ] **Step 1: Replace the literal**

`THEME_SCRIPT_HASH = readFileSync(new URL('./vercel.json', import.meta.url), 'utf8').match(/'(sha256-[A-Za-z0-9+/=]+)'/)?.[1]`. If it is `undefined`, throw `vercel.json has no 'sha256-…' in script-src; the inline theme script needs one.` at module load.

- [ ] **Step 2: Reword the mismatch error**

`index.html's inline theme script changed. Set its hash in vercel.json's script-src to '${hash}', or the CSP will block it in production.` One file to edit now, so the message names one.

- [ ] **Step 3: Verify both outcomes**

Run: `npm run site:build`
Expected: exit 0.

Change one character of the hash in `vercel.json`, run `npm run site:build`.
Expected: FAIL with the Step 2 message carrying `sha256-qtbieZlDsmW7yCtw/DDZy9Zdyb9cOgyCVPs9MC22EJs=`. Revert `vercel.json`; `git diff vercel.json` prints nothing.

- [ ] **Step 4: Commit**

```bash
git add vite.config.mts
git commit -m "fix(vite): read the theme script hash from vercel.json"
```

### Task 3: Labels screen readers read

Findings 3, 4, 7.

**Files:**

- Modify: `site/src/components/Section.tsx:44-51`
- Modify: `site/src/components/SkillIndex.tsx:157`
- Modify: `site/src/components/Catalog.tsx:92-100`
- Modify: `site/src/components/Nav.tsx:125-164`
- Modify: `site/src/components/Command.tsx:65-67`

**Interfaces:** none across tasks.

- [ ] **Step 1: Section count**

Keep the visible span; drop its `aria-label`; wrap `{count.total}` in `<span aria-hidden>`; add `<Box component="span" sx={srOnly}>{count.label}</Box>` beside it. Import `srOnly` from `../theme/tokens`. The Stack is `position: relative`, so `srOnly` stays inside it.

- [ ] **Step 2: Named non-controls**

Add `role="note"` to the `model-loaded` `Tag` (`SkillIndex.tsx:157`) and to the hook `Chip` (`Catalog.tsx:92`). `note` takes an author name; `tabIndex` stays so keyboard users still reach the tooltip.

- [ ] **Step 3: Mobile menu inside the landmark**

Move `<MobileMenu active={active} />` from line 164 into the `component="nav"` Stack, after the `navLinks` map. Reword the comment above that Stack: the section links and their mobile menu are the landmark; theme and repo controls are not.

- [ ] **Step 4: Quiet live region at rest**

`Command.tsx:66`: render `{status !== 'idle' && tip}` in the `role="status"` span. The `Tooltip` keeps `tip`.

- [ ] **Step 5: Verify**

Run: `npm run lint && npm run typecheck`
Expected: exit 0.

In `npm run site:dev` at 375px wide, the accessibility tree (DevTools > Accessibility) shows the `Sections` navigation holding the menu button, the Plugins heading row exposes "N plugins" once, and copying a command announces "Copied" with no "Copy" afterwards.

- [ ] **Step 6: Commit**

```bash
git add site/src/components/Section.tsx site/src/components/SkillIndex.tsx site/src/components/Catalog.tsx site/src/components/Nav.tsx site/src/components/Command.tsx
git commit -m "fix(site): give counts, tags and the mobile menu names screen readers read"
```

### Task 4: Dead work and stale notes

Findings 5, 6, 8.

**Files:**

- Modify: `site/src/components/RevealOnEnter.tsx:13`
- Modify: `site/src/theme/mui.ts:161-165`
- Modify: `site/src/icons.tsx:30-31`
- Modify: `site/src/index.css:119-131`

**Interfaces:** none across tasks.

- [ ] **Step 1: Drop the wrapper from `pending`**

`[...node.querySelectorAll<HTMLElement>(SELECTOR)]`. The wrapper is `display: contents` and nothing in `index.css` targets it.

- [ ] **Step 2: Delete the `MuiToggleButtonGroup` override** (`mui.ts:161-165`)

Both groups spread `segmented`, which sets the same 1px `edge` left border. If `edge` is then unused in `mui.ts`, typecheck says so; it is still used by `MuiCard`, `MuiChip`, `MuiOutlinedInput`, `MuiToggleButton`, so expect no change to the import.

- [ ] **Step 3: Correct the comments**

`icons.tsx:30-31`: `The srOnly text carries the new-tab announcement; the glyph is decorative.` `index.css:119-131`: describe what runs now: the pitch rises, then the panel's picker and command wipe in, the last landing at 520ms with the pitch.

- [ ] **Step 4: Verify**

Run: `npm run check`
Expected: exit 0.

In `npm run site:dev`, both client pickers and the category row show the same gap and left border as before; cards still fade in on scroll and after a search.

- [ ] **Step 5: Commit**

```bash
git add site/src/components/RevealOnEnter.tsx site/src/theme/mui.ts site/src/icons.tsx site/src/index.css
git commit -m "refactor(site): drop the unobservable reveal wrapper and a duplicate border rule"
```

### Wrap-up

- [ ] Add a row for plan 016 to `plans/README.md`, in the same shape as 015's row.
- [ ] `npm run check` exits 0 on the branch head.
