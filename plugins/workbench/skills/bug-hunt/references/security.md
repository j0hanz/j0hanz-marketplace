# Security checklist

Run only on files touching attack surface: external input (request params, headers, body, URL, files, messages), DB queries, auth/authz, sessions/tokens, crypto, outbound calls, serialization, process/shell exec. Check items that apply to file in hand; skip rest, no clean notes.

- **Injection** — SQL, command, template, header, path traversal.
- **Output encoding** — XSS; every rendered value escaped for its context?
- **Authentication** — every protected operation actually behind check?
- **Authorization / IDOR** — _ownership_ verified, not just logged in?
- **CSRF** — state-changing operations protected?
- **TOCTOU** — read-then-write with gap where state change.
- **Sessions and tokens** — fixation, expiry, secure/httpOnly flags, constant-time comparison for secrets.
- **Cryptography** — secure randomness, right algorithm, no secrets in logs or errors.
- **Information disclosure** — stack traces or internal identifiers in responses, secrets in logs, timing signal.
- **Resource exhaustion** — unbounded reads, allocations, loops driven by attacker-controlled size; missing limits.
- **Business logic abuse** — state-machine violations, replay, negative quantities, numeric overflow, rounding in money paths.

Security finding takes same Confirmed/Suspected bar as any other: reachability from real input, traced, guards you checked named in `Ruled out`. "Theoretically exploitable if attacker controls X" where nothing shows X is attacker-controlled is Suspected.
