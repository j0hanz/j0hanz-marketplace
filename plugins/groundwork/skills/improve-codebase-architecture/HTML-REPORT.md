# HTML Report Format

The architectural review is one HTML file in the OS temp directory, self-contained except for the pinned Mermaid import. Its look lives in [report.html](report.html): the stylesheet, the Mermaid script, and an empty `<main>`. You write only what goes inside `<main>`.

## Direction

The glossary is already geological: **depth**, **seam**, **layer**, **leak**. The report borrows the look of a survey drawing to match. A title block names the drawing. Each module is drawn as a **core sample**: a solid interface band over a hatched implementation band, so a shallow module reads as a stubby core and a deep one as a tall core with a thin cap.

Blue marks the interface. Red marks a leak. Hatching marks implementation. A heavy outline marks a deep module. Dark mode follows the reader's system setting.

## Build

1. Copy `report.html` from this skill's directory to `<tmpdir>/architecture-review-<timestamp>.html` with a shell command (`cp`, or `Copy-Item` on Windows). Don't retype it.
2. Replace `REPO` in its `<title>`.
3. Replace the `<!-- REPORT: … -->` comment inside `<main>` with the title block, then one `<article>` per candidate.

The one network request is Mermaid, pinned to an exact version. Without it, each diagram shows its readable source text.

## Vocabulary

These are all the classes and `data-` attributes the stylesheet knows. Use no others, and no inline styles except a core's counts. The `id`, `href` and `aria-` attributes in the examples are plain HTML.

| Markup                    | Means                             |
| :------------------------ | :-------------------------------- |
| `class="caps"`            | Small uppercase label             |
| `class="row"`             | Items in a wrapping line          |
| `class="files"`           | File path list                    |
| `class="cores"`           | Holds core samples                |
| `class="core"`            | One core sample                   |
| `class="box"`             | One module in a collapse diagram  |
| `class="mermaid"`         | Mermaid source, on a `<pre>`      |
| `data-strength`           | `strong`, `worth`, `speculative`  |
| `data-kind`               | A mark; see the next table        |
| `id="top-recommendation"` | The title block's start-here cell |

| `data-kind` | Valid on                                                          |
| :---------- | :---------------------------------------------------------------- |
| `deep`      | Key item, core, box, cross-section band                           |
| `internal`  | Box                                                               |
| `leak`      | Key item, box                                                     |
| `module`    | Key item only (an unmarked core, box or band is already a module) |
| `interface` | Key item only                                                     |
| `seam`      | Key item only                                                     |

Plain elements carry the rest. In a card, `<dt>` is a label, `<code>` in the badge row is the dependency tag, and `<aside>` is the ADR callout. In a figure, each `<section>` is one pane, its `<h3>` is the pane label, and an `<ol>` is a cross-section.

## Title block

The first screen answers "which one do I explore?" The title block holds four cells, in this order: identity, the top recommendation, the candidate index, and the key. No introduction paragraph.

```html
<header>
  <div>
    <p class="caps">Architecture review</p>
    <h1>{{repo name}}</h1>
    <p class="row">
      <span>2026-10-27</span><span>Scope: src/orders, src/pricing</span><span>3 candidates</span>
    </p>
  </div>
  <section id="top-recommendation" aria-labelledby="top-title">
    <p class="caps">Start with</p>
    <h2 id="top-title"><a href="#order-intake">Collapse the Order intake pipeline</a></h2>
    <p>Pricing leaks across four seams; one deep module ends it.</p>
  </section>
  <nav aria-label="Candidates">
    <p class="caps">Candidates</p>
    <ul>
      <li class="row">
        <a href="#order-intake">Collapse the Order intake pipeline</a>
        <span data-strength="strong">Strong</span>
      </li>
    </ul>
  </nav>
  <div>
    <p class="caps">Key</p>
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

The top recommendation holds the candidate's linked name and one sentence on why. That is all it holds.

## Candidate card

The diagrams carry the weight. Prose is sparse, plain, and uses the glossary terms (from the `groundwork:codebase-design` skill) without ceremony.

Each candidate is one `<article>` with the `id` the title block links to. Keep its parts in this order:

- **Title**: an `<h2>` that names the deepening (e.g. "Collapse the Order intake pipeline").
- **Badge row**: the strength mark, then the dependency category as `<code>`: `in-process`, `local-substitutable`, `ports &amp; adapters`, or `mock`. Strength text is `Strong`, `Worth exploring` or `Speculative`.
- **Files**: a `<ul class="files">`, one path per item.
- **Before / After**: a `<figure>` with two `<section>` panes and a `<figcaption>`. See the diagram patterns below.
- **Problem** and **Solution**: one sentence each, in a `<dl>` with one `<div>` per term.
- **Wins**: a plain `<ul>`, at most 6 words per bullet.
- **ADR callout**, if one applies.

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

The `<figcaption>` is the diagram's text alternative. Write it so a reader who cannot see the panes gets the same point. No paragraphs of explanation beyond it. If the diagram needs a paragraph to be understood, redraw the diagram.

## Escaping

File names and identifiers come from the code, so they can contain `<`, `>` and `&`.

- In HTML, write `&lt;`, `&gt;` and `&amp;`.
- In a Mermaid label, quote the label and write `#lt;`, `#gt;` and `#amp;`. Mermaid strips an HTML entity such as `&lt;`: `Repo&lt;Order&gt;` renders as `Repo`.
- Outside Mermaid labels, write arrows raw (`-->`, `->>`).

## Diagram patterns

Pick the pattern that fits each candidate, and vary them across the report. The panes stack on a phone and sit side by side on a wide screen.

### Core sample (shallow vs deep)

Use this when the point is "interface as wide as implementation". Count the module's names:

- `--iface` is the number of exported names.
- `--impl` is the number of internal names: non-exported functions and methods.
  The column is `--iface + --impl` rem tall, capped at 14. If any module in the figure passes 14, divide every count in that figure by the same factor, so the heights still compare. Both bands use the same unit, so the proportion tells the truth. The text inside the core is its label.

```html
<div class="cores">
  <div class="core" style="--iface: 5; --impl: 4">OrderHandler</div>
</div>
```

In the before pane, put one core per shallow module. In the after pane, put the single deep core with `data-kind="deep"`. State the real counts in the `<figcaption>`.

### Mermaid graph (dependencies and call flow)

Use a `flowchart` when the point is "X calls Y calls Z, and look at the mess". Prefer `flowchart TD`: a wide `LR` graph scrolls sideways in its pane. Use a `sequenceDiagram` for "before: 6 round-trips; after: 1"; it carries no leak or seam marks, so the caption names them. Start each diagram with `accTitle` and `accDescr` so screen readers get a name.

In a flowchart:

- A leaking edge gets the label `leak` (`A -- leak --> B`). Then colour it with `linkStyle`. Edge indexes count from 0 in source order, so count them again before you write the index.
- A dashed edge (`-.->`) is a seam.
- A deep module gets `classDef deep stroke-width:3px` and `class <node> deep`.

Write colours as `var(--token)`. The template swaps in the theme value before Mermaid parses the diagram.

```html
<pre class="mermaid">
flowchart LR
  accTitle: Order intake before
  accDescr: The handler reaches pricing through the repo, past the seam
  A["OrderHandler"] --> B["OrderValidator"]
  B --> C["OrderRepo#lt;Order#gt;"]
  C -- leak --> D["PricingClient"]
  classDef leak stroke:var(--leak),stroke-width:3px,color:var(--leak)
  class D leak
  linkStyle 2 stroke:var(--leak),stroke-width:3px
</pre>
```

### Cross-section (layered shallowness)

Use one `<ol>` per pane, right after the `<h3>`, with one `<li>` per layer a call passes through. A thin band is plain text. In the after pane, the consolidated responsibility is one deep band, its label wrapped in a `<span>`. A cross-section has no leak mark.

```html
<ol>
  <li>OrderHandler</li>
  <li data-kind="deep"><span>Order intake: validate, price, store</span></li>
</ol>
```

### Collapse (call graph folds into one module)

A box contains the boxes it calls. Each box opens with its name: plain text, or a `<span class="caps">` on the deep box. Before: mark a module that leaks with `data-kind="leak"`. After: one deep box, with the now-internal calls inside it.

```html
<div class="box">
  OrderHandler
  <div class="box" data-kind="leak">PricingClient</div>
</div>

<div class="box" data-kind="deep">
  <span class="caps">Order intake</span>
  <div class="box" data-kind="internal">PricingClient</div>
</div>
```

## Tone

Plain English, concise, but the architectural nouns and verbs come straight from the `groundwork:codebase-design` skill. Concision is not an excuse to drift.

**Use exactly:** module, interface, implementation, depth, deep, shallow, seam, adapter, leverage, locality.

**Never substitute:** component, service, unit (for module) · API, signature (for interface) · boundary (for seam) · layer, wrapper (for module, when you mean module).

**Phrasings that fit the style:**

- "Order intake module is shallow: interface nearly matches the implementation."
- "Pricing leaks across the seam."
- "Deepen: one interface, one place to test."
- "Two adapters justify the seam: HTTP in prod, in-memory in tests."

**Wins bullets** name the gain in glossary terms: _"locality: bugs concentrate in one module"_, _"leverage: one interface, N call sites"_, _"interface shrinks; implementation absorbs the wrappers"_. Don't write _"easier to maintain"_ or _"cleaner code"_, because those terms aren't in the glossary and don't earn their place.

No hedging, no throat-clearing, no "it's worth noting that…". If a sentence could be a bullet, make it a bullet. If a bullet could be cut, cut it. If a term isn't in the `groundwork:codebase-design` glossary, reach for one that is before inventing a new one.
