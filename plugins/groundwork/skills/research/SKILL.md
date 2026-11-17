---
name: research
description: Use when the user wants a topic researched against primary sources, docs or API facts gathered, or reading legwork delegated to a background agent.
---

Spin up **background agent** for research, so you keep working while it reads.

Its job:

1. Investigate question against **primary sources** (official docs, source code, specs, first-party APIs), not secondary write-up. Trace every claim to source that owns it.
2. Write findings to single Markdown file, cite each claim's source.
3. Save where repo already keeps such notes; match existing convention. If none, put somewhere sensible, say where.

## After the report lands

Findings that surface a term or contradict a recorded decision route into the domain model:

- New or sharpened term? Call Skill tool with `groundwork:domain-modeling`: update `GLOSSARY.md`.
- Finding contradicts an ADR in `docs/adr/`? Say so in the report; maintainer decides whether to reopen. Don't quietly re-litigate a recorded decision.
- Label findings with `GLOSSARY.md` terms where project has one.
