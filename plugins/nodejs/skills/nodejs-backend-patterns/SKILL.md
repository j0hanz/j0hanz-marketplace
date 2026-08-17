---
name: nodejs-backend-patterns
description: 'Node.js backend architecture: use when building or refactoring Fastify/Express services that need fail-fast schema validation, layered controller/service/repository separation, pooled transactional data access, a single error envelope, or drain-based shutdown.'
user-invocable: false
metadata:
  category: reference
---

# Node.js Backend Patterns

Operational architecture guide for Node.js backends: `fail-fast` contracts, `layered` responsibilities, `pooled` data access, one `envelope`, graceful `drain`.

## Stack Defaults

- **Default**: Fastify + TypeScript + PostgreSQL (`pg`) + Zod + Pino.
- **Express**: Use when integrating into existing Express middleware pipelines.
- **MongoDB**: Use when document datastores are mandated by existing schema design.

## Core Steps

### 1. Define Boundary Contracts (`fail-fast`)

- Type every public route with explicit schemas for params, query, body, and responses.
- Validate at the HTTP layer; schema failures return 400 before reaching service logic.
- **Completion criterion**: Every public route defines strict schemas and returns 400 on schema failure.

### 2. Isolate Responsibilities (`layered`)

- **Controller**: Parse HTTP requests, delegate to service, return HTTP response codes.
- **Service**: Domain and business logic, authorization checks, transaction orchestration.
- **Repository**: Raw SQL/queries, data mapping, direct database pool interactions.
- Wire components using constructor-based dependency injection.
- **Completion criterion**: Every controller handles transport only (no SQL/DB imports); every service handles domain logic only (no HTTP request/response imports).

### 3. Manage Connections & Transactions (`pooled`)

- Configure database connection pools with explicit max connections, idle timeouts, and connection timeouts.
- Wrap multi-operation writes in atomic transactions (`BEGIN` / `COMMIT` / `ROLLBACK`).
- Release checked-out pool clients in `finally` blocks.
- **Completion criterion**: Every multi-statement write runs in a transaction that rolls back on error; every checked-out pool client is released on all execution paths.

### 4. Standardize Responses & Errors (`envelope`)

- Use a single top-level error handler mapping typed `AppError` subclasses to status codes.
- Return one JSON envelope for success (`{ status: "success", data }`) and failure (`{ status: "error", code, message }`); sanitize messages in production.
- **Completion criterion**: Every request-scoped error passes through the global error handler and returns the failure envelope with a sanitized message.

### 5. Wire Process Lifecycle (`drain`)

- Bind `SIGTERM` and `SIGINT` to a coordinated shutdown handler.
- Stop accepting new HTTP requests, drain in-flight requests within a grace timeout (e.g., 10s), then close DB pools and cache connections.
- Keep the force-exit timer unref'd so it never holds the event loop open.
- **Completion criterion**: Application exits with code 0 on termination signal after in-flight connections drain and pools close.

## Disclosed Reference

Implementation blueprints — schema definitions, DI container, pool configuration, transaction helper, error handler, shutdown handler — in [`resources/implementation-playbook.md`](resources/implementation-playbook.md). Load when implementing any step.
