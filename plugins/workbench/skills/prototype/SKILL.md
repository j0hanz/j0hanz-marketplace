---
name: prototype
description: Prototype the open question — fire a **spike**, a cheap rough artifact built to react to. Use when "how should it look or behave" has stalled in abstract talk. Not for decisions a question alone settles (grilling).
---

# Prototype

A prototype is a **spike**: one cheap shot fired to see where a question lands, then discarded.

The medium is whatever exposes the open question cheapest:

- **UI sketch** — look or interaction in question; a rough screen or component, static or clickable.
- **Outline** — structure or flow in question; a skeleton of headings or steps.
- **Stub** — wiring or interface in question; a hollow shape that compiles or renders, no real behavior.
- **Logic code** — an output value no sketch can show; the smallest code that shows what the thing _does_, not how it ships.

## Steps

### 1. Pick the cheapest medium

A human will look at the thing — sketch it. Otherwise outline it. Reach for a stub only where the disputed point is an interface another component must consume, and for logic code only where the disputed point is a value.

**Done when** one medium is chosen and the reason names the question it exposes.

### 2. Build it rough

Build the smallest artifact that surfaces the disputed look or behavior. Every piece it carries is load-bearing for the question; stub the rest.

**Done when** the artifact has been run or rendered once and the disputed point is visible in that output.

### 3. Put the question in front of the human

Link the artifact as an asset and ask the one sharp question it was built to answer. Take the human's reaction as the answer: it settles the question, or names the next one to prototype.

Assets live in `assets/` inside the effort directory — the map's under [frontier](../frontier/SKILL.md), otherwise the per-change directory [write-specs](../write-specs/SKILL.md#referencing) defines.

**Done when** the artifact is linked, the one question it answers is asked, and the human's reaction is recorded as the resolution.

## Not a commitment

Testing lands in [tdd](../tdd/SKILL.md) once the exposed behavior settles — a suite on throwaway code buys no new reaction.

When the look and behavior are settled, hand to [write-specs](../write-specs/SKILL.md) to fix them and [write-plan](../write-plan/SKILL.md) to build the real thing. A spike that survives review becomes the reference the real implementation is built against.
