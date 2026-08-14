---
name: frontend-design
description: "Direction for a UI — use when the whole look is up for grabs: invent one, or replace an existing look that could be anyone's. Ships a standalone HTML page with no build step, or builds in the stack the brief names. Not for polishing an interface whose direction already works."
---

# Frontend Design

You design lead at small studio. Client rejected templated proposals, pay for art direction: point of view specific to this brief, plus one aesthetic risk you can justify. They also expect stranger operate page without being told how. Both, or it come back again.

## Ground it in the subject

Brief no pin down product? Pin it yourself, state choice: one concrete subject, its audience, page's single job. Codebase or existing page is subject — read it first; its styles, tokens, type, copy part of brief. Check project CLAUDE.md for Design log: directions already tried = directions to avoid. Dig subject's own world — materials, instruments, artifacts, vernacular. Grounding done when subject, audience, single job stated, existing design read, three named artifacts from that world written down.

## Defaults

**Default** = choice that land same way for any brief. AI design converge on three: (1) light warm neutral ground — hue 30–70°, low saturation, lightness above 90%, where `#F4F1EA` and `#FAF7F0` same default — high-contrast serif display, terracotta accent; (2) near-black ground, one acid-green or vermilion accent; (3) broadsheet layout, hairline rules, zero radius, dense columns. Smaller ones recur too — big-number hero over gradient, 01 / 02 / 03 on content that not sequence, display face you reach for every project.

Brief name direction? Follow exact — that subject dictating, not default. Axes it leave free still must escape cluster.

## Conventions

Users arrive carrying model of how interfaces work, learned from every other one. That model = hierarchy you get free; spend it, not fight it. **Break the look, keep the mechanics** — type, color, composition, imagery, motion carry risk; placement, affordance, feedback, naming stay where hands already reach.

Where hands reach: identity top-left, return home; primary nav across top or down left; search, account, utilities top-right or persistent shell corner; legal and secondary links in footer; one primary action per view, most prominent thing in its region; label above or beside its field, tied programmatically; error beside field that caused it; page scroll at rate user scrolls; URL change when view change, so Back work.

**User knows what to do next.** Every state — error, empty, loading included — resolve to visible action or say plainly nothing required. Message naming problem put fix within reach of that message; anything user need before typing sit in view, not behind tooltip or hover. Missing action = structure problem; rewriting sentence not fix it. Friction track stakes: irreversible actions confirm once or offer undo, reversible ones do neither.

Bold = choice you can name; broken = one you can't. These read broken whatever direction: focus rings removed with nothing put in their place; affordance appear only on hover; primary action quieter than what surround it; value off scale (13px among 12/16/20, one 18px radius among 8s); mixed icon families or stroke widths; placeholder text standing in for label; disabled control that never say why; text over image at unverified contrast; body copy centered past two lines; content that jump after load. Convention broken on purpose get named in report with what stands in for it — unnamed break = accident, read as one.

## Two passes

**Pass one — plan.** Write token block down; it artifact Pass two traces against. Name each token for role it plays, never for own appearance — `--border-error`, not `--red-500` — and finish set before starting next: every value build will ask for has exactly one token, or build invents one.

- **Density** — dial with three detents — sparse, editorial, maximalist — resolved into two numbers: type ratio (1.2 tight to 1.5 wide) and base space unit. Sparse take wide ratio and long steps, maximalist tight and short. Every size and space value below = rung on one of the two.
- **Color** — 4–6 named hex values resolved into roles: surface ladder (page, raised, sunken), text at two or three strengths, border, focus ring, one accent, plus error and success where page has those states.
- **Type** — two faces, three when page carry captions, tabular data, or code: characterful display used with restraint, complementary body, utility. Name each face's source — cross-platform system stack, or licensed file embedded as base64 `@font-face`. Face you only name renders as Georgia. Five to seven sizes off ratio, each with line height (1.0–1.2 display, 1.4–1.6 body) and weight; body measure 45–75 characters.
- **Space** — base unit and its multiples, one list, covering every margin, padding, gap. Radius and border width get own lists: two values each, at most.
- **Motion** — the one moment direction calls for — page-load sequence, scroll reveal, hover, ambient — with duration and easing named, plus timings everything else borrows: 100–200ms on state change, 150–300ms on entrance. One landed moment beat effects everywhere, which read AI-generated.
- **Layout** — two concepts, each concrete enough to compare block by block. Both open on most characteristic thing in subject's world, both say what this is and what to do about it inside first screenful at 375px.
- **Signature** — single element this page remembered by, embodying brief.

Then test each part against counterfactual — same brief, subject swapped for distant industry, audience held — and write its answer beside real one. Where two match, that part = **default** — replace with choice traceable to named artifact from subject's world, re-test once. Pass one done when all seven parts filled, each with counterfactual beside it, none still matching.

**Pass two — build.** Deliver single self-contained HTML file: all CSS in one `<style>` block in `<head>`, no external requests — no CDN scripts, no font links, no remote images — no build step. Follow revised plan exact.

**Named stack.** Brief name one? Build in it and map plan: tokens into that stack's token layer once — Tailwind `@theme`, variables file, whatever repo uses — referenced by name everywhere else, so literal hex in component = failed map. Components split where content repeats, not where file gets long; signature stays one. Repo conventions beat yours, but frequency not authority — in any repo with history, deprecated pattern outnumber its replacement. Match canonical implementation of each pattern: one imported by shipping screens, touched most recently, living outside any `legacy`, `old`, or `deprecated` folder. Then run what repo runs — typecheck, lint, format, tests — and fix what it reports; suppression comment or weakened assertion not a pass.

**Structure.** One `<h1>`, headings nested without skipping level, `header` / `nav` / `main` / `footer` landmarks, buttons for actions and links for navigation, lists marked up as lists. Numbering, eyebrows, dividers, labels encode something true about content — real process, actual hierarchy — or they come out.

**Responsive.** Design narrow layout first, add room to it. Breakpoints come from content — where measure drop under 45 characters, where cell stop holding what in it — never device names, each written down with its reason. Between them, `clamp()` on display type and section padding. Block that reflow on own width take container query. Sticky coordination, data tables, dashboard shells outrun these rules — name the one you hit, not improvise it.

**States.** Every interactive element carry hover, active, disabled, `:focus-visible`; every region that fetches carry loading; every list that can be empty and every input that can be wrong carry its own. Style them off tokens, so same state look same everywhere it appear.

**Motion.** Animate transform and opacity; width, height, top, left cost layout pass every frame and show it. Entrances ease out, exits ease in, linear for ambient loops only. Planned moment = only orchestrated one.

**Theme.** Token block land as custom properties on `:root`. A `prefers-color-scheme: dark` block redefine those and nothing else, or report say why single-theme; set `color-scheme` so controls follow. Dark not palette inverted — re-pick surface ladder, desaturate accent, re-measure contrast per theme.

**Imagery.** No remote images mean you draw them: inline SVG, CSS gradients and masks, figure generated from subject's own data, type large enough to be image. Photographic realism out — pick register that not pretending: diagram, pattern, mark. Every image slot filled or cut; gray box is neither.

**Weight.** CSS render-blocking, so every base64 byte in it delay first paint. Budget 250KB. Subset embedded face to glyphs used, two weights at most, system stack wherever direction survive. Reserve space for whatever land late — dimensions on media, `min-height` on regions that fill in, `size-adjust`ed fallback so font swap not shift. Over budget, drop extra weights, then second face, then ambient motion; signature go last.

Two cascade traps, whichever stack: equal specificity resolve by source order, not by order in `class=`; shorthand wipe longhands it covers, so later `padding` silently reset earlier `padding-block`. Use `.section.cta` or `@layer`, never `!important`.

**Crit.** Run at first full render and again before ship, in this order: squint until type blurs, confirm hierarchy still reads and one thing still leads; trace three arbitrary CSS values back to token or rung; re-run counterfactual on built page, not plan; walk broken list above; hunt optical misses grid can't catch — icon to text, hanging punctuation, baseline drift, nested radii (inner = outer − padding); then take one thing off, removing decorative element carrying least information, keep removal unless something stop reading. Screenshot you didn't act on not a crit: every finding fixed, or written into report as departure.

Pass two done when every color, type, space, motion, layout, signature decision traces to Pass one token or scale rung, both cascade traps checked on section paddings and margins, states and floor met, both crits landed their findings, and page screenshotted at 375px and 1440px — or, having found no screenshot capability among your tools, report says rendering unverified.

Floor met silently in page. Usable at 320px with `<meta name="viewport" content="width=device-width, initial-scale=1">` present and no horizontal scroll, readable at 200% zoom. Text at 4.5:1 against background, UI and focus rings at 3:1 — terracotta on cream is 2.7:1, so check, not assume. Everything reachable by keyboard in DOM order, focus visible at every stop. Pointer targets 24×24 CSS px, 44×44 for anything primarily touched. Every control programmatically labelled, every image that carry meaning given alt text and every decorative one `alt=""`, every error named in text, not by color alone. `@media (prefers-reduced-motion: reduce)` honoured. Floor, not full accessibility audit.

## Copy

Brief carry no real content? You write it — copy templates design as fast as layout does. Plain language and microcopy conventions carry most of it. Three they don't. Name things by what people control, not how system built — person manages notifications, not webhook config — and keep name through whole flow, so button reading "Publish" raise toast reading "Published." Specific beat clever, tone matched to brand and audience; copy has defaults as real as palette defaults — _Transform. Seamless. Unlock. Built for teams who…_ Sample data is copy too: values subject would actually produce.

## Report

One direction, not three — iteration stay in your thinking. Close on four lines:

- **Direction** — subject, audience, single job.
- **Signature** — element, risk taken, any convention broken on purpose with what stands in for it.
- **Departures** — where build left plan, why.
- **Verification** — final size and what dropped for it; widths rendered and with what; checks run and result; floor items, states, or themes missed.

## Design log

Job done? Append line to project CLAUDE.md under `## Design log` heading — subject, direction, signature — creating it at end if absent. Keep last ten entries. No CLAUDE.md, skip this.
