# Test plan template

Part of [write-qa](SKILL.md), loaded when routing lands on a test plan. The priority scale and test-type table live in `SKILL.md`.

```markdown
# Test Plan: [Feature or Release]

**Status:** Draft | Ready
**Owner:** [Name]
**Target build / release:** [ID]
**Last updated:** YYYY-MM-DD

## Objective

[What this plan validates and why it matters.]

## Inputs and assumptions

### Requirements and acceptance criteria

- [Requirement or AC — cite spec IDs where a spec exists]

### Assumption Register

| Assumption or unknown | Impact                       | Validation needed             |
| --------------------- | ---------------------------- | ----------------------------- |
| [Assumption]          | [Scope or confidence impact] | [Question, artifact, or test] |

## Scope

### In scope

- [Feature, flow, interface, service, data store, or integration]

### Out of scope

- [Excluded area - reason]

## Coverage map

| Requirement or surface | State, contract, or risk                              | Dimension                           | Planned test or suite | Status                            |
| ---------------------- | ----------------------------------------------------- | ----------------------------------- | --------------------- | --------------------------------- |
| [Item]                 | [Transition, integration, failure, retry, dependency] | [Type - see Test types in SKILL.md] | [Test ID or scenario] | Planned / Covered / Justified gap |

## Strategy

- **Types:** [see Test types in SKILL.md]
- **Approach:** [positive, negative, boundary, state-transition, risk-based]
- **Regression blast radius:** [affected surfaces]

## Environment and data

| Area                                         | Required | Status                    |
| -------------------------------------------- | -------- | ------------------------- |
| [Browser, device, service, account, dataset] | [Need]   | Ready / Missing / Unknown |

## Entry criteria

- [ ] Requirements/ACs available or in the Assumption Register
- [ ] Environments and data ready or listed as blockers
- [ ] Coverage map complete with no unmapped in-scope items

## Exit criteria

- [ ] Every coverage-map row tested or an approved gap
- [ ] All P0 cases pass
- [ ] Open defects and residual risks documented with release impact
- [ ] Regression scope executed or deferred with rationale

## Risks

| Risk   | Likelihood | Impact    | Mitigation   | Owner   |
| ------ | ---------- | --------- | ------------ | ------- |
| [Risk] | L / M / H  | L / M / H | [Mitigation] | [Owner] |

## Deliverables

| Deliverable            | Owner  | Target     | Status                       |
| ---------------------- | ------ | ---------- | ---------------------------- |
| [Cases, suite, report] | [Name] | YYYY-MM-DD | Planned / In progress / Done |
```
