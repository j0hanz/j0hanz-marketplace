# HTML Report Format

Architectural review = one HTML file in OS temp dir, self-contained except pinned Mermaid import. Look lives in [report.html](report.html): stylesheet, Mermaid script, empty `<main>`. Write only what goes inside `<main>`.

## Direction

Glossary already geological: **depth**, **seam**, **layer**, **leak**. Report uses tonal surfaces and structural left/top bars instead of box-border grids so diagrams carry the visual weight. Each module in a **core sample** renders as two proportional bands: a solid blue interface cap over a tonal implementation body, so a shallow module reads as a top-heavy stubby core and a deep one as a tall column under a thin cap.

Blue = interface and target deepened state. Red = leak. Deep tonal fill + heavy bar = deep module. Dashed stroke = seam or absorbed internal call. Dark mode follows reader's system setting.

## Build

1. Copy `report.html` from this skill's dir to `<tmpdir>/architecture-review-<timestamp>.html` with shell command (`cp`, or `Copy-Item` on Windows). Don't retype.
2. Replace `REPO` in its `<title>`.
3. Replace `<!-- REPORT: … -->` comment inside `<main>` with title block, then one `<article>` per candidate.

Only network request = Mermaid, pinned to exact version. Without it, each diagram shows readable source text.

## Vocabulary

All classes and `data-` attributes stylesheet knows. Use no others, no inline styles except core's counts. `id`, `href` and `aria-` attributes in examples are plain HTML.

| Markup                    | Means                            |
| :------------------------ | :------------------------------- |
| `class="label"`           | Muted section label              |
| `class="row"`             | Items in wrapping line           |
| `class="files"`           | File path chip list              |
| `class="cores"`           | Holds core samples               |
| `class="core"`            | One core sample                  |
| `class="box"`             | One module in collapse diagram   |
| `class="mermaid"`         | Mermaid source, on `<pre>`       |
| `data-strength`           | `strong`, `worth`, `speculative` |
| `data-kind`               | Mark; see next table             |
| `id="top-recommendation"` | Title block's start-here cell    |

| `data-kind` | Valid on                                                    |
| :---------- | :---------------------------------------------------------- |
| `deep`      | Key item, core, box, cross-section band                     |
| `internal`  | Box                                                         |
| `leak`      | Key item, box                                               |
| `module`    | Key item only (unmarked core, box or band already = module) |
| `interface` | Key item only                                               |
| `seam`      | Key item only                                               |

Plain elements carry rest. In card: `<dt>` = label, `<code>` in badge row = dependency tag, `<aside>` = ADR callout. In figure: each `<section>` = one pane, its `<h3>` = pane label, `<ol>` = cross-section.

## Title block

First screen answers "which one do I explore?" Title block holds four sections, in order: identity bar, top recommendation, candidate index, diagram key. No intro paragraph.

```html
<header>
  <div>
    <h1>{{repo name}}</h1>
    <p class="row">
      <span>2026-10-27</span><span>Scope: src/orders, src/pricing</span><span>3 candidates</span>
    </p>
  </div>
  <section id="top-recommendation" aria-labelledby="top-title">
    <p class="label">Start with</p>
    <h2 id="top-title"><a href="#order-intake">Collapse the Order intake pipeline</a></h2>
    <p>Pricing leaks across four seams; one deep module ends it.</p>
  </section>
  <nav aria-label="Candidates">
    <p class="label">Candidates</p>
    <ul>
      <li class="row">
        <a href="#order-intake">Collapse the Order intake pipeline</a>
        <span data-strength="strong">Strong</span>
      </li>
    </ul>
  </nav>
  <div>
    <p class="label">Diagram key</p>
    <ul class="row">
      <li data-kind="module">module</li>
      <li data-kind="deep">deep module</li>
      <li data-kind="interface">interface</li>
      <li data-kind="seam">seam</li>
      <li data-kind="leak">leak</li>
    </ul>
  </div>
</header>
```

Top recommendation holds candidate's linked name + one sentence on why. Nothing else.

## Candidate card

Diagrams carry weight. Prose sparse, plain, uses glossary terms (from `groundwork:codebase-design` skill) without ceremony.

Each candidate = one `<article>` with `id` title block links to. Keep parts in order:

- **Title**: `<h2>` naming deepening (e.g. "Collapse the Order intake pipeline").
- **Badge row**: strength mark, then dependency category as `<code>`: `in-process`, `local-substitutable`, `ports &amp; adapters`, or `mock`. Strength text: `Strong`, `Worth exploring` or `Speculative`.
- **Files**: `<ul class="files">`, one path per item.
- **Before / After**: `<figure>` with two `<section>` panes + `<figcaption>`. See diagram patterns below.
- **Problem** and **Solution**: one sentence each, in `<dl>` with one `<div>` per term.
- **Wins**: plain `<ul>`, max 6 words per bullet. Sits beside `<dl>` on wide screens.
- **ADR callout**, if applies.

```html
<article id="order-intake" aria-labelledby="order-intake-title">
  <h2 id="order-intake-title">Collapse the Order intake pipeline</h2>
  <p class="row"><span data-strength="strong">Strong</span><code>in-process</code></p>
  <ul class="files">
    <li>src/orders/handler.ts</li>
    <li>src/orders/validator.ts</li>
  </ul>
  <figure>
    <section>
      <h3>Before</h3>
      …diagram…
    </section>
    <section>
      <h3>After</h3>
      …diagram…
    </section>
    <figcaption>
      One sentence on what the two diagrams show, with the counts behind them.
    </figcaption>
  </figure>
  <dl>
    <div>
      <dt>Problem</dt>
      <dd>Order intake module is shallow: interface nearly matches the implementation.</dd>
    </div>
    <div>
      <dt>Solution</dt>
      <dd>Deepen: one interface, one place to test.</dd>
    </div>
  </dl>
  <ul>
    <li>Locality: bugs concentrate in one module</li>
  </ul>
  <aside><strong>Contradicts ADR-0007</strong>, but worth reopening: …</aside>
</article>
```

`<figcaption>` = diagram's text alternative. Write so reader who can't see panes gets same point. No explanation paragraphs beyond it. If diagram needs paragraph to be understood, redraw diagram.

## Escaping

File names and identifiers come from code, may contain `<`, `>`, `&`.

- In HTML, write `&lt;`, `&gt;`, `&amp;`.
- In Mermaid label, quote label and write `#lt;`, `#gt;`, `#amp;`. Mermaid strips HTML entity like `&lt;`: `Repo&lt;Order&gt;` renders as `Repo`.
- Outside Mermaid labels, write arrows raw (`-->`, `->>`).

## Diagram patterns

Pick pattern fitting each candidate, vary across report. Panes stack on phone, sit side by side on wide screen.

### Core sample (shallow vs deep)

Use when point is "interface as wide as implementation". Count module's names:

- `--iface` = number of exported names (top blue cap).
- `--impl` = number of internal names: non-exported functions and methods (bottom tonal body).
  Each band scales at `0.75rem` per count, capped at 14. If any module in figure passes 14, divide every count in that figure by same factor so heights still compare. Both bands use same unit, so proportion tells truth. Text inside core = its label.

```html
<div class="cores">
  <div class="core" style="--iface: 5; --impl: 4">OrderHandler</div>
</div>
```

Before pane: one core per shallow module. After pane: single deep core with `data-kind="deep"`. State real counts in `<figcaption>`.

### Mermaid graph (dependencies and call flow)

Use `flowchart` when point is "X calls Y calls Z, look at mess". Prefer `flowchart TD`: wide `LR` graph scrolls sideways in pane. Use `sequenceDiagram` for "before: 6 round-trips; after: 1"; carries no leak or seam marks, so caption names them. Start each diagram with `accTitle` and `accDescr` so screen readers get name.

In flowchart:

- Leaking edge gets label `leak` (`A -- leak --> B`). Then colour with `linkStyle`. Edge indexes count from 0 in source order, so recount before writing index.
- Dashed edge (`-.->`) = seam.
- Deep module gets `classDef deep fill:var(--surface-deep),stroke:var(--accent),stroke-width:3px` and `class <node> deep`.

Write colours as `var(--token)`. Template swaps in theme value before Mermaid parses diagram.

```html
<pre class="mermaid">
flowchart LR
  accTitle: Order intake before
  accDescr: The handler reaches pricing through the repo, past the seam
  A["OrderHandler"] --> B["OrderValidator"]
  B --> C["OrderRepo#lt;Order#gt;"]
  C -- leak --> D["PricingClient"]
  classDef leak fill:var(--leak-soft),stroke:var(--leak),stroke-width:2px,color:var(--leak)
  class D leak
  linkStyle 2 stroke:var(--leak),stroke-width:2.5px
</pre>
```

### Cross-section (layered shallowness)

One `<ol>` per pane, right after `<h3>`, one `<li>` per layer call passes through. Shallow pass-through band = plain text (renders with downward flow arrow `↓`). After pane: consolidated responsibility = one deep band with `data-kind="deep"`. Cross-section has no leak mark.

```html
<ol>
  <li>OrderHandler</li>
  <li data-kind="deep">Order intake: validate, price, store</li>
</ol>
```

### Collapse (call graph folds into one module)

Box contains boxes it calls. Each box opens with module name. Before: mark leaking module with `data-kind="leak"`. After: one deep box (`data-kind="deep"`), with its absorbed now-internal calls (`data-kind="internal"`) inside it.

```html
<div class="box">
  OrderHandler
  <div class="box" data-kind="leak">PricingClient</div>
</div>

<div class="box" data-kind="deep">
  Order intake
  <div class="box" data-kind="internal">PricingClient</div>
</div>
```

## Tone

Plain English, concise, but architectural nouns and verbs come straight from `groundwork:codebase-design` skill. Concision no excuse to drift.

**Use exactly:** module, interface, implementation, depth, deep, shallow, seam, adapter, leverage, locality.

**Never substitute:** component, service, unit (for module) · API, signature (for interface) · boundary (for seam) · layer, wrapper (for module, when you mean module).

**Phrasings that fit the style:**

- "Order intake module is shallow: interface nearly matches the implementation."
- "Pricing leaks across the seam."
- "Deepen: one interface, one place to test."
- "Two adapters justify the seam: HTTP in prod, in-memory in tests."

**Wins bullets** name gain in glossary terms: _"locality: bugs concentrate in one module"_, _"leverage: one interface, N call sites"_, _"interface shrinks; implementation absorbs the wrappers"_. Don't write _"easier to maintain"_ or _"cleaner code"_: not in glossary, don't earn place.

No hedging, no throat-clearing, no "it's worth noting that…". Sentence could be bullet → make bullet. Bullet could be cut → cut. Term not in `groundwork:codebase-design` glossary → reach for one that is before inventing new.
