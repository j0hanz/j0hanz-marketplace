# UI Prototype

Generate **several radically different UI variations** on one route, switchable from floating bottom bar. User flips variants in browser, picks one (or steals bits from each), throws rest away.

Question about logic/state, not looks? Wrong branch. Use [LOGIC.md](LOGIC.md).

## When this is the right shape

- "What should this page look like?"
- "I want to see a few options for this dashboard before committing."
- "Try a different layout for the settings screen."
- Any time user would otherwise spend day picking between three vague mockups in head.

## Two sub-shapes: strongly prefer sub-shape A

UI prototype much easier to judge when **butting up against rest of app**: real header, real sidebar, real data, real density. Throwaway route alone = vacuum: every variant looks fine in isolation. Default sub-shape A whenever plausible existing page can host variants. Sub-shape B only if prototype genuinely has no nearby home.

### Sub-shape A: adjustment to an existing page (preferred)

Route exists. Variants render **on same route**, gated by `?variant=` URL search param. Existing data fetching, params, auth stay. Only rendering swaps. Default; pick unless specific reason not to.

Prototype for thing with no page yet but _would naturally live inside one_ (new dashboard section, new card on settings screen, new step in existing flow)? Still sub-shape A. Mount variants inside host page.

### Sub-shape B: a new page (last resort)

Only when thing genuinely has no existing page to live inside (e.g. entirely new top-level surface, or flow not embeddable anywhere sensible).

Create **throwaway route** following project's existing routing convention. No new top-level structure. Name obviously prototype (e.g. include `prototype` in path or filename). Same `?variant=` pattern.

Before committing to B, sanity-check: really no existing page to embed in? Empty route hides design problems populated one exposes.

Both sub-shapes: floating bottom bar identical.

## Process

### 1. State the question and pick N

Default **3 variants**. More than 5 stops being radically different, becomes noise; cap there.

Write plan in one line, in prototype's location or top-of-file comment:

> "Three variants of the settings page, switchable via `?variant=`, on the existing `/settings` route."

### 2. Generate radically different variants

Draft each variant. Hold each to:

- Page's purpose and data it can access.
- Project's component library / styling system (TailwindCSS, shadcn, MUI, plain CSS, whatever).
- Clear exported component name, e.g. `VariantA`, `VariantB`, `VariantC`.

Variants must be **structurally different**: different layout, information hierarchy, primary affordance — not just colours. Three slightly-tweaked card grids not UI prototype, it's wallpaper. Two drafts too similar? Redo one with explicit "do not use a card grid" guidance.

### 3. Wire them together

Create single switcher component on route:

```tsx
// pseudo-code, adapt to the project's framework
const variant = searchParams.get('variant') ?? 'A';
return (
  <>
    {variant === 'A' && <VariantA {...data} />}
    {variant === 'B' && <VariantB {...data} />}
    {variant === 'C' && <VariantC {...data} />}
    <PrototypeSwitcher variants={['A', 'B', 'C']} current={variant} />
  </>
);
```

Sub-shape A (existing page): keep all existing data fetching above switcher; only rendered subtree changes per variant.

Sub-shape B (new page): throwaway route under `/prototype/<name>` mounts same switcher.

### 4. Build the floating switcher

Small fixed-position bar, bottom-centre of screen, three pieces:

- **Left arrow**: cycles to previous variant (wraps).
- **Variant label**: shows current variant key and, if variant exports name, that name too. e.g. `B (Sidebar layout)`.
- **Right arrow**: cycles forward (wraps).

Behaviour:

- Arrow click updates URL search param (use framework's router, e.g. `router.replace` on Next, `navigate` on React Router, etc) so variant shareable and reload-stable.
- Keyboard: `←` and `→` also cycle. Don't intercept arrow keys when `<input>`, `<textarea>`, or `[contenteditable]` focused.
- Visually distinct from page (e.g. high-contrast pill, subtle shadow) so obviously not part of design being evaluated.
- Hidden in production builds: gate on `process.env.NODE_ENV !== 'production'` or equivalent, so stray prototype merge can't ship bar to users.

Put switcher in single shared component so both sub-shapes reuse it. Locate wherever shared UI lives in project.

### 5. Hand it over

Give dev command and URL for each `?variant=` key. User flips through when ready. Interesting feedback usually **"I want the header from B with the sidebar from C"** — that's actual design they want.

### 6. Capture the answer and clean up

Follow "When the question is answered" in [SKILL](SKILL.md). UI-specific part:

- **Sub-shape A**: fold winner into existing page; remove losing variants and switcher.
- **Sub-shape B**: promote winning variant to real route; remove throwaway route and switcher.

Leftover variant components and switcher rot fast, confuse next reader.

## Anti-patterns

- **Variants differing only in colour or copy.** Tweak, not prototype. Real variants disagree about structure.
- **Sharing too much code between variants.** Shared `<Header>` fine; shared `<Layout>` defeats point. Each variant free to throw out layout.
- **Wiring variants to real mutations.** Read-only prototypes fine. Variant needs mutate? Point at stub: question is "what should this look like", not "does the backend work".
- **Promoting prototype directly to production.** Variant code written under prototype constraints (no tests, minimal error handling). Rewrite properly when folding in.
