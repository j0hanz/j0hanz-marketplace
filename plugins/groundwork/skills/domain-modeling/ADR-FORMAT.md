# ADR Format

ADRs live in `docs/adr/`, sequential numbering: `0001-slug.md`, `0002-slug.md`, etc.

Create `docs/adr/` lazily: only when first ADR needed.

## Template

```md
# {Short title of the decision}

{1-3 sentences: what's the context, what did we decide, and why.}
```

That's it. ADR can be single paragraph. Value in recording _that_ decision made and _why_, not filling sections.

## Optional sections

Include only when genuine value. Most ADRs won't need.

- **Status** frontmatter (`proposed | accepted | deprecated | superseded by ADR-NNNN`): useful when decisions revisited
- **Considered Options**: only when rejected alternatives worth remembering
- **Consequences**: only when non-obvious downstream effects need calling out

## Numbering

Scan `docs/adr/` for highest existing number, increment by one.

## When to offer an ADR

All three must be true:

1. **Hard to reverse**: cost of changing mind later meaningful
2. **Surprising without context**: future reader looks at code, wonders "why on earth did they do it this way?"
3. **The result of a real trade-off**: genuine alternatives existed, picked one for specific reasons

Easy to reverse → skip: just reverse it. Not surprising → nobody wonders why. No real alternative → nothing to record beyond "we did the obvious thing."

### What qualifies

- **Architectural shape.** "We're using a monorepo." "The write model is event-sourced, the read model is projected into Postgres."
- **Integration patterns between contexts.** "Ordering and Billing communicate via domain events, not synchronous HTTP."
- **Technology choices that carry lock-in.** Database, message bus, auth provider, deployment target. Not every library: only ones taking a quarter to swap out.
- **Boundary and scope decisions.** "Customer data is owned by the Customer context; other contexts reference it by ID only." Explicit no-s valuable as yes-s.
- **Deliberate deviations from the obvious path.** "We're using manual SQL instead of an ORM because X." Anything where reasonable reader assumes opposite. Stops next engineer "fixing" something deliberate.
- **Constraints not visible in the code.** "We can't use AWS because of compliance requirements." "Response times must be under 200ms because of the partner API contract."
- **Rejected alternatives when the rejection is non-obvious.** Considered GraphQL, picked REST for subtle reasons → record it; else someone suggests GraphQL again in six months.
