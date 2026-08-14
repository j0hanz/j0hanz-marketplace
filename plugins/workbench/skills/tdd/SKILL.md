---
name: tdd
description: 'Test-first: build behavior through the red-green loop. Use when writing code that adds new behavior, when asked to work test-first, to decide what to mock, or to judge whether a test earns its place. Not for throwaway code built to react to (prototype), or for proving a landed change met its spec (verify-specs).'
---

# Test-Driven Development

Test-first buys one thing: a test you have watched **red**.

Where a spec exists it supplies the test list — [write-specs](../write-specs/SKILL.md) names the single observation that falsifies each requirement, and that observation is the test you write. Inside a plan, this loop is how a step that adds behavior gets worked ([run-plan](../run-plan/SKILL.md)).

## Steps

### 1. Name the seams

A **seam** is a public boundary you can observe behavior through without reaching inside: an exported function, an HTTP route, a module's public API, a CLI. A test earns its place when it can fail at the seam for a reason a caller would care about — if the only way to break it is to rename a private helper, it tests structure, not behavior.

Write down the seams under test before any test exists, and confirm them. Where the surface is wide, fan out [research](../research/SKILL.md) to find the callers and the conventions the tests must match.

**Done when** the seam list is written and confirmed against its callers, and every requirement ID in scope maps to a seam on it — every test written sits at a confirmed seam.

### 2. Red

Write one failing test at one seam, then run it. A test that errors on a missing import, a typo, or a file that does not exist yet is not **red**, it is broken.

**Done when** the test is **red** for the reason you predicted.

### 3. Green

Write the least code that turns that one test **green** — only the branch the current test exercises.

**Done when** the new test has been **red** at least once and now passes, every existing test still does, and the new test satisfies every rule in [Writing the test](#writing-the-test): one act, value asserted rather than shape, expected value sourced from outside the code, name carrying the requirement ID.

Repeat 2–3 until every seam on the list carries a test that has been red at least once. Each pass is a **vertical slice**, and the test you write next is shaped by what the last slice taught you — a test written ahead of that, in bulk, was never red for a predicted reason.

**Land the slice, then refactor.** Restructuring while chasing green makes a design problem and a broken test indistinguishable; refactor against a green suite as its own pass, and hand the structure to [qc](../qc/SKILL.md).

## Writing the test

**Name it after the capability, and carry the requirement ID.** `R2 — expired token is rejected` tells you what the system does and which requirement it answers; `checkout calls paymentService.process` describes plumbing a refactor is free to change.

**One act per test** — a single call to the seam, so a failure names one behavior. Setup before it, assertions after. Two acts in one test means two tests.

**Assert the value, not the shape.** `toBe("confirmed")` fails loudly the day the status changes; `toBeTruthy()` and `not.toBeNull()` keep passing for the wrong reasons. Several `expect`s describing one outcome are still one assertion; two unrelated outcomes are two tests.

**Expected values come from outside the code** — a known-good literal, a worked example, the requirement's `Then` clause. A value recomputed the way the implementation computes it is a **tautology**.

```ts
// tautological — the expectation reimplements the function
test('calculateTotal sums line items', () => {
  const items = [{ price: 10 }, { price: 5 }];
  const expected = items.reduce((sum, i) => sum + i.price, 0);
  expect(calculateTotal(items)).toBe(expected);
});

// independent — 15 was worked out by hand
test('calculateTotal sums line items', () => {
  expect(calculateTotal([{ price: 10 }, { price: 5 }])).toBe(15);
});
```

## Boundaries

Everything you own runs for real: your own modules, internal collaborators, the dependencies of the code under test. Mock only where a slice's seam crosses a **system boundary** — what you do not own and cannot make deterministic:

- External APIs: payments, email, third-party HTTP
- Time and randomness
- The file system — prefer a real temp directory; mock only where the test must assert on a path the OS will not give you
- The database — prefer a real test database

**Inject boundary dependencies rather than constructing them.**

```ts
// injected — the test hands in its own client
function processPayment(order, paymentClient) {
  return paymentClient.charge(order.total);
}

// constructed — the boundary is welded shut
function processPayment(order) {
  const client = new StripeClient(process.env.STRIPE_KEY);
  return client.charge(order.total);
}
```

**Give a boundary one function per operation.** An SDK-shaped object lets each mock return one fixed shape, types each response separately, and shows at a glance which endpoints a test exercises. A single generic fetcher pushes an `if` chain over endpoints into every mock.

```ts
// SDK-shaped — each operation mocks independently
const api = {
  getUser: (id) => fetch(`/users/${id}`),
  getOrders: (userId) => fetch(`/users/${userId}/orders`),
  createOrder: (data) => fetch('/orders', { method: 'POST', body: data }),
};
```

## Test smells

Tells that a test already written is bound to implementation rather than behavior.

**It breaks under refactoring while behavior held still.** The test reached inside — mocked an internal collaborator, called a private method, or asserted on call counts and ordering. Assert on what the **seam** returns or does.

**It verifies through a side channel.** Reaching past the interface to a database row, a log line, or a private field couples the test to storage instead of behavior. Verify through the interface a caller would use.

```ts
// side channel — passes even if the read path is broken
test('createUser saves to database', async () => {
  await createUser({ name: 'Alice' });
  const row = await db.query('SELECT * FROM users WHERE name = ?', ['Alice']);
  expect(row).toBeDefined();
});

// through the interface
test('createUser makes user retrievable', async () => {
  const user = await createUser({ name: 'Alice' });
  expect((await getUser(user.id)).name).toBe('Alice');
});
```

**It was written in bulk.** A test written before the implementation taught you anything locks in an imagined structure, and the suite drifts insensitive to real changes.

## Referencing

Tests live in the repo, not in the per-change directory the rest of the chain writes to. What travels between them is the requirement ID: a test name carries it verbatim, so a failing run names the requirement that broke and [verify-specs](../verify-specs/SKILL.md) can take the test name itself as evidence.

```ts
test("R2 — expired token is rejected", async () => { … });
```

One ID per test where the requirement has one; a test covering behavior no requirement names states the capability alone. IDs are stable ([write-specs](../write-specs/SKILL.md)), so a name written today keeps pointing at the same requirement.

Once the loop exits, the landed change goes to [verify-specs](../verify-specs/SKILL.md): a green suite proves the tests you wrote pass, not that every requirement arrived.
