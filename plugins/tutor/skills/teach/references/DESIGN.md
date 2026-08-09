# Lesson HTML Design

Design system for HTML this skill generate. One course identity cross every `lessons/*.html` and `reference/*.html` in workspace — set read as course, not pile one-offs.

Hard constraint from [SKILL.md](../SKILL.md) shape every choice — see [Constraints](#constraints). One file, three parts, read in order: direction, layout, retrieval-gate signature, [what vary per lesson](#variation), constraints and validation; then [Tokens](#tokens), every CSS token role; then [Components](#components), every reusable block a generated lesson emit plus [template argument](#template-arguments) table. One file because three drift apart when three — component change needing token and validator rule is one edit here.

## Artifacts

Split: spec here, code as real file skill copy.

| File                                                                  | Role                          | Copied into workspace as |
| --------------------------------------------------------------------- | ----------------------------- | ------------------------ |
| [`templates/assets/roots.css`](../../../templates/assets/roots.css)   | Root variables (token values) | `assets/roots.css`       |
| [`templates/assets/styles.css`](../../../templates/assets/styles.css) | Screen and print rules        | `assets/styles.css`      |
| [`templates/assets/quiz.js`](../../../templates/assets/quiz.js)       | Reusable quiz widget          | `assets/quiz.js`         |
| [`templates/lesson.html`](../../../templates/lesson.html)             | Lesson skeleton + arguments   | `lessons/NNNN-slug.html` |

Edit template; no fork per lesson. Lesson fill `{{arguments}}` in skeleton — every word on page arrive as argument, none from template ([§ Template arguments](#template-arguments)) — link three local `assets/` file, vary what [Variation](#variation) allow. Nothing more.

## Direction

Course-timetable study instrument, light. Cool blue-gray page, graphite ink, transit blue navigation + calibration signal; vermilion mark route stop, muted brick mark wrong answer. Serif body carry sustained reading, sans label + marginalia, mono code + spaced-repetition result line. Single body column, wide right margin hold citation as sidenote — margin earn width because every claim cite, so citation live beside claim, not inline footnote bomb.

Not cream-and-terracotta default (blue-gray not cream; transit blue not terracotta). Not dashboard blue: transit blue mark route, control, calibration — never drown reading surface. Not broadsheet multi-column (single column + margin; rule is study structure, not newspaper).

Lesson open as route card: header carry vertical transit rule and one vermilion stop, then route navigation name its four stop before retrieval gate. Sequence explain lesson shape without expose sealed body — recall, two thing lesson teach, where it lead. Stop labels are lesson's own word for those four ([Variation](#variation)); the four stop and their order are not.

Voice: two register, never mixed. **This file and every file under `skills/` and `templates/`** carry dropped-article style — deliberate, load-bearing, preserve in edit; no normalize to standard English. **Lesson HTML this file spec** carry the opposite: ordinary standard English, whole sentence, spoken to one learner sitting alone at `file://`. Every `{{argument}}` is that second register, markup attribute included. Author who carry author-facing compression into lesson copy ship telegram to reader who cannot expand it — full rule in [VOICE.md](VOICE.md), which own what go in the container this file spec.

## Icons

Shell carry ten-icon set — heroicons (`@heroicons/react@2.2.0/24/outline`, MIT, source `tailwindlabs/heroicons`), inline `<svg class="icon">` one anchor each. Inline, not sprite — offline-first (no remote `<use href>`), no asset copy step, color via `stroke="currentColor"` token-aware. Selection + authoring in [§ Icon — shell set](#icon--shell-set).

Rules:

- **One icon per anchor.** New icon earn place only where surrounding text already name the gesture; adjacent text carry the meaning, so every icon `aria-hidden="true"`. Decorative, not informational.
- **No sprite file.** Inline bytes <2 KB total across shell; sprite add file copy, asset-staleness entry, and `check_lesson.py` no validate `<use href>` resolve. Add sprite when icon count past ~15 or single lesson repeat icon >3×.
- **No web font, no iconfont.** Banned by `file://` constraint.
- **Print:** summary + lesson-nav icon `display: none` in print CSS — interactive gesture, not content. Callout + synthesis icon print in `--ink`/inherit color.
- **No motion.** Icon never animate; motion budget belong to quiz state, seal release, pointer interaction.

## Layout

Body column (`--measure`) + sidenote column (`--margin-w`), fixed gap. `.lesson` take `width: fit-content` plus bounded outer width, so desktop canvas breathe without whitespace swallow course route. Everything default into body column; sidenote and `h2` opt out. Hairline separate, never box. Sidenote sit right after paragraph that cite it — grid auto-placement land it column 2 same row, beside own claim. Tablet + narrow screen collapse below.

Sidenote live **inside** `.lesson-content`, not after. Two reason, both load-bearing: outside sealed wrapper they read plain while gate shut (citation text leak lesson); and — sealed wrapper single grid item holding whole body — sidenote outside stack below entire lesson only, never beside paragraph. So `.lesson-content` span both column, take `grid-template-columns: subgrid`, re-expose parent two column to paragraph and sidenote nested in it. Where subgrid unsupported, `@supports not` block the wrapper, body fall back one column, sidenote inline below anchor — narrow-screen layout, degradation not break. That fallback must be asked for. Left alone, dropped `subgrid` leave one explicit column, `grid-column: 2` open _implicit_ second track: note beside paragraph at whatever width it take, no gap (`column-gap` on `.lesson`, not wrapper), body squeeze. Not documented degradation — collision.

## Signature — the retrieval gate

Cold open is lesson calibration surface. Body content below it **sealed**: dimmed, blurred, `inert`, small label (`SEAL-LABEL` — lesson own line; CSS literal is fallback). Every cold-open item answered, `quiz.js` drop `.sealed` and `inert` together, body quiet release. Cobalt top rule make one required action visible without game show — embody retrieval-before-instruction, brief core mechanism.

Seal two half, need both. Blur is visible half; `inert` is half that hold. Blur alone gate eye only — Tab still walk sealed lesson, screen reader still read it out, signature become decoration for exact reader who can't see it. `check_lesson.py` enforce pairing (`quiz-releases-not-inert`). Label text come from `data-seal-label` on sealed element, nowhere else — stylesheet keep no English literal behind it, because that fallback only render for lesson that forgot the attribute, and it render in wrong language. Sealed body without it fail instead (`seal-label-missing`).

Instruction need third piece, same reason `inert` exist. Veil label is CSS content **inside** inert subtree, and inert prune that subtree from accessibility tree outright — sentence gate exist to give land nowhere, screen-reader user tab out of cold open into body simply absent, unexplained. So `.seal-note` carry sentence as real text, sibling of quiz, outside seal. It `role="status"` because `quiz.js` swap its text on release: unseal move no focus, own no live region, so otherwise page largest state change silent for everyone not watching. Unlike `.quiz-fb` it start **full** — first string is page copy, read in order; only swap is announcement. Revisit unseal from remembered state, no gate to explain, so that path remove element rather than assert release that didn't happen.

Swap text come from `data-unsealed-label` on `.seal-note`, so translate with lesson, carry one instruction page otherwise never give: **paste result line back**. Without it, cold open end in mono box reading `Cold open 0007-x: 1 right, 2 wrong` beside Copy button, nothing say what either for — spaced-repetition loop depend on learner action lesson never ask for. Slot cost nothing: release announcement had to happen anyway.

Quiet on purpose: faint veil, cobalt rule, small uppercase label. No confetti, no green flash. `prefers-reduced-motion` mean no transition, instant release; veil stay, blur static mask not movement — cancel it, reduced-motion reader read whole sealed lesson at 35% opacity. Seal is state, not performance.

## Variation

Learner who predict page before load stop reading it. Lesson 12 must not be lesson 1 with different word. Template carry argument, not copy ([§ Template arguments](#template-arguments)) — what lesson choose:

- **Every string.** All copy arrive as [template argument](#template-arguments), route stop label and section heading included. String `quiz.js` write at runtime — progress count, undo, copy status — not argument but still not widget's to keep: each take override attribute on `<html>`, set once for whole lesson, and `QUIZ-STRINGS` slot is template reminder they exist at all ([§ Quiz](#quiz)). Callout visible label same case — `data-type` name it in English until `data-callout-label` take over ([§ Callout](#callout)). Between them, nothing English reach non-English learner.
- **Which optional component appear, in what order** — `KNOWLEDGE-BLOCKS` and `SKILLS-BLOCKS` free slot. Callout, figure, self-explanation, aside, worked example, practice quiz, further sidenote: order inside section carry no meaning, so it is lesson's. Gate choice on record state (fading rule), never on variety for own sake.
- **Which optional line appear at all** — argument marked optional ([§ Template arguments](#template-arguments)) drop with its element. Lesson that keep every one is lesson shaped by template.
- **Accent** — `<html data-accent>`, closed set of hue name. Hue only: light, dark, print keep own lightness.
- **Density** — `<html data-density>`, section rhythm only. Short lesson breathe less, long lesson breathe more; component padding and `--measure` never move.

Both hook in [§ Per-lesson hooks](#per-lesson-hooks). Name, never value — colour written into lesson restate token and next edit to `roots.css` miss it. `check_lesson.py` take allowed name from linked stylesheet and fail any other (`unknown-accent`, `unknown-density`); unknown name would otherwise fall back to default and read as correct. Inline `<style>` no widen set — lesson that define own hue rule is the case this rule exist to stop.

What never vary, because it _is_ the course:

- four route stop, in order, on fixed anchor (`#recall`, `#knowledge`, `#skills`, `#where-next`) — `check_lesson.py` enforce count
- cold open before body, body sealed until every item answered (§ [Signature](#signature--the-retrieval-gate))
- section order: Knowledge, Skills, Synthesis, Where next
- three shared `assets/` file, and icon set with its anchor

Test for any change: two lesson from one course side by side, still one product. Two product mean it went too far.

## Constraints

- **Offline** — `file://`, no remote refs; enforced by `check_lesson.py` (see [SKILL.md](../SKILL.md) § Untrusted content). Not restated here — validator is spec.
- **Print**:
  - collapse to one column (margin column no reader on paper)
  - keep `--measure` — paper one medium where reader can't narrow window; unbounded page box 95-character line — and drop block's own padding with it, since `box-sizing` border-box and 2rem a side inside `max-width: --measure` 32rem column, not 36rem; page box has `@page` margin for that
  - unseal content; drop sidenote inline as small footnote
  - drop `.seal-note` — on paper body already open, so line promising it sealed simply false
  - avoid page-break inside quiz item and `pre`
  - colour not load-bearing (B&W print fine)
  - quiz option print as plain list, not hidden — hidden they leave question dangling on em-dash with nothing under it, and printed lesson meant to be worked through; only copy and undo control go
  - sidenote link print URL after title: every claim cite, and citation whose URL never printed is citation reader can't follow
- **Motion** — reduced-motion mean no transition, instant release; blur stay (static mask, not movement). Default motion subtle (seal ~0.2s, quiz state ~0.15s). No scroll reveal, no ambient animation.
- **Responsive** — below desktop reading width: single column, sidenote inline below anchor, cold-open full width, padding shrink, line length stay bounded. Narrow phone shrink outer padding once more; route stay visible and wrap clean.
- **a11y**:
  - visible keyboard focus on every control and every link
  - control boundary on `--rule-2` (3:1), never `--rule`
  - quiz state signal by mark + border, not colour alone
  - answered option `aria-disabled`, still focusable
  - option grouped and labelled by own question
  - sealed body `inert`, not merely blurred
  - nothing inert subtree carry — `::after` label included — reach assistive technology, so gate instruction live outside it in `.seal-note`, and release announce there
  - state change that move no focus announce via `role="status"`, from live region empty and in tree before text arrive
  - focus never dropped by hiding control it sit on (`.quiz-undo` hand it back to chosen option)
  - `prefers-reduced-motion` honoured
  - `forced-colors` opt-out on veil alone, whose background _is_ component (quiz state survive forced palette on its mark)
  - sidenote are `<p>`, never `<aside>`, so citation don't each become landmark
  - `lang` set on `<html>`
  - `<main>` landmark wrap lesson

## Validation

[`check_lesson.py`](../scripts/check_lesson.py) executable contract for static subset of this design — script is spec, so section don't restate its rule.

`scripts/` and `templates/` live at plugin root, alongside `skills/`. During session, working directory is learner workspace, never plugin, so call script through `${CLAUDE_PLUGIN_ROOT}` (substitute direct in this skill content), not hand-resolved path.

- `python "${CLAUDE_PLUGIN_ROOT}/skills/teach/scripts/check_lesson.py" --self` — run after editing template; validate `templates/lesson.html` against contract (must pass; catch spec/validator mismatch).
- `python "${CLAUDE_PLUGIN_ROOT}/skills/teach/scripts/check_lesson.py" <lesson-path>` — validate generated lesson for conformance (quiz structure, offline no-remote-refs, a11y static check). Step 6 of [SKILL.md](../SKILL.md) run this on every lesson before opening it.
- `python "${CLAUDE_PLUGIN_ROOT}/skills/teach/scripts/check_lesson.py" --type=reference <path>` — same for reference document; skip quiz and cold-open rule.

Shared asset carry `teach-template-version` stamp. Bump every shared asset stamp on release that require copied workspace asset change; `teach.py state` report stale copy (detect-only; never overwrite per-workspace topic component). Validator check document contract only. Worked-example, synthesis, callout, figure and details component are authoring guidance, not machine-enforced — offline media inside figure still caught by existing remote/missing-asset check.

Static subset (quiz structure, offline, a11y) machine-enforced here. Non-static concern (result-line shape, print layout, motion, component content) enforced by template-as-source and [Components](#components), not this script.

## Reference docs

`reference/*.html` link same stylesheet, drop cold-open + sealed wrapper, lean on print CSS — read and printed, not worked through. Same token and component; no separate identity.

## Tokens

Token role and rationale for lesson CSS. Value live in [`templates/assets/roots.css`](../../../templates/assets/roots.css) `:root` — single source. Edit there; never restate value here or anywhere. Name and role only, on purpose. Value drift when restated.

| Token           | Role                                 |
| --------------- | ------------------------------------ |
| `--paper`       | cool blue-gray page surface          |
| `--paper-2`     | pale field, cold-open field, code    |
| `--paper-3`     | deeper field, route bar              |
| `--ink`         | graphite body text                   |
| `--ink-soft`    | secondary text, marginalia           |
| `--rule`        | hairlines                            |
| `--rule-2`      | control boundaries (quiz options)    |
| `--accent-h`    | accent hue — the one per-lesson knob |
| `--accent`      | cobalt — gate, correct, links        |
| `--accent-bg`   | cobalt tint — active control bg      |
| `--signal`      | vermilion — route stop, release edge |
| `--wrong`       | wrong (muted brick, never alarm-red) |
| `--success`     | correct (muted green)                |
| `--serif`       | body face (sustained reading)        |
| `--sans`        | labels and marginalia face           |
| `--mono`        | code and result-line face            |
| `--s-1`…`7`     | space ladder — margins and padding   |
| `--measure`     | body line length                     |
| `--margin-w`    | sidenote column width                |
| `--radius`      | corner radius, controls and code     |
| `--radius-sm`   | small radius — option markers        |
| `--tap`         | minimum touch target (44px)          |
| `--stop-size`   | route-stop circle diameter           |
| `--rule-thin`   | 2px — hairlines, focus outlines      |
| `--rule-thick`  | 3px — accent stripes, feedback bars  |
| `--ease-out`    | standard easing curve                |
| `--ease-spring` | spring easing — press transforms     |
| `--shadow-sm`   | hairline elevation                   |

Why these token, not others:

- **System-only type stacks.** Web font banned on `file://` — no CDN, no remote `@import`, cable unplugged, page still render. Serif stack ship on Windows + macOS, degrade clean; sans and mono ride OS default. No web font worth network dependency brief forbid.
- **`--measure` bound line length** for sustained reading. Width typographic decision, not layout accident — body column past ~36rem stop being read, start being scanned.
- **`--margin-w` earn its width** because every claim cite. Citation live beside claim as sidenote, not bunch as inline footnote bomb. Margin structural, not decorative.
- **`--wrong` muted oxblood, never alarm-red.** Wrong answer teaching signal, not emergency. Red shout; oxblood correct quiet, keep page calm.
- **One space ladder, not free value.** Structural gap come off `--s-*`; rare quarter-rem optical adjustment stay beside component it tune. Type size live at use — page has few roles, named ladder hide more than help.
- **`--accent-h` is hue alone, not second accent.** Light, dark, print each set own `--accent` lightness and chroma; per-lesson rule setting `--accent` outright out-specify all three and drag light-mode colour into dark. Hue is the one part safe to vary, so only part that vary.
- **`--rule-2` exist because `--rule` too faint to be edge.** Hairline separate; control boundary must be _found_. Quiz option border only thing saying "this is clickable", `--rule` sit near 1.5:1 on paper — under 3:1 control boundary owe. Two token, two job; never use `--rule` on interactive edge.

## Per-lesson hooks

Two attribute on `<html>`, both optional, both a **name from closed set** — never value. Value live in `roots.css` beside token they move, so one edit there move every lesson that pick that name. Rationale and identity limit: [§ Variation](#variation).

| Attribute      | Values                                       | Moves                                                                                 |
| -------------- | -------------------------------------------- | ------------------------------------------------------------------------------------- |
| `data-accent`  | `cobalt` (default), `teal`, `violet`, `plum` | `--accent-h`, and so `--accent` (and `--accent-bg` in dark, where the tint carry hue) |
| `data-density` | `compact`, `roomy`                           | `--s-5`, `--s-6`, `--s-7` — section rhythm                                            |

Attribute absent read as default; lesson wanting default drop attribute rather than spell it. Density has no `default` name for that reason — base `:root` is it, and name would restate value already living there.

`check_lesson.py` read allowed name straight out of linked CSS and fail lesson using any other (`unknown-accent`, `unknown-density`) — misspelt name would otherwise render default and look correct. Add name to `roots.css` and it is allowed; this table is documentation, never source, and the one table — template and [the argument table](#template-arguments) point here rather than restate name, so fifth copy cannot drift.

`<html>` carry third kind of hook that is no token: `data-*` override for word `quiz.js` write, which `QUIZ-STRINGS` slot above the tag exist to remind ([§ Quiz](#quiz)). Same element, different layer — string, not value.

`--signal` take no hook: vermilion mark route stop and release edge in every lesson, and that is course identity, not lesson choice.

## Components

Spec for every reusable block a generated lesson emit. Every component here plain HTML + shared stylesheet; nothing need new script. Offline-only, print-friendly — see [§ Constraints](#constraints). Markup shape here, wording in [VOICE.md](VOICE.md): every block below is filled with standard English written to one learner, and personality belong to that copy — word choice, example, analogy — never to new component, emoji, colour or motion. Nothing in VOICE.md license a widget.

## Template arguments

[`templates/lesson.html`](../../../templates/lesson.html) is skeleton plus argument — no fixed lesson copy left in it. Two brace form, one convention:

- `{{UPPER-KEBAB}}` — **named argument**, table below. Wording is lesson's, never template's.
- `{{lowercase prose}}` — fill-in guidance at point of use (sidenote line, synthesis point). Not named, not tabled.

Argument marked _optional_ in table drop with element that hold it — that is the point, one fewer fixed line every lesson repeat. Every other one fill.

Both gone from finished lesson: `check_lesson.py` reject any surviving `{{` (`unfilled-placeholder`), except inside `<pre>`/`<code>`, where lesson teaching brace-syntax template language need them. What lesson may vary beyond copy — optional block choice and order, accent, density — and what it may not: [§ Variation](#variation).

| Argument                                                               | Slot                                 | Fill with                                                                                                             |
| ---------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `LANG`                                                                 | `<html lang>`                        | BCP-47 tag of language lesson written in                                                                              |
| `ACCENT`                                                               | `<html data-accent>`                 | name from [§ Per-lesson hooks](#per-lesson-hooks) — never colour; drop attribute for default                          |
| `DENSITY`                                                              | `<html data-density>`                | name from same table; drop attribute for default                                                                      |
| `QUIZ-STRINGS`                                                         | comment above `<html>`               | optional — `data-*` override this lesson need for word `quiz.js` write ([Quiz](#quiz)) go on `<html>`; delete comment |
| `TITLE`                                                                | `<title>`, `h1`                      | lesson title                                                                                                          |
| `TOPIC`                                                                | `<title>`                            | course topic                                                                                                          |
| `EYEBROW`                                                              | `.lesson-header .eyebrow`            | where lesson sit, e.g. `Lesson 4 · ownership`                                                                         |
| `LEAD`                                                                 | `.lead`                              | one thing lesson land — see [Lead](#lead)                                                                             |
| `ROUTE-LABEL`                                                          | `.toc` `aria-label` + `.toc-eyebrow` | what route called; same string both slot                                                                              |
| `STOP-1`…`STOP-4`                                                      | route stops, and `h2` of section 2–4 | [Lesson route](#lesson-route)                                                                                         |
| `RECORD-ID`                                                            | `<!-- cold-open: … -->`              | `NNNN-slug` of record each item test — one pair per `.quiz-item`                                                      |
| `COLD-OPEN-TITLE`, `COLD-OPEN-INTRO`                                   | `.cold-open`                         | [Cold open](#cold-open)                                                                                               |
| `COLD-OPEN-EYEBROW`                                                    | `.cold-open .eyebrow`                | optional — drop `p` when title carry it; [Cold open](#cold-open)                                                      |
| `QUIZ-LABEL`                                                           | `.quiz` `data-label`                 | head of result line; free text, scoring key on id that follow it                                                      |
| `LESSON-ID`                                                            | `.quiz` `data-lesson`                | own file stem, `NNNN-slug`                                                                                            |
| `QUESTION`, `OPT`, `FEEDBACK`                                          | `.quiz-item`                         | [Quiz](#quiz)                                                                                                         |
| `COPY-LABEL`                                                           | `.quiz-copy`                         | copy-control label                                                                                                    |
| `SEAL-NOTE`, `UNSEALED-LABEL`                                          | `.seal-note`                         | [§ Signature](#signature--the-retrieval-gate)                                                                         |
| `SEAL-LABEL`                                                           | `.lesson-content` `data-seal-label`  | veil own line — only text veil have, so sealed body without it fail (`seal-label-missing`)                            |
| `BODY`                                                                 | first `<p>` under Knowledge          | [SKILL.md](../SKILL.md) `## Knowledge` authoring rules                                                                |
| `URL`                                                                  | sidenote and body links              | citation target                                                                                                       |
| `KNOWLEDGE-BLOCKS`, `SKILLS-BLOCKS`                                    | after the Knowledge / Skills `h2`    | optional component this lesson earn, in order it earn them                                                            |
| `SYNTHESIS-TITLE`, `SYNTHESIS-PROMPT`                                  | `.synthesis`                         | [Synthesis](#synthesis)                                                                                               |
| `WHERE-NEXT`, `FOLLOW-UP`                                              | Where next                           | [Where next](#where-next)                                                                                             |
| `NAV-LABEL`, `PREV-LABEL`, `NEXT-LABEL`                                | `.lesson-nav`                        | navigation labels                                                                                                     |
| `PREV-LESSON`, `PREV-LESSON-TITLE`, `NEXT-LESSON`, `NEXT-LESSON-TITLE` | `.lesson-nav`                        | neighbour file stem and title; no neighbour → drop that whole `.lesson-nav-cell`                                      |

## Lesson route

`.toc`, four ordered stop. Each anchor own square number; route show lesson scope before cold open, never dense global navigation. Four-stop route load-bearing — `check_lesson.py` fail lesson carrying any other count (`route-four-stops`). Anchor fixed with it: `#recall`, `#knowledge`, `#skills`, `#where-next`.

Stop **labels** are lesson's, through `STOP-1`…`STOP-4`. One label per stop, used twice: route stop 2–4 and `h2` of section it point at. Two name for one stop — route saying "Understand" over heading saying "Knowledge" — is the vocabulary drift this replace. Keep same four label across course; they translate once, not per lesson. Synthesis close lesson but is not route stop.

Stop 1 point at cold open. Lesson with nothing due carry none (see below) — then `id="recall"` ride on `.lesson-header` and `STOP-1` name what lesson actually open with.

## Cold open

`.cold-open`, `--paper-2` calibration field, transit-blue top rule, fine frame. `COLD-OPEN-TITLE` label it — over optional `COLD-OPEN-EYEBROW`, which drop with its `p` when title already say where block sit; three stacked label on one small field is the sameness this template exist to avoid. `COLD-OPEN-INTRO` is one plain sentence explaining answer-from-memory and release condition. Hold quiz. Field span both column; what it hold stay bound to `--measure`, so cold-open quiz and practice quiz further down same lesson one component at one width, ✓ mark stay next to word it mark.

**No due record, no cold open** ([SKILL.md](../SKILL.md) step 5). Then drop whole `.cold-open` section and `.seal-note` with it, drop `sealed`, `inert` and `data-seal-label` off `.lesson-content`, re-anchor stop 1 per [Lesson route](#lesson-route). Half-dropping is the failure: sealed body with no quiz to release it is lesson nobody can open, and `check_lesson.py` fail it (`sealed-never-released`) — missing anchor separate catch, `broken-anchor`.

## Lead

`.lead` on opening paragraph. One thing lesson land, set above body size. At body size it read as first paragraph, not claim rest of page argue. `.lead` is output of reconciliation, not restatement of first source — nor restatement of the title above it, and never announcement of what lesson will do. Title already name topic; warm-up line under it is padding ([VOICE.md](VOICE.md) rule 8). Open on the claim.

## Quiz

Shape only:

```html
<div class="quiz" data-releases="contentId" data-label="…" data-lesson="NNNN-slug">
  <div class="quiz-item" role="group" aria-labelledby="q1" data-correct="0">
    <p class="quiz-q" id="q1">…</p>
    …<button class="quiz-btn" type="button">…</button>…
  </div>
  <p class="quiz-result" role="status"></p>
  <button class="quiz-copy" type="button" hidden>…COPY-LABEL…</button>
</div>
<p class="seal-note" role="status">…</p>
```

`.quiz-result` carry **no** `hidden` — `quiz.js` never unhide it, so hidden mean one result line, and scoring affordance, nobody ever see. `role="group"` + `aria-labelledby` tie option to own question: three sibling button carry no question with them, so on item 2 of 3 screen reader otherwise offer bare option list.

Two to four `.quiz-btn` per item; count is lesson's, `data-correct` 0-based index into it, `check_lesson.py` range-check the pair. Equal-width `.quiz-btn` option so formatting never leak answer (rule from [SKILL.md](../SKILL.md) `## Skills`; same character-count per option where possible). Right/wrong carry mono ✓/✗ mark plus border + tint — border colour and tint both colour, mark what keep state readable without it. Answered option carry `aria-disabled`: still focusable, mark stay reachable, but no longer offer action that do nothing. Result line and per-item feedback `role="status"`: both appear without focus moving, unannounced result line is result line screen-reader user never learn exist — so both start **empty and in tree**, `quiz.js` fill them. Live region arriving already full is case screen reader most often miss. `.quiz-fb` keep its `hidden` and authored text in markup, what no-JS page need; init hoist that text into JS and empty element. Copy control must work on `file://` — no copy control, no spaced-repetition loop. This section is quiz contract; [`templates/assets/quiz.js`](../../../templates/assets/quiz.js) implement it.

**Labels.** Every string `quiz.js` write into page live in one place — its `DEFAULTS` map — and every one take override attribute. Put attribute **on `<html>`** and it cover whole lesson; put it on one `.quiz` and that quiz win, because widget resolve with `closest()`. So non-English course set what it need beside `lang` once, never fork widget. `QUIZ-STRINGS` comment above `<html>` is the reminder they exist: fill attribute onto `<html>` and delete it, or delete it unfilled when course English — either way `check_lesson.py` catch lesson that ignored it.

Restating default in markup is second copy that drift, so lesson spell out only what it change. Template spell out two, both for reason default cannot cover: `data-label`, which genuinely differ between cold open and practice quiz in same lesson, and `data-unsealed-label`, which carry paste-back instruction default (`Lesson unsealed.`) leave out — see [§ Signature](#signature--the-retrieval-gate).

| Attribute                | Fills                                    | Default                                                           |
| ------------------------ | ---------------------------------------- | ----------------------------------------------------------------- |
| `data-label`             | head of the result line (`QUIZ-LABEL`)   | `Cold open`                                                       |
| `data-progress-label`    | `.quiz-progress`, any quiz past one item | `{n} of {total} answered`                                         |
| `data-undo-label`        | undo control; countdown append to it     | `Undo`                                                            |
| `data-copied-label`      | copy control, briefly, after a copy      | `Copied`                                                          |
| `data-copied-status`     | `.quiz-copy-status` after a copy         | `Result copied. Paste it into your next message to your teacher.` |
| `data-copy-failed-label` | `.quiz-copy-status` after a failed copy  | `Copy failed. Result selected; copy it manually.`                 |
| `data-unsealed-label`    | `.seal-note` once the body release       | `Lesson unsealed.`                                                |

`{n}` and `{total}` fill from widget. Keep slot, move it where sentence need it — translation own its own word order, which is why widget never glue number onto fragment.

`teach.py score` key on `NNNN-slug` at end of head, never on `data-label` word, so translating label cannot break scoring.

**Feedback content (load-bearing).** Per-item feedback text must state _why_ correct option correct and _why_ chosen wrong option wrong, not merely confirm or reject. High-information gain live in this text (Wisniewski 2020: d=0.99 high-information vs d=0.24 reinforcement-only); scoring result line is KR-level (right/wrong count) for scheduling, not learning, so per-item feedback carry all specificity. Authoring rule, not markup change — `.quiz-fb` slot already exist.

Voice bite hardest here: learner read this line at the moment they got it wrong. Name mechanism, never verdict, and never praise — "Great job! Option B is correct" carry no information and read as chatbot; "Yes. `git revert` adds a commit that undoes the old one, so shared history survives; `git reset` rewrites it" carry the lesson. Feedback also never reference option by letter alone, since option order is lesson's. Pair in [VOICE.md § Before and after](VOICE.md#before-and-after).

**Undo window.** Answer not final instant clicked. Chosen option go to neutral `data-state="chosen"` mark, `.quiz-undo` appear, item lock three second later. Nothing about answer reveal inside that window — no right/wrong, no correct option, no feedback. Reveal-then-undo hand back free retry with answer already on screen, and that one thing retrieval measurement can't survive. Once locked, no retry: window buy back tap, never recall. Reason it exist: this line reschedule memory record, so mis-tap noise recorded as signal.

Copy control show only on first pass through gated cold open — revisit unseal from remembered state, practice quiz never gate, so neither produce line worth pasting. Successful copy announce learner paste result into next message to teacher. `data-lesson` bind line to own lesson.

## Worked example

`.worked-example` in Skills section — single highest-leverage cognitive-load technique for written instruction, and the one an adaptive system can taper as expertise grow (expertise reversal: worked example become redundant load for competent learner and can reverse — Kalyuga; Sweller/van Merriënboer/Paas). One fully worked example, then parallel bare problem. Density scale with record state — see [SKILL.md](../SKILL.md) `## Skills` fading rule.

```html
<div class="worked-example">
  <p class="we-problem">…one problem statement…</p>
  <ol class="we-steps">
    <li>
      <span class="we-action">…do this…</span>
      <span class="we-why">— principle that justify the step…</span>
    </li>
    …
  </ol>
  <p class="we-takeaway">…one-line takeaway…</p>
</div>
```

Each step carry the _why_, not just the _what_ — process-oriented example improve far transfer (van Gog). Style as ordered list with cobalt left rule, mirroring `code` block so it read as one component. No inline bold — `.we-action` is run-in label (see Emphasis below).

## Self-explanation reveal

Open-ended prompt after Knowledge or at worked-step boundary, with model-answer reveal. Must be open-ended (free reveal), **not** multiple-choice — meta-analysis show MC self-explanation prompt fail (Bisra 2018: MC g=0.24 ns; open-ended g=0.67). Reuse native `<details>`:

```html
<details class="self-explain">
  <summary>
    <svg class="icon icon-closed" viewBox="0 0 24 24" aria-hidden="true">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"
      />
    </svg>
    <svg class="icon icon-open" viewBox="0 0 24 24" aria-hidden="true">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3"
      />
    </svg>
    In your own words: why does … hold?
  </summary>
  <div class="self-explain-model">…model answer…</div>
</details>
```

Distinct from cold open: cold open test prior record; self-explanation elaborate current lesson. Keep one per non-trivial worked step or concept; not new widget, just `<details>` with shared style. Summary carry closed/open icon pair as first child — `arrow-uturn-left` (closed), `arrow-uturn-right` (open) — decorative, both rendered, CSS toggle one off on `[open]`; `<summary>` text adjacent already name what unlock. Lesson language switch carry icon shape, not CSS `+`/`−` glyph.

## Details — optional depth

Native `<details>`/`<summary>` for genuinely optional deeper content (worked derivation, edge case, longer aside) inside body. Offline, print sensibly, no JS. Cap one nesting level. Label `summary` with real information scent ("How we chose this threshold"), never hide prerequisite. Self-explanation (above) is primary use; plain `<details class="aside">` serve other optional depth.

```html
<details class="aside">
  <summary>…same closed/open icon pair as above…How we chose this threshold</summary>
  …
</details>
```

## Synthesis

`<section class="synthesis">` between Skills and Where next — consolidation slot. Student-led synthesis in final stretch protect retention (Villarreal 2025; ICAP constructive above passive); re-stating rule after practice consolidate schema (LearnLab example-rule coordination). Not route stop — four-stop route stay four.

```html
<section class="synthesis" id="synthesis">
  <h2>
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">…sparkles…</svg>…SYNTHESIS-TITLE…
  </h2>
  <ul class="synthesis-points">
    <li>…core idea, one line…</li>
    …3–5…
  </ul>
  <p class="synthesis-rule">…re-state the core rule in light of what practice showed…</p>
  <p class="synthesis-prompt">
    …SYNTHESIS-PROMPT: say it back in your own words, then have it checked…
  </p>
</section>
```

Prompt is retrieval nudge feeding spaced-repetition loop. Keep "Where next" navigation-only; synthesis carry consolidation.

3–5 is count of idea lesson actually landed, never triad padded to three because three sound complete ([VOICE.md](VOICE.md)). Point are plain sentence, not bolded label with colon. Close on last concrete thing — encouragement paragraph ("you're well on your way") is the send-off tic, and it displace the retrieval nudge that earn this slot.

## Callout

`.callout`, typed aside for common pitfall, by-the-way, optional better way, or irreversible action. No sanctioned home for these existed, so warning got buried as prose or bold got abused.

```html
<div class="callout" data-type="warning" role="note">
  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
    />
  </svg>
  <p>…</p>
</div>
```

`data-type`: `note` (by-the-way), `tip` (optional better way), `warning` (common pitfall), `caution` (irreversible / data-loss). Left rule reuse `--accent`/`--signal`/`--wrong` by type; sans label, kept short.

Cap one or two per lesson, never stacked, placed beside content it qualify — visually distinct from citation sidenote (full-width block, not margin). Each callout carry type-specific `<svg class="icon">` as first child — `information-circle` (note), `light-bulb` (tip), `exclamation-triangle` (warning), `lock-closed` (caution) — decorative (`aria-hidden="true"`); adjacent text label and stripe colour carry meaning. Path data copy from heroicons/24/outline.

Printed label is type name itself, so bare `data-type` ship English word into every callout. Add `data-callout-label="…"` and lesson word win — non-English course need it, and lesson wanting `Pitfall` over `Warning` may take it. Stripe colour and icon still key on `data-type`, so type stay type. Not plain `data-label`: `quiz.js` resolve that name through `closest()`, so quiz inside callout would take callout word as its result-line head.

## Figure — diagram

Optional `<figure class="diagram">` for inline SVG or local `assets/` image. Word + image beat word alone — most robust CTML finding (Mayer 2024, 200+ experiments) — and inline SVG fit `file://` with no dependency. Gate on record state like worked-example rule: graphic help low-knowledge learner but **hamper** high-knowledge (Vogt 2020, expertise reversal), so no diagram in lesson a competent learner see.

```html
<figure class="diagram">
  <svg viewBox="0 0 320 180" role="img" aria-labelledby="d1-title">
    <title id="d1-title">…</title>
    …
  </svg>
  <figcaption>
    …caption; cite the claim it illustrate via <a class="cite" href="#n1">1</a>…
  </figcaption>
</figure>
```

Local image take same frame — `<img src="assets/…png" alt="…" />` in place of `<svg>`, asset copied into workspace `assets/` first.

Offline enforced by `check_lesson.py` (any `<img>`/`srcset` remote or missing fail). Prefer inline SVG — no asset to copy, no stale-asset drift. The "diagram helper" named in [SKILL.md](../SKILL.md) `## Assets` is reusable SVG component in `assets/`, not script.

## Analogy

Authoring rule, not new block: when introducing concept via analogy, (1) name source and target, (2) explicitly map correspondence — small 2-column table or short list, (3) name at least one place analogy break (`unlike: …`). Analogy help only when correspondence mapped _and_ breakdown point named (Gentner structure-mapping; FAR guide). Render "where it fails" line as `.callout` `data-type="note"`. Mapping itself plain table (see prose-vs-table rule in [SKILL.md](../SKILL.md) `## Knowledge`).

Analogy is mapped; aphorism is not. `X is the Y of Z` with no correspondence and no breakdown line is the formula this rule exist to stop — it sound explanatory and teach nothing ([VOICE.md](VOICE.md)). Analogy is also where a lesson's personality legitimately live: source domain is yours to pick, and a well-chosen one can be funny. Funny in the mapping, never in the claim the mapping support — every claim still cite.

## Emphasis

Emphasis authoring rule: see [SKILL.md](../SKILL.md) `## Knowledge`. Heading carry scan weight, not inline bold — no bold to "make important". `.lead` italic by stylesheet, not by author hand.

## Citations

```html
<p>…claim…<a class="cite" href="#n1">1</a></p>
<p class="sidenote" id="n1">¹ <a href="…">Author, Title</a> — one line on what it covers.</p>
```

One `.sidenote` per citation, numbered in order, each right after paragraph that cite it — count is lesson's, template ship exactly one as the shape. Lesson with six claim carry six; Where next citing nothing carry none there. Sidenote live inside `.lesson-content` ([§ Layout](#layout)).

Inline `a.cite` number is real link to own `.sidenote` (`id="n1"`, `n2`, … in order); note itself sans, small, `--ink-soft`, hairline left rule, and `<p>` rather than `<aside>` — aside here scoped to no sectioning element, so each note land as own `complementary` landmark, finished lesson bury `<main>` under dozen of them. `a.cite` take inline padding with cancelling negative margin: vertical padding on inline box don't touch line box, so tap target grow from 8px to something findable without pixel of reflow. Matter on phone, one place note moved away from claim it belong to. Beside paragraph, pairing obvious; on phone and paper note moved below claim, matching numeral only thing tying claim to source.

## Knowledge / Skills

`h2` section with route-stop mark and `--rule` hairline above (structural divider, not decoration). Knowledge first, skill second. Knowledge section manage intrinsic load (one tightly-scoped thing); Skills section reduce difficulty for high-element-interactivity task — worked example then fading — corollary of desirable difficulty living in cold open (Pyke 2024): difficulty desirable for low-element-interactivity retrieval, reduced for high-element-interactivity skill.

## Code

`--mono` on `--paper-2`, 4px cobalt left rule, horizontal scroll.

## Where next

Final block: one primary source (highest-trust thing found), cross-link to related lesson and reference doc by anchor, line invite follow-up question. Navigation only — consolidation live in [Synthesis](#synthesis). Wording is lesson's (`WHERE-NEXT`, `FOLLOW-UP`); four link shape are not, because lesson live in `lessons/` and every relative depth here is link `check_lesson.py` will call broken:

```html
<a href="https://…">…primary source…</a>
<a href="NNNN-slug.html">…related lesson…</a>
<a href="../reference/slug.html#anchor">…reference doc…</a>
<a href="../index.html">…course home…</a>
```

## Icon — shell set

Inline heroicons (`@heroicons/react@2.2.0/24/outline`, MIT, source `tailwindlabs/heroicons`). One `<svg class="icon">` per anchor, `aria-hidden="true"`, path data copied verbatim from `heroicons/optimized/24/outline/<name>.svg`. Colour via `stroke="currentColor"` — callout and route hook set `color` token-specific. This selection is only sanctioned shell set; lesson reach for different icon only at `<figure class="diagram">` (gated on record state per [Figure](#figure--diagram)) with same inline approach.

| Icon                   | Where                                     | Why                                        |
| ---------------------- | ----------------------------------------- | ------------------------------------------ |
| `academic-cap`         | `.lesson-header > .eyebrow`               | "Lesson" affordance — study instrument     |
| `arrow-long-left`      | `.lesson-nav-link` previous               | paired glyph replaces `←`                  |
| `arrow-long-right`     | `.lesson-nav-link` next                   | paired glyph replaces `→`                  |
| `exclamation-triangle` | `.callout[data-type="warning"]`           | common-pitfall glyph                       |
| `light-bulb`           | `.callout[data-type="tip"]`               | optional-better-way glyph                  |
| `information-circle`   | `.callout[data-type="note"]`              | by-the-way glyph                           |
| `lock-closed`          | `.callout[data-type="caution"]`           | irreversible-action glyph                  |
| `arrow-uturn-left`     | `.self-explain` / `.aside` summary closed | universal expand affordance                |
| `arrow-uturn-right`    | same, open                                | universal collapse affordance              |
| `sparkles`             | `.synthesis > h2`                         | consolidation marker; vermilion `--signal` |

Wrapper, drop into any use site:

```html
<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
  <path stroke-linecap="round" stroke-linejoin="round" d="…path from heroicons repo…" />
</svg>
```
