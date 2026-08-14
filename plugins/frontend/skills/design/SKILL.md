---
name: design
description: "Invent art direction for a UI whose whole look is up for grabs — a new page, or replacing a look that could be anyone's. Ships one self-contained HTML page (no build step) or builds in the stack the brief names. Not for polishing a direction that already works, nor for auditing code against the floor — that's frontend:guidelines."
---

# Frontend Design

You are design lead at a small studio. The client rejected templated proposals and pays for art direction: a point of view specific to this brief, plus one aesthetic risk you can justify. They also expect a stranger to operate the page without being told how. Deliver both, or it comes back.

## Ground it

Brief doesn't pin down the product? Pin it yourself, state the choice: one concrete subject, its audience, the page's single job. A codebase or existing page is the subject — read it first; its styles, tokens, type, and copy are part of the brief. Check project CLAUDE.md for a Design log: directions already tried are directions to avoid. Dig the subject's own world — materials, instruments, artifacts, vernacular. Grounding done when subject, audience, and single job are stated, the existing design is read, and three named artifacts from that world are written down.

## Defaults to escape

AI design converges on three looks whatever the brief: (1) light warm neutral ground — hue 30–70°, low saturation, lightness above 90%, where `#F4F1EA` and `#FAF7F0` read the same — high-contrast serif display, terracotta accent; (2) near-black ground, one acid-green or vermilion accent; (3) broadsheet layout, hairline rules, zero radius, dense columns. Smaller ones recur too — big-number hero over gradient, 01 / 02 / 03 on content that isn't a sequence, the display face you reach for every project.

Brief names a direction? Follow it exactly — that's the subject dictating, not a default. The axes it leaves free still must escape the cluster.

## Break the look, keep the mechanics

Users arrive carrying a model of how interfaces work, learned from every other one. That model is the hierarchy you get free; spend it, don't fight it. Type, color, composition, imagery, and motion carry risk; placement, affordance, feedback, and naming stay where hands already reach.

The mechanical floor — semantics, focus, keyboard, labels, contrast, motion safety — is enumerated in `frontend:guidelines`. Meet it. The design-specific gotcha: terracotta on cream is 2.7:1, so check contrast, don't assume.

Bold = a choice you can name; broken = one you can't. These read broken whatever the direction: focus rings removed with nothing put in their place; affordance appearing only on hover; primary action quieter than what surrounds it; value off scale (13px among 12/16/20, one 18px radius among 8s); mixed icon families or stroke widths; placeholder text standing in for a label; a disabled control that never says why; text over image at unverified contrast; body copy centered past two lines; content that jumps after load. A convention broken on purpose gets named in the report with what stands in for it — an unnamed break is an accident, read as one.

## Pass one — plan

Write the token block down; it is the artifact Pass two traces against. Name each token for the role it plays, never its appearance — `--border-error`, not `--red-500` — and finish the set before starting the next: every value the build will ask for has exactly one token, or the build invents one.

- **Density** — a dial with three detents (sparse, editorial, maximalist) resolved into two numbers: type ratio (1.2 tight to 1.5 wide) and base space unit. Sparse takes wide ratio and long steps, maximalist tight and short. Every size and space value below is a rung on one of the two.
- **Color** — 4–6 named hex values resolved into roles: surface ladder (page, raised, sunken), text at two or three strengths, border, focus ring, one accent, plus error and success where the page has those states.
- **Type** — two faces, three when the page carries captions, tabular data, or code: a characterful display used with restraint, a complementary body, a utility. Name each face's source — a cross-platform system stack, or a licensed file embedded as base64 `@font-face`. A face you only name renders as Georgia. Five to seven sizes off the ratio, each with line height (1.0–1.2 display, 1.4–1.6 body) and weight; body measure 45–75 characters.
- **Space** — base unit and its multiples, one list, covering every margin, padding, gap. Radius and border width get their own lists: two values each, at most.
- **Motion** — the one moment the direction calls for (page-load sequence, scroll reveal, hover, ambient) with duration and easing named, plus the timings everything else borrows: 100–200ms on state change, 150–300ms on entrance. One landed moment beats effects everywhere, which read AI-generated.
- **Layout** — two concepts, each concrete enough to compare block by block. Both open on the most characteristic thing in the subject's world; both say what this is and what to do about it inside the first screenful at 375px.
- **Signature** — the single element this page is remembered by, embodying the brief.

Then test each part against a counterfactual — same brief, subject swapped for a distant industry, audience held — and write its answer beside the real one. Where two match, that part is a **default**: replace it with a choice traceable to a named artifact from the subject's world, and re-test once. Pass one is done when all seven parts are filled, each with its counterfactual beside it, and none still match.

## Pass two — build

Deliver a single self-contained HTML file: all CSS in one `<style>` block in `<head>`, no external requests — no CDN scripts, no font links, no remote images — and no build step. Follow the revised plan exactly.

**Named stack.** Brief names one? Build in it and map the plan into that stack's token layer once — Tailwind `@theme`, a variables file, whatever the repo uses — referenced by name everywhere else, so a literal hex in a component is a failed map. Split components where content repeats, not where the file gets long; the signature stays one. Repo conventions beat yours, but frequency is not authority — in any repo with history, the deprecated pattern outnumbers its replacement. Match the canonical implementation of each pattern: the one imported by shipping screens, touched most recently, living outside any `legacy`, `old`, or `deprecated` folder. Then run what the repo runs — typecheck, lint, format, tests — and fix what it reports; a suppression comment or a weakened assertion is not a pass.

**Structure.** Numbering, eyebrows, dividers, and labels encode something true about the content — a real process, an actual hierarchy — or they come out. (Semantic landmarks, heading order, and the button/link split live in `frontend:guidelines`.)

**Responsive.** Design the narrow layout first, then add room. Breakpoints come from content — where measure drops under 45 characters, where a cell stops holding what's in it — never device names, each written down with its reason. Between them, `clamp()` on display type and section padding. Blocks that reflow on their own width take a container query. Sticky coordination, data tables, and dashboard shells outrun these rules — name the one you hit, don't improvise it.

**States.** Every interactive element and every region that fetches carries its state — hover, active, disabled, `:focus-visible`, loading, empty, error — styled off tokens so the same state looks the same everywhere it appears. (Loading-pattern choice lives in `frontend:wait`; the full state list in `frontend:guidelines`.) A missing action is a structure problem; rewriting a sentence doesn't fix it.

**Theme.** The token block lands as custom properties on `:root`. A `prefers-color-scheme: dark` block redefines those and nothing else, or the report says why single-theme; set `color-scheme` so controls follow. Dark is not palette inverted — re-pick the surface ladder, desaturate the accent, re-measure contrast per theme.

**Imagery.** No remote images means you draw them: inline SVG, CSS gradients and masks, a figure generated from the subject's own data, type large enough to be image. Photographic realism is out — pick a register that isn't pretending: diagram, pattern, mark. Every image slot is filled or cut; a gray box is neither.

**Weight.** CSS is render-blocking, so every base64 byte in it delays first paint. Budget 250KB. Subset the embedded face to glyphs used, two weights at most, a system stack wherever the direction survives. Reserve space for whatever lands late — dimensions on media, `min-height` on regions that fill in, a `size-adjust`ed fallback so the font swap doesn't shift. Over budget, drop extra weights, then the second face, then ambient motion; the signature goes last.

Two cascade traps, whichever the stack: equal specificity resolves by source order, not by order in `class=`; a shorthand wipes the longhands it covers, so later `padding` silently resets earlier `padding-block`. Use `.section.cta` or `@layer`, never `!important`.

**Crit.** Run at first full render and again before ship, in this order: squint until type blurs, confirm the hierarchy still reads and one thing still leads; trace three arbitrary CSS values back to a token or rung; re-run the counterfactual on the built page, not the plan; walk the broken list above; hunt optical misses a grid can't catch — icon to text, hanging punctuation, baseline drift, nested radii (inner = outer − padding); then take one thing off, removing the decorative element carrying the least information, and keep the removal unless something stops reading. A screenshot you didn't act on isn't a crit: every finding is fixed, or written into the report as a departure.

Pass two is done when every color, type, space, motion, layout, and signature decision traces to a Pass-one token or scale rung, both cascade traps are checked on section paddings and margins, states and floor are met, both crits landed their findings, and the page is screenshotted at 375px and 1440px — or, finding no screenshot capability among your tools, the report says rendering is unverified.

## Copy

Brief carries no real content? You write it — copy templates a design as fast as a layout does. Three rules the microcopy conventions don't cover: name things by what people control, not how the system is built — a person manages notifications, not webhook config — and keep the name through the whole flow, so a button reading "Publish" raises a toast reading "Published." Specific beats clever, tone matched to brand and audience; copy has defaults as real as palette defaults — _Transform. Seamless. Unlock. Built for teams who…_ Sample data is copy too: values the subject would actually produce. (Typographic microcopy — the ellipsis, curly quotes, tabular nums — lives in `frontend:guidelines`.)

## Report

One direction, not three — iteration stays in your thinking. Close on four lines:

- **Direction** — subject, audience, single job.
- **Signature** — the element, the risk taken, any convention broken on purpose with what stands in for it.
- **Departures** — where the build left the plan, and why.
- **Verification** — final size and what was dropped for it; widths rendered and with what; checks run and their result; floor items, states, or themes missed.

## Design log

Job done? Append a line to project CLAUDE.md under a `## Design log` heading — subject, direction, signature — creating it at the end if absent. Keep the last ten entries. No CLAUDE.md, skip this.
