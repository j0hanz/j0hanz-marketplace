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

Skills run beside a link rather than in it: [research](../research/SKILL.md) feeds facts in, [prototype](../prototype/SKILL.md) settles a look-or-behavior question before the spec, [write-adr](../write-adr/SKILL.md) takes a settled decision out, [write-qa](../write-qa/SKILL.md) covers what only a human run can check — test plans, manual cases, regression suites — and files the bug reports a run produces, and [tdd](../tdd/SKILL.md) runs _inside_ [run-plan](../run-plan/SKILL.md) — on any step that adds behavior, and on any code written with no plan at all.

Three review the diff once code lands, each on its own axis, none on the others': [bug-hunt](../bug-hunt/SKILL.md) for correctness and security, [qc](../qc/SKILL.md) for structure, [clean-code](../clean-code/SKILL.md) for readability.

[frontier](../frontier/SKILL.md) replaces the front of the chain when the way to done is not visible yet. [architecture-audit](../architecture-audit/SKILL.md) sits before the chain rather than on it — whole repo, no diff — and feeds one finding to [write-plan](../write-plan/SKILL.md) or the whole list to [frontier](../frontier/SKILL.md).

Two sit off the route entirely: [write-skills](../write-skills/SKILL.md) and [write-hooks](../write-hooks/SKILL.md) author the Claude Code extensions themselves, not the work they run on.

## Size the ask

Four reads, in order:

1. **Artifact already?** A written spec enters at [write-plan](../write-plan/SKILL.md), a written plan at [run-plan](../run-plan/SKILL.md), a landed change with a spec at [verify-specs](../verify-specs/SKILL.md). Sizing stops.
2. **Fogged?** If the way from here to done is not visible — many sessions, fog over the middle — the route is [frontier](../frontier/SKILL.md) and sizing stops. It owns its own grilling and hands the spec work out at close.
3. **Behavior settled?** Settled means black-box — a different implementation could be checked against it, the kind of spec write-specs produces.
4. **Facts present?** Unknown API, unread doc, unfamiliar library — the plan will be fiction without them. Every external name the ask mentions is either read this session or has a [research](../research/SKILL.md) dispatch running.

Steps 3 and 4 are factors, not gates — read both, then the Routes table below selects the flow; sizing does not stop here.

Ambiguous between two forks: ask one question. Reach [grilling](../grilling/SKILL.md) once the route is chosen and the decision map opens.

## Routes

First matching row wins, read top to bottom.

| Ask                                         | Flow                                                                                                             |
| :------------------------------------------ | :--------------------------------------------------------------------------------------------------------------- |
| Known, one file, no forks, no new behavior  | none — do it                                                                                                     |
| Facts missing                               | [research](../research/SKILL.md) first, in background                                                            |
| Look or behavior is the open question       | [prototype](../prototype/SKILL.md) → [write-specs](../write-specs/SKILL.md)                                      |
| Behavior loose, user has opinions           | [grilling](../grilling/SKILL.md) → [write-specs](../write-specs/SKILL.md) → [write-plan](../write-plan/SKILL.md) |
| Behavior needs fixing, no forks left        | [write-specs](../write-specs/SKILL.md) → [write-plan](../write-plan/SKILL.md)                                    |
| Behavior fixed, route missing               | [write-plan](../write-plan/SKILL.md)                                                                             |
| Behavior settled, code to write, no plan    | [tdd](../tdd/SKILL.md)                                                                                           |
| Plan written, not run                       | [run-plan](../run-plan/SKILL.md)                                                                                 |
| Change landed against a spec                | [verify-specs](../verify-specs/SKILL.md)                                                                         |
| Test plan, manual cases, suite, bug report  | [write-qa](../write-qa/SKILL.md)                                                                                 |
| Code correctness or security in doubt       | [bug-hunt](../bug-hunt/SKILL.md)                                                                                 |
| Branch diff, review structure               | [qc](../qc/SKILL.md)                                                                                             |
| Readability only, behavior unchanged        | [clean-code](../clean-code/SKILL.md)                                                                             |
| Whole repo, the shape itself is the problem | [architecture-audit](../architecture-audit/SKILL.md)                                                             |
| Decision settled, outlives the effort       | [write-adr](../write-adr/SKILL.md)                                                                               |
| Fogged — too big for one session            | [frontier](../frontier/SKILL.md)                                                                                 |
| Authoring a skill or a hook                 | [write-skills](../write-skills/SKILL.md), [write-hooks](../write-hooks/SKILL.md)                                 |

Named an output document rather than a plan (proposal, RFC, PRD) — that is `writing-docs`, not this skill.

Done when the flow is named to the user in one line and its first skill is invoked.
