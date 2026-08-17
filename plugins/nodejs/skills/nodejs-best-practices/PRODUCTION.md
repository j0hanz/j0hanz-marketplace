# Production and Docker Readiness Checklist

Mandatory prior to any deployment, containerization, or scaling work. Every item accounted for: applied, or skipped with a stated reason.

## Process and runtime

- [ ] `NODE_ENV=production` set across all production environments.
- [ ] Active LTS Node version pinned identically across development, CI, and production.
- [ ] Build and deploy pipelines execute `npm ci` against the committed lockfile.
- [ ] Package manager version pinned via Corepack (`packageManager` field in `package.json`) alongside the Node version, eliminating npm-version drift across environments.
- [ ] Stateless processes: sessions, cache, and shared state stored in external Redis or database instances.
- [ ] Multi-core scaling: single process per container managed by orchestrator replicas, or `node:cluster` on bare metal.
- [ ] Graceful shutdown on `SIGTERM`: stop accepting connections $\rightarrow$ drain in-flight requests $\rightarrow$ close DB pools and queues $\rightarrow$ exit within a 10-second hard timeout.
- [ ] Heap memory is container-aware by default: Node 20+ auto-detects the cgroup memory limit and caps the old-space heap near 50% of it (up to a ~2GiB ceiling) — only override `--max-old-space-size` to exceed that ceiling or for workload-specific tuning, not as routine practice. Set `--heapsnapshot-near-heap-limit=3` for diagnostic post-mortem dumps before OOM abort, and `--heapsnapshot-signal=SIGUSR2` for on-demand snapshots via `kill -USR2 <pid>`.
- [ ] Health check endpoints (`/healthz/liveness`, `/healthz/readiness`) wired to orchestrator probes.

## Observability

- [ ] Structured JSON logging to `stdout` via Pino (disable `pino-pretty` in production to prevent event-loop lag).
- [ ] Request correlation IDs generated at edge, propagated across async calls via `AsyncLocalStorage` (`node:async_hooks`), and attached to all log entries and outbound HTTP calls.
- [ ] APM monitoring active for error rates, latency percentiles (P95/P99), Event Loop Utilization (`performance.eventLoopUtilization()`), and heap/RSS memory usage.
- [ ] Distributed tracing and metrics instrumented via OpenTelemetry (`@opentelemetry/sdk-node` + `@opentelemetry/auto-instrumentations-node`, bootstrapped with `node --import ./instrumentation.js`), exported via OTLP; Pino logs correlated to trace/span IDs.

## Delegation and networking

- [ ] Static asset serving, gzip/brotli compression, TLS termination, and rate-limit prefiltering delegated to reverse proxy (Nginx/CloudFront/ALB) or CDN.

## Docker and containers

- [ ] Multi-stage Dockerfile: build stage compiles TypeScript/assets; runtime stage packages only production `node_modules` and compiled distribution (services relying solely on Node's native type-stripping can skip compilation entirely — run `.ts` files directly and use `tsc --noEmit` only for CI type-checking).
- [ ] Small explicit base image: pinned to the current Active LTS slim tag (Debian glibc — e.g. `node:24-slim`; migrate to `node:26-slim` once it becomes Active LTS in October 2026) for native addon stability and memory performance, pinned with sha256 digest. For stricter supply-chain requirements (SLSA, FedRAMP), use Chainguard's distroless `cgr.dev/chainguard/node` (glibc-compatible, near-zero CVEs, built-in SBOM/provenance).
- [ ] Container init process: use `dumb-init` or `tini` as PID 1 to ensure proper signal forwarding and zombie process reaping, with Node executing `dist/server.js`.
- [ ] Container process runs as non-root user (`USER node` or custom non-root UID).
- [ ] `.dockerignore` excludes `.env*`, `.git`, `node_modules`, and local build artifacts.
- [ ] Docker layer caching ordered: copy `package*.json` $\rightarrow$ run `npm ci --omit=dev` $\rightarrow$ copy application source $\rightarrow$ compile.
- [ ] Build-time secrets passed exclusively via BuildKit secret mounts (`--mount=type=secret`).
- [ ] Container images scanned for vulnerabilities (Trivy, Docker Scout) in CI pipeline, with an SBOM generated (`docker sbom`, syft) for compliance traceability.
