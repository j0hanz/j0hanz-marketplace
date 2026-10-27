# Design It Twice

User want explore alternative interfaces for chosen deepening candidate → use this parallel sub-agent pattern. Based on "Design It Twice" (Ousterhout): first idea unlikely best.

Uses vocabulary in [SKILL.md](SKILL.md): **module**, **interface**, **seam**, **adapter**, **leverage**.

## Process

### 1. Frame the problem space

Before spawning sub-agents, write user-facing explanation of problem space for chosen candidate:

- Constraints any new interface must satisfy
- Dependencies it relies on, and which category each falls in (see [DEEPENING.md](DEEPENING.md))
- Rough illustrative code sketch to ground constraints. Not proposal, just makes constraints concrete

Show user, then immediately go Step 2. User reads and thinks while sub-agents work in parallel.

### 2. Spawn sub-agents

Spawn 3+ sub-agents in parallel. Each must produce **radically different** interface for deepened module.

Prompt each sub-agent with separate technical brief (file paths, coupling details, dependency category from [DEEPENING.md](DEEPENING.md), what sits behind seam). Brief independent of Step 1 user-facing problem-space explanation. Give each agent different design constraint:

- Agent 1: "Minimize the interface: aim for 1–3 entry points max. Maximise leverage per entry point."
- Agent 2: "Maximise flexibility: support many use cases and extension."
- Agent 3: "Optimise for the most common caller: make the default case trivial."
- Agent 4 (if applicable): "Design around ports & adapters for cross-seam dependencies."

Include both [SKILL.md](SKILL.md) vocabulary and GLOSSARY.md vocabulary in brief so each sub-agent names things consistent with architecture language and project domain language.

Each sub-agent outputs:

1. Interface (types, methods, params, plus invariants, ordering, error modes)
2. Usage example showing how callers use it
3. What implementation hides behind seam
4. Dependency strategy and adapters (see [DEEPENING.md](DEEPENING.md))
5. Trade-offs: where leverage high, where thin

### 3. Present and compare

Present designs sequentially so user absorbs each, then compare in prose. Contrast by **depth** (leverage at interface), **locality** (where change concentrates), **seam placement**.

After compare, give own recommendation: which design strongest and why. If elements from different designs combine well, propose hybrid. Be opinionated: user wants strong read, not menu.
