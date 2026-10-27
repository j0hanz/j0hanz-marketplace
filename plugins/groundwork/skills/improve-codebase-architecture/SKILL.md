---
name: improve-codebase-architecture
description: Scan a codebase for deepening opportunities, present them as a visual HTML report, then grill through whichever one you pick.
disable-model-invocation: true
---

# Improve Codebase Architecture

Surface architectural friction, propose **deepening opportunities**: refactors turning shallow modules into deep ones. Aim: testability and AI-navigability.

Command _informed_ by project domain model, built on shared design vocabulary:

- Call Skill tool with `groundwork:codebase-design` for architecture vocabulary (**module**, **interface**, **depth**, **seam**, **adapter**, **leverage**, **locality**) and principles (deletion test, "the interface is the test surface", "one adapter = hypothetical seam, two = real"). Use these terms exactly in every suggestion. No drift into "component," "service," "API," "boundary."
- Domain language in `GLOSSARY.md` names good seams. ADRs in `docs/adr/` record decisions this command must not re-litigate.

## Process

### 1. Explore

**Scope before scan: YAGNI.** Deepening module pays off by easing future changes, so weight recently changed parts extra. Decide _where_ to look before looking:

- User named direction (module, subsystem, pain point)? Take it, skip inference below.
- Else walk back good stretch of commit history (`git log --oneline`) to find hot spots: files/areas that keep coming up. Let those paths pull attention first. Changes scattered, no clear hot spot? Widen net.

Read domain glossary (`GLOSSARY.md`) and any ADRs in touched area first.

Then spawn sub-agent to walk codebase. No rigid heuristics; explore organically, note where friction felt:

- Where does understanding one concept require bouncing between many small modules?
- Where are modules **shallow**, interface nearly as complex as implementation?
- Where were pure functions extracted just for testability, but real bugs hide in how they're called (no **locality**)?
- Where do tightly-coupled modules leak across seams?
- Which parts untested, or hard to test through current interface?

Apply **deletion test** to suspected shallow things: would deleting concentrate complexity, or just move it? "Yes, concentrates" = wanted signal.

### 2. Present candidates as an HTML report

Write self-contained HTML file to OS temp dir so nothing lands in repo. Resolve temp dir from `$TMPDIR`, fallback `/tmp` (or `%TEMP%` on Windows), write to `<tmpdir>/architecture-review-<timestamp>.html` so each run gets fresh file. Open for user (`xdg-open <path>` on Linux, `open <path>` on macOS, `start <path>` on Windows), tell them absolute path.

Report starts as copy of [report.html](report.html): fixed stylesheet setting look, plus **Mermaid** pinned from CDN for diagrams where graph, flow or sequence shows structure. Write only body. Mix Mermaid with scaffold's hand-built visuals: Mermaid when relationships graph-shaped (call graphs, dependencies, sequences); core samples, cross-sections or collapse boxes when point is depth. Each candidate gets **before/after visualisation**. Be visual.

Per candidate, render card with:

- **Files**: files/modules involved
- **Problem**: why current architecture causes friction
- **Solution**: plain English description of change
- **Benefits**: in terms of locality and leverage, plus how tests improve
- **Before / After diagram**: side-by-side, custom-drawn, showing shallowness and deepening
- **Recommendation strength**: one of `Strong`, `Worth exploring`, `Speculative`, rendered as badge

Open report with **Top recommendation** in title block: which candidate to tackle first and why.

**Use GLOSSARY.md vocabulary for the domain, and the `groundwork:codebase-design` vocabulary for the architecture.** If `GLOSSARY.md` defines "Order," say "the Order intake module," not "the FooBarHandler," not "the Order service."

**ADR conflicts**: candidate contradicts existing ADR? Surface only when friction real enough to warrant revisiting ADR. Mark clearly in card (e.g. warning callout: _"contradicts ADR-0007, but worth reopening because…"_). Don't list every theoretical refactor ADR forbids.

See [HTML-REPORT.md](HTML-REPORT.md) for filling template, markup vocabulary, diagram patterns.

Do NOT propose interfaces yet. After file written, ask user: "Which of these would you like to explore?"

### 3. Grilling loop

User picks candidate → call Skill tool with `groundwork:grilling` to walk decision tree together: constraints, dependencies, shape of deepened module, what sits behind seam, what tests survive.

Side effects happen inline as decisions crystallize. Call Skill tool with `groundwork:domain-modeling` to keep domain model current:

- **Naming a deepened module after a concept not in `GLOSSARY.md`?** Add term to `GLOSSARY.md`. Create file lazily if missing.
- **Sharpening a fuzzy term during the conversation?** Update `GLOSSARY.md` right there.
- **User rejects the candidate with a load-bearing reason?** Offer ADR, framed as: _"Want me to record this as an ADR so future architecture reviews don't re-suggest it?"_ Offer only when future explorer would actually need reason to avoid re-suggesting. Skip ephemeral reasons ("not worth it right now") and self-evident ones.
- **Want to explore alternative interfaces for the deepened module?** Call Skill tool with `groundwork:codebase-design`, use its design-it-twice parallel sub-agent pattern.
