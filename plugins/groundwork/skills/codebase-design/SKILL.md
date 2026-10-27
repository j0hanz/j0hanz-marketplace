---
name: codebase-design
description: Use when designing deep modules, improving a module's interface, finding deepening opportunities, deciding where a seam goes, making code more testable or AI-navigable, or when another skill needs the deep-module vocabulary.
---

# Codebase Design

Design **deep modules**: much behaviour behind small interface, at clean seam, testable through that interface. Use this language + principles wherever code designed or restructured. Aim: leverage for callers, locality for maintainers, testability for all.

## Glossary

Use terms exactly: no "component," "service," "API," "boundary." Consistent language = whole point.

**Module**: anything with interface + implementation. Scale-agnostic on purpose: function, class, package, or tier-spanning slice. _Avoid_: unit, component, service.

**Interface**: everything caller must know to use module correctly: type signature, plus invariants, ordering constraints, error modes, required config, performance characteristics. _Avoid_: API, signature (too narrow, only type-level surface).

**Implementation**: module's inside, its body of code. Distinct from **Adapter**: thing can be small adapter with large implementation (Postgres repo) or large adapter with small implementation (in-memory fake). Say "adapter" when seam is topic; "implementation" otherwise.

**Depth**: leverage at interface. Behaviour caller (or test) can exercise per unit of interface learned. Module **deep** when much behaviour behind small interface, **shallow** when interface nearly as complex as implementation.

**Seam** _(Michael Feathers)_: place where behaviour can change without editing that place; the _location_ where module's interface lives. Seam placement = own design decision, separate from what goes behind it. _Avoid_: boundary (overloaded with DDD's bounded context).

**Adapter**: concrete thing satisfying interface at seam. Describes _role_ (slot filled), not substance (what's inside).

**Leverage**: what callers get from depth. More capability per unit of interface learned. One implementation pays back across N call sites, M tests.

**Locality**: what maintainers get from depth. Change, bugs, knowledge, verification concentrate in one place, not spread across callers. Fix once, fixed everywhere.

## Deep vs shallow

**Deep module** = small interface + lots of implementation:

```
┌─────────────────────┐
│   Small Interface   │  ← Few methods, simple params
├─────────────────────┤
│                     │
│  Deep Implementation│  ← Complex logic hidden
│                     │
└─────────────────────┘
```

**Shallow module** = large interface + little implementation (avoid):

```
┌─────────────────────────────────┐
│       Large Interface           │  ← Many methods, complex params
├─────────────────────────────────┤
│  Thin Implementation            │  ← Just passes through
└─────────────────────────────────┘
```

When designing interface, ask:

- Fewer methods?
- Simpler params?
- Hide more complexity inside?

## Principles

- **Depth is a property of the interface, not the implementation.** Deep module can be built from small, mockable, swappable parts internally; they're just not in interface. Module can have **internal seams** (private to implementation, used by own tests) plus **external seam** at interface.
- **The deletion test.** Imagine deleting module. Complexity vanishes → was pass-through. Complexity reappears across N callers → earned its keep.
- **The interface is the test surface.** Callers + tests cross same seam. Want to test _past_ interface → module probably wrong shape.
- **One adapter means a hypothetical seam. Two adapters means a real one.** No seam unless something actually varies across it.

## Designing for testability

Good interfaces make testing natural:

1. **Accept dependencies, don't create them.**

   ```typescript
   // Testable
   function processOrder(order, paymentGateway) {}

   // Hard to test
   function processOrder(order) {
     const gateway = new StripeGateway();
   }
   ```

2. **Return results, don't produce side effects.**

   ```typescript
   // Testable
   function calculateDiscount(cart): Discount {}

   // Hard to test
   function applyDiscount(cart): void {
     cart.total -= discount;
   }
   ```

3. **Small surface area.** Fewer methods = fewer tests. Fewer params = simpler test setup.

## Relationships

- **Module** has exactly one **Interface** (surface shown to callers + tests).
- **Depth** = property of **Module**, measured against its **Interface**.
- **Seam** = where **Module**'s **Interface** lives.
- **Adapter** sits at **Seam**, satisfies **Interface**.
- **Depth** yields **Leverage** for callers, **Locality** for maintainers.

## Rejected framings

- **Depth as ratio of implementation-lines to interface-lines** (Ousterhout): rewards padding implementation. Use depth-as-leverage instead.
- **"Interface" as the TypeScript `interface` keyword or a class's public methods**: too narrow: interface here = every fact caller must know.
- **"Boundary"**: overloaded with DDD's bounded context. Say **seam** or **interface**.

## Going deeper

- **Deepening a cluster given its dependencies**, see [DEEPENING.md](DEEPENING.md): dependency categories, seam discipline, replace-don't-layer testing.
- **Exploring alternative interfaces**, see [DESIGN-IT-TWICE.md](DESIGN-IT-TWICE.md): spin up parallel sub-agents to design interface several radically different ways, compare on depth, locality, seam placement.
