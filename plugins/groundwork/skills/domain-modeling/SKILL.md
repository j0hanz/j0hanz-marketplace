---
name: domain-modeling
description: Use when building or sharpening a project's domain model, discussing codebase terminology, writing or editing a GLOSSARY.md, or recording or editing an ADR.
---

# Domain Modeling

Actively build, sharpen project domain model while designing. This is _active_ discipline: challenge terms, invent edge-case scenarios, write glossary and decisions down moment they crystallise. (Merely _reading_ `GLOSSARY.md` for vocabulary not this skill: one-line habit any skill can do. This skill for changing model, not just consuming it.)

## File structure

Most repos have single context:

```
/
├── GLOSSARY.md
├── docs/
│   └── adr/
│       ├── 0001-event-sourced-orders.md
│       └── 0002-postgres-for-write-model.md
└── src/
```

If `GLOSSARY-MAP.md` exists at root, repo has multiple contexts. Map points to where each lives:

```
/
├── GLOSSARY-MAP.md
├── docs/
│   └── adr/                          ← system-wide decisions
├── src/
│   ├── ordering/
│   │   ├── GLOSSARY.md
│   │   └── docs/adr/                 ← context-specific decisions
│   └── billing/
│       ├── GLOSSARY.md
│       └── docs/adr/
```

Create files lazily: only when something to write. No `GLOSSARY.md`? Create when first term resolved. No `docs/adr/`? Create when first ADR needed.

## During the session

### Challenge against the glossary

User term conflicts with existing language in `GLOSSARY.md` → call out immediately. "Your glossary defines 'cancellation' as X, but you seem to mean Y. Which is it?"

### Sharpen fuzzy language

User uses vague or overloaded terms → propose precise canonical term. "You're saying 'account': do you mean the Customer or the User? Those are different things."

### Discuss concrete scenarios

When domain relationships discussed, stress-test with specific scenarios. Invent scenarios probing edge cases, force user to be precise about boundaries between concepts.

### Cross-reference with code

User states how something works → check code agrees. Contradiction found? Surface it: "Your code cancels entire Orders, but you just said partial cancellation is possible. Which is right?"

### Update GLOSSARY.md inline

Term resolved → update `GLOSSARY.md` right there. No batching: capture as they happen. Use format in [GLOSSARY-FORMAT.md](./GLOSSARY-FORMAT.md).

`GLOSSARY.md` must be totally devoid of implementation details. Do not treat `GLOSSARY.md` as spec, scratch pad, or repository for implementation decisions. Glossary, nothing else.

### Offer ADRs sparingly

Only offer ADR when all three true:

1. **Hard to reverse**: cost of changing mind later meaningful
2. **Surprising without context**: future reader will wonder "why did they do it this way?"
3. **The result of a real trade-off**: genuine alternatives existed, picked one for specific reasons

Any of three missing → skip ADR. Use format in [ADR-FORMAT.md](./ADR-FORMAT.md).
