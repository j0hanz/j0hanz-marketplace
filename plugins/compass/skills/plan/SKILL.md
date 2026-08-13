---
name: plan
description: Plan the route — size the ask and pick which skill runs first, where it hands off next.
disable-model-invocation: true
argument-hint: '[what to plan]'
---

# Plan

## The chain

[grilling](../grilling/SKILL.md) → [write-specs](../write-specs/SKILL.md) → [write-plan](../write-plan/SKILL.md) → [run-plan](../run-plan/SKILL.md) → [verify-specs](../verify-specs/SKILL.md)

Enter at the first link the ask needs, stop at the last one it earns — most asks use a slice, not the whole chain. The chain runs forward with two back-edges: [verify-specs](../verify-specs/SKILL.md) returns an unmet ID to [write-plan](../write-plan/SKILL.md) when the code is wrong and to [write-specs](../write-specs/SKILL.md) when the requirement is, and a STOP in [run-plan](../run-plan/SKILL.md) returns the same way.

Five skills run beside a link rather than in it: [research](../research/SKILL.md) feeds facts in, [prototype](../prototype/SKILL.md) settles a look-or-behavior question before the spec, [write-adr](../write-adr/SKILL.md) takes a settled decision out, [qc](../qc/SKILL.md) reviews a branch diff for structure, and [tdd](../tdd/SKILL.md) runs _inside_ [run-plan](../run-plan/SKILL.md) — on any step that adds behavior, and on any code written with no plan at all.

[frontier](../frontier/SKILL.md) replaces the front of the chain when the way to done is not visible yet.

## Size the ask

Four reads, in order:

1. **Artifact already?** A written spec enters at [write-plan](../write-plan/SKILL.md), a written plan at [run-plan](../run-plan/SKILL.md), a landed change with a spec at [verify-specs](../verify-specs/SKILL.md). Sizing stops.
2. **Fogged?** If the way from here to done is not visible — many sessions, fog over the middle — the route is [frontier](../frontier/SKILL.md) and sizing stops. It owns its own grilling and hands the spec work out at close.
3. **Behavior settled?** Settled means **black-box** — a different implementation could be checked against it ([write-specs](../write-specs/SKILL.md)).
4. **Facts present?** Unknown API, unread doc, unfamiliar library — the plan will be fiction without them. Every external name the ask mentions is either read this session or has a [research](../research/SKILL.md) dispatch running.

Ambiguous between two forks: ask one question. Reach [grilling](../grilling/SKILL.md) once the route is chosen and the decision map opens.

## Routes

First matching row wins, read top to bottom.

| Ask                                        | Flow                                                                                                             |
| :----------------------------------------- | :--------------------------------------------------------------------------------------------------------------- |
| Known, one file, no forks, no new behavior | none — do it                                                                                                     |
| Facts missing                              | [research](../research/SKILL.md) first, in background                                                            |
| Look or behavior is the open question      | [prototype](../prototype/SKILL.md) → [write-specs](../write-specs/SKILL.md)                                      |
| Behavior loose, user has opinions          | [grilling](../grilling/SKILL.md) → [write-specs](../write-specs/SKILL.md) → [write-plan](../write-plan/SKILL.md) |
| Behavior needs fixing, no forks left       | [write-specs](../write-specs/SKILL.md) → [write-plan](../write-plan/SKILL.md)                                    |
| Behavior fixed, route missing              | [write-plan](../write-plan/SKILL.md)                                                                             |
| Behavior settled, code to write, no plan   | [tdd](../tdd/SKILL.md)                                                                                           |
| Plan written, not run                      | [run-plan](../run-plan/SKILL.md)                                                                                 |
| Change landed against a spec               | [verify-specs](../verify-specs/SKILL.md)                                                                         |
| Branch diff, review structure              | [qc](../qc/SKILL.md)                                                                                             |
| Decision settled, outlives the effort      | [write-adr](../write-adr/SKILL.md)                                                                               |
| Fogged — too big for one session           | [frontier](../frontier/SKILL.md)                                                                                 |

Named an output document rather than a plan (proposal, RFC, PRD) — that is `writing-docs`, not this skill.

Done when the flow is named to the user in one line and its first skill is invoked.
