# GLOSSARY.md Format

## Structure

```md
# {Context Name}

{One or two sentence description of what this context is and why it exists.}

## Language

**Order**:
{A one or two sentence description of the term}
_Avoid_: Purchase, transaction

**Invoice**:
A request for payment sent to a customer after delivery.
_Avoid_: Bill, payment request

**Customer**:
A person or organization that places orders.
_Avoid_: Client, buyer, account
```

## Rules

- **Be opinionated.** Many words same concept → pick best, list others under `_Avoid_`.
- **Keep definitions tight.** One or two sentences max. Define what it IS, not what it does.
- **Only include terms specific to this project's context.** General programming concepts (timeouts, error types, utility patterns) don't belong even if project uses them heavily. Before adding term, ask: concept unique to this context, or general programming concept? Only former belongs.
- **Group terms under subheadings** when natural clusters emerge. All terms in one cohesive area → flat list fine.

## Single vs multi-context repos

**Single context (most repos):** One `GLOSSARY.md` at repo root.

**Multiple contexts:** `GLOSSARY-MAP.md` at repo root lists contexts, where they live, how they relate:

```md
# Glossary Map

## Contexts

- [Ordering](./src/ordering/GLOSSARY.md): receives and tracks customer orders
- [Billing](./src/billing/GLOSSARY.md): generates invoices and processes payments
- [Fulfillment](./src/fulfillment/GLOSSARY.md): manages warehouse picking and shipping

## Relationships

- **Ordering → Fulfillment**: Ordering emits `OrderPlaced` events; Fulfillment consumes them to start picking
- **Fulfillment → Billing**: Fulfillment emits `ShipmentDispatched` events; Billing consumes them to generate invoices
- **Ordering ↔ Billing**: Shared types for `CustomerId` and `Money`
```

Skill infers which structure applies:

- `GLOSSARY-MAP.md` exists → read it to find contexts
- Only root `GLOSSARY.md` exists → single context
- Neither exists → create root `GLOSSARY.md` lazily when first term resolved

Multiple contexts → infer which one current topic relates to. Unclear → ask.
