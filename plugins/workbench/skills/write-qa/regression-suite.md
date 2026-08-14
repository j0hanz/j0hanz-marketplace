# Regression suite template

Part of [write-qa](SKILL.md), loaded when routing lands on a regression suite. The priority scale, test-type prefixes, and level table live in `SKILL.md`.

Build the suite from the **coverage map** of the **blast radius**.

```markdown
# Regression Suite: [Change set or release]

**Status:** Draft | Ready
**Level:** Smoke | Sanity | Targeted | Full
**Build:** [ID]
**Environment:** [Name]
**Owner:** [Name]
**Last updated:** YYYY-MM-DD

## Blast radius

- Modified: [area]
- Connected: [components]
- Integrations / dependencies: [list]

## Coverage map

| Surface   | Risk               | Check ID         | Priority | Status                            |
| --------- | ------------------ | ---------------- | -------- | --------------------------------- |
| [Surface] | [What could break] | [SMOKE-/TC-/...] | P0-P3    | Planned / Covered / Justified gap |

## Execution order

1. Smoke, when included; stop if its failure makes the build unstable.
2. P0
3. P1
4. P2 / P3
5. Short exploratory pass on the blast radius

## Pass / fail bar

- **Pass:** all P0 pass, the agreed P1 threshold is met, and no critical defects remain open.
- **Fail (block):** any P0 fails, or a critical defect, security break, or data-loss path is found.
- **Conditional:** P1 failures have a workaround and documented fix plan.

## Cases

| ID   | Title   | Priority | Result | Bug | Notes |
| ---- | ------- | -------- | ------ | --- | ----- |
| [ID] | [Title] | P0-P3    |        |     |       |

## Report

| Suite slice | Total | Pass | Fail | Blocked | Rate |
| ----------- | ----- | ---- | ---- | ------- | ---- |
| Smoke       |       |      |      |         |      |
| P0          |       |      |      |         |      |
| P1          |       |      |      |         |      |
| P2+         |       |      |      |         |      |
| **Total**   |       |      |      |         |      |

**Critical failures:** [BUG-... - impact - status]

**Recommendation:** Go | Conditional go | No-go
**Residual risks:** [list]
**Next steps:** [list]
```

When updating an existing suite: remove obsolete checks, add **repro** cases for bugs found, refresh test data, and re-check the blast radius against the latest change set.
