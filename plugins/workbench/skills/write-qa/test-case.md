# Test case template

Part of [write-qa](SKILL.md), loaded when routing lands on manual cases. The priority scale and type/prefix table live in `SKILL.md`.

Cases collect into one `<name>.cases.md` under `# Test Cases: <name>` — see Referencing in `SKILL.md`. Use the default shape for every case, at `##`, so the file carries one H1. Append only the type addition its **Type** requires.

```markdown
## TC-[ID]: [Title]

**Priority:** P0 | P1 | P2 | P3
**Type:** Functional | UI | Integration | Regression | Security | Performance | Smoke | Exploratory
**Traceability:** [Requirement ID, coverage-map row, or Not required]
**Status:** Not Run | Pass | Fail | Blocked | Skipped
**Estimated time:** [minutes]
**Created:** YYYY-MM-DD

### Objective

[What this case validates.]

### Preconditions

- [Setup, account, data, environment - or None]

### Steps

1. [Action]
   - **Input:** [data if any]
   - **Expected:** [observable result]

2. [Action]
   - **Expected:** [observable result]

### Test data

| Field   | Value   | Notes      |
| ------- | ------- | ---------- |
| [Field] | [Value] | [Handling] |

### Post-conditions

- [System state after run]
- [Cleanup]

### Edge cases

| Variation               | Input   | Expected |
| ----------------------- | ------- | -------- |
| [Empty / max / invalid] | [Value] | [Result] |

### Related

- [TC-... or None]

### Execution history

| Date | Tester | Build | Result | Bug ID | Notes |
| ---- | ------ | ----- | ------ | ------ | ----- |
|      |        |       |        |        |       |
```

## UI addition

```markdown
### Visual

**Design ref:** [URL]
**Breakpoints:** Desktop | Tablet | Mobile

| Element     | Property             | Expected | Actual | OK  |
| ----------- | -------------------- | -------- | ------ | --- |
| [Component] | [color/size/spacing] | [Spec]   |        | [ ] |

**Applicable states:** default | hover | active | focus | disabled - each matches design.
```

## Integration addition

```markdown
### Contract

**Systems:** [A] -> [B]
**Endpoint / message:** [ID]

| Field   | Source  | Expected transform | OK  |
| ------- | ------- | ------------------ | --- |
| [Field] | [Value] | [Value]            | [ ] |

**Applicable failure paths:** timeout, invalid payload, auth failure, rate limit - state the expected handling for each.
```

## Security addition

```markdown
### Control

**OWASP:** [A0x]
**Risk:** Critical | High | Medium | Low

- Attack vector under test: [description]
- Expected control: block / sanitize / deny with no information leak
- Audit log records the attempt
```

## Performance addition

```markdown
### Metrics

| Metric        | Target | Acceptable | Actual | OK  |
| ------------- | ------ | ---------- | ------ | --- |
| Response time |        |            |        | [ ] |
| Throughput    |        |            |        | [ ] |
| Error rate    |        |            |        | [ ] |

**Load:** normal | peak | stress - record duration and concurrency.
```

## Regression addition

```markdown
### Blast radius

**Recent changes that may affect this:**

- [Change]

**Still intact:** core path | persistence | UI | integrations | error handling
```
