# Security Hardening Checklist

Mandatory when a Node.js service handles authentication, payments, user data, public traffic, or compliance scope. Every item accounted for: applied, or skipped with a stated reason.

## Code and dependencies

- [ ] Security linter rules active (`eslint-plugin-security`, `eslint-plugin-no-unsanitized`).
- [ ] Dependency vulnerabilities audited in CI (`npm audit --audit-level=high`) _and_ scanned with a behavioral supply-chain tool (e.g. Socket.dev) — CVE databases alone miss novel malicious releases; outdated dependencies reviewed on schedule.
- [ ] Committed lockfile (`package-lock.json`) enforced in CI/prod builds via `npm ci --ignore-scripts` — belt-and-suspenders alongside npm's own default-blocked install scripts (audit pending scripts and commit an explicit allowlist rather than approving blind).
- [ ] Built-in Node modules imported with explicit `node:` prefix.
- [ ] Dynamic execution (`eval`, `new Function`, dynamic `require`) strictly eliminated.
- [ ] Untrusted code executed strictly within dedicated sandboxes (`isolated-vm`, WebAssembly/WASI runtimes, or isolated OS subprocesses / ephemeral containers) — `node:vm` is not a security sandbox.
- [ ] `child_process`: use `execFile` or `spawn` with explicit argument arrays; sanitize input if `shell: true` is unavoidable.
- [ ] npm publishing (if applicable) uses Trusted Publishing (OIDC) from CI instead of long-lived tokens — classic tokens are retired; any remaining tokens are granular, short-lived, and rotated.
- [ ] Package provenance/signatures verified for critical dependencies (`npm audit signatures`); distribution restricted via `files` field or `.npmignore`.

## Web and API

- [ ] Rate limiting and concurrent connection caps configured on public and authentication routes.
- [ ] Payload size limits enforced on body parsers and file uploads.
- [ ] Incoming request payloads validated against strict schemas (Zod/Valibot/ArkType) at the route layer.
- [ ] Database queries parameterized or executed via ORM/query builders.
- [ ] Prototype pollution prevented: use `Object.create(null)` or `Map` for dynamic key stores; strip `__proto__`, `constructor`, and `prototype` keys during JSON and query parsing.
- [ ] Secret and signature comparisons executed with constant-time equality via `node:crypto.timingSafeEqual`.
- [ ] Security headers enabled via `helmet`; CORS origin configured with explicit domain whitelist (avoid origin reflection).
- [ ] Session cookies configured with `httpOnly`, `secure`, `sameSite`, short TTL, and secret loaded from environment.
- [ ] Error responses return status, machine-readable code, and sanitized client message; stack traces and internal errors logged server-side only.
- [ ] Stateless JWTs verified for pinned algorithm (e.g., `RS256`, `EdDSA`), signature integrity, and expiration; pair short-lived access tokens with rotating refresh tokens and family revocation. For greenfield services, **PASETO** removes JWT's algorithm-confusion class of bugs entirely.
- [ ] Authentication endpoints rate-limited per-IP and per-account with failed attempts logged for alerting.
- [ ] Regular expressions checked for catastrophic backtracking (ReDoS) to prevent blocking the single-threaded event loop.
- [ ] Multi-tenant data queries enforce tenant ID filters at the repository layer.

## Data and secrets

- [ ] Passwords hashed with `argon2id` (RFC 9106 minimum: m=19MiB, t=2, p=1); fall back to `node:crypto.scrypt` (N=2^17, r=8, p=1) only if argon2id is unavailable — `bcrypt` is legacy-only. If pre-hashing long inputs, use HMAC-SHA384 with a pepper, never raw SHA-256 (risks null-byte truncation).
- [ ] Application secrets loaded strictly from environment variables or a secret manager.
- [ ] Encryption keys rotated; log serializers redact sensitive fields (tokens, passwords, Authorization headers).

## Runtime

- [ ] Process executed as a non-root user.
- [ ] Node.js Permission Model (`--permission`, `--allow-fs-read`, `--allow-net`) applied where applicable for defense-in-depth resource sandboxing; profile first with non-blocking `--permission-audit` before enforcing.
- [ ] Programmer errors initiate graceful connection draining, fatal logging, and clean process exit (`process.exit(1)`).
- [ ] TLS enforced across all production endpoints, terminated at the reverse proxy or load balancer.
