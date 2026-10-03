---
name: prototype
description: Prototype the open question with a spike, a cheap rough artifact to react to. Use when "how should it look or behave" has stalled in abstract talk. Not for decisions a question alone settles (grilling).
---

# Prototype

A prototype is a **spike**.

The medium is whatever exposes the open question cheapest:

- **UI sketch** — look or interaction in question; a rough screen or component, static or clickable.
- **Outline** — structure or flow in question; a skeleton of headings or steps.
- **Stub** — wiring or interface in question; a hollow shape that compiles or renders, no real behavior.
- **Logic code** — an output value no sketch can show; the smallest code that shows what the thing _does_, not how it ships.

## Steps

### 1. Pick the cheapest medium

Name the disputed point in one sentence, then take the medium whose entry in the list above names that kind of point. A point that fits two entries takes the one listed first.

**Done when** one medium is chosen and the reason names the question it exposes.

### 2. Build it rough

Build the smallest artifact that surfaces the disputed look or behavior. Every piece it carries is load-bearing for the question; stub the rest.

**Done when** the artifact has been run or rendered once and the disputed point is visible in that output.

### 3. Put the question in front of the human

Link the artifact as an asset and ask the one sharp question it was built to answer. Take the human's reaction as the answer: it settles the question, or names the next one to prototype.

Assets live in `assets/` inside the effort directory, linked from the record that holds the resolution. Under [frontier](../frontier/SKILL.md) that record is the prototype ticket's `## Resolution`. Otherwise it is the decision's node in the [grilling](../grilling/SKILL.md) map, `<name>.map.md` in the per-change directory [write-specs](../write-specs/SKILL.md#referencing) defines; with no map there yet, open one with this decision as its first node.

**Done when** the artifact is linked from that record, the one question it answers is asked, and the human's reaction is written in that record as the resolution.

## Not a commitment

Testing lands in [tdd](../tdd/SKILL.md) once the exposed behavior settles — a suite on throwaway code buys no new reaction.

When the look and behavior are settled, hand to [write-specs](../write-specs/SKILL.md) to fix them and [write-plan](../write-plan/SKILL.md) to build the real thing. A spike that survives review becomes the reference the real implementation is built against.
