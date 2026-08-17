---
name: nodejs-best-practices
description: 'Node.js backend conventions — framework selection, API layering, error propagation, async performance, boundary validation, testing, security, and production gates. Use when architecting, building, reviewing, or deploying Node.js backend services. Not for browser/frontend JavaScript.'
user-invocable: false
metadata:
  category: reference
---

# Node.js Best Practices

Evaluate project constraints and select explicit matches. For security-sensitive surfaces (auth, payments, user data, public traffic), load [SECURITY.md](SECURITY.md). Prior to deployment or containerization, load [PRODUCTION.md](PRODUCTION.md). Applying a section means every checklist item in it is accounted for: applied, or skipped with a stated reason.

## 1. Framework

Default: **Fastify** (high throughput, schema-first validation, native TypeScript). Select alternatives when constraints match:

| Condition                                                  | Choice                                                                          | Rationale                                                                                                    |
| :--------------------------------------------------------- | :------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------- |
| Edge/serverless, or minimal-footprint general Node service | **Hono**                                                                        | ~14KB, web-standard Request/Response; identical code on Node (`@hono/node-server`), Bun, Deno, edge runtimes |
| Enterprise codebases requiring structured DI               | **NestJS**                                                                      | Enforced modular conventions across teams (Express 5 by default; swap in the Fastify adapter for throughput) |
| Codebase with an established Express middleware ecosystem  | **Express**                                                                     | Express 5.x is stable; ecosystem compatibility                                                               |
| Type-safe full-stack RPC API                               | **tRPC** (internal TS monorepo) or **oRPC** (adds OpenAPI + REST compatibility) | Shared end-to-end TypeScript types                                                                           |

## 2. Runtime and modules

- **Runtime**: Node.js Active LTS pinned via `.nvmrc` and `package.json#engines`. Use native `node --watch` for local development hot-reloading (eliminating nodemon). (Bun/Deno reserved for dedicated standalone tooling).
- **TypeScript**: Use Node built-in type stripping (`--experimental-strip-types` since 22.6, unflagged since 23.6, stable since 24) for lightweight scripts and small services adhering to erasable syntax (interfaces, type aliases, type-only imports; enums, namespaces, and parameter properties need `--experimental-transform-types` instead of the stable stripper). Enforce with TypeScript's `erasableSyntaxOnly` compiler option (TS 5.8+) so the codebase never silently drifts onto non-erasable syntax. Use standard build tools (`tsc`, `tsup`, `tsx`, `esbuild`) for production services and decorator-heavy frameworks (NestJS).
- **Modules**: ESM (`import`/`export`) by default. Import built-ins with explicit `node:` prefix (`node:fs/promises`, `node:crypto`).

## 3. Architecture

Organize by **business domain module** (`users/`, `orders/`, `billing/`), each internally layered:

```
module/
├── routes/controller  — HTTP transport, parameter extraction, boundary validation
├── service            — business logic, framework-agnostic
└── repository         — data access, database queries, ORM entities
```

Configuration resolves hierarchically: defaults < `.env` (loaded natively via `node --env-file=.env`) < environment variables. Load secrets strictly from environment variables or a secret manager.

## 4. Errors

Split errors into two distinct lifecycles:

- **Operational errors** (invalid input, resource not found, upstream timeout): Return structured HTTP responses and maintain continuous uptime.
- **Programmer errors** (unhandled exceptions, null dereferences): Log error context, stop accepting new connections, drain active requests, and forcefully terminate (`process.exit(1)`) to let the container orchestrator restart a clean instance.

Handling rules:

- Throw custom domain error classes carrying HTTP status codes and machine-readable `code` identifiers.
- Consolidate error mapping in a single central error middleware at application root.
- Server logs receive stack trace, request parameters, and correlation ID; HTTP responses receive only user-safe message, status, and code.
- Return or `await` all promises inside async handlers to preserve full asynchronous stack traces.
- Attach error event listeners to streams, event emitters, and process unhandled rejection hooks.

## 5. Async and the event loop

- Execute independent asynchronous operations concurrently with `Promise.all` or `Promise.allSettled`.
- Offload CPU-bound tasks (cryptography, image transformations, heavy parsing) to worker threads, background queues, or dedicated services.
- Use `node:fs/promises` in request execution paths; reserve synchronous `fs` methods exclusively for startup initialization.
- Stream large file payloads and database query results rather than buffering in memory.
- Prefer modern built-in APIs over third-party packages: `node:crypto.randomUUID()`, `structuredClone()`, global `fetch`/`Request`/`Response`, `node:util.parseArgs()`, `AsyncLocalStorage` (`node:async_hooks`) for request context propagation, and `performance.eventLoopUtilization()` (`node:perf_hooks`) for event loop health.

## 6. Validation

Validate all external inputs at the boundary: request body, query params, headers, environment variables, and third-party API responses.

Default: **Zod v4** (2.3× smaller core bundle, up to 14× faster parsing, ~100× faster type instantiation than v3 — confirm the lockfile resolves v4, not legacy v3). Switch when constraints match: edge bundle size $\rightarrow$ **Valibot**, or `zod/mini` (~1.9KB) to stay on the Zod ecosystem; hot-path throughput $\rightarrow$ **ArkType** (Zod v4 has narrowed this gap significantly — benchmark before switching). Reject invalid payloads immediately at the route boundary before passing to domain services.

## 7. Security

Baseline requirements for every service (full hardening checklist: [SECURITY.md](SECURITY.md) — load for auth, payment, public-facing, or compliance-sensitive work):

- Validate all boundary inputs with strict schemas; parameterize all database queries.
- Hash passwords with `argon2id`; pin JWT algorithms and verify signature and expiration.
- Apply rate limiting on public and auth endpoints; enforce payload size caps.
- Enable security headers via `helmet`; configure explicit CORS allowed domain origins.
- Load secrets strictly from environment/secret managers; enforce committed lockfile via `npm ci --ignore-scripts`, and verify package provenance/signatures (`npm audit signatures`) for critical dependencies.
- Check regular expressions for ReDoS vulnerabilities to protect the single-threaded event loop.

## 8. Testing

Default runner: built-in `node --test` with `node:assert` — stable, with built-in mocking (`mock.fn`, `mock.module`, `mock.timers`), coverage, and watch mode. Switch to **Vitest** for snapshot testing (`node:test`'s one missing feature), richer mocking ergonomics, or Jest compatibility. API integration tests via **Supertest** or native `fetch` against the test server instance.

Execution standards:

- Structure test cases with explicit context and expected outcome; organize bodies into **Arrange–Act–Assert**.
- Provide isolated database records per test case; mock external third-party HTTP dependencies.
- For critical paths (auth, billing, transactional workflows), assert all applicable side effects: response payload, database state mutations, outbound HTTP calls, queued jobs, and emitted telemetry.

## 9. Production

Pre-deploy baseline (full production and Docker checklist: [PRODUCTION.md](PRODUCTION.md) — load before deployment, containerization, or scaling work):

- Set `NODE_ENV=production`, pin Active LTS Node, and execute `npm ci` from committed lockfile.
- Stream structured JSON logs directly to `stdout` with request correlation IDs via Pino.
- Instrument distributed tracing and metrics with OpenTelemetry (`@opentelemetry/sdk-node` + auto-instrumentations, bootstrapped via `node --import`), correlated with Pino logs through shared trace/span IDs.
- Maintain stateless processes; delegate TLS termination, compression, and static assets to a reverse proxy.
- Implement graceful shutdown on `SIGTERM` with active connection draining and hard exit timeout.

## Decision checklist

Account for each item before completing implementation; clarify ambiguous constraints with the user:

- [ ] Framework selected according to routing and runtime requirements.
- [ ] Active LTS Node version pinned in `.nvmrc` and `package.json`.
- [ ] Codebase structured into domain modules with route, service, and repository layers.
- [ ] Central error-handling middleware registered with operational vs programmer error branching.
- [ ] Asynchronous request paths free of blocking synchronous calls or unhandled promise rejections.
- [ ] Input validation schemas attached to all route handlers and environment variables.
- [ ] Integration tests verify response payload and persistent state mutations for critical flows.
- [ ] Loaded [SECURITY.md](SECURITY.md) for public, auth, or sensitive data surfaces.
- [ ] Loaded [PRODUCTION.md](PRODUCTION.md) prior to containerization and deployment.
