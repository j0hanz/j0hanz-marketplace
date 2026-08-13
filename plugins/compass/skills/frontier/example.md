# Worked example

Illustrative, not a live effort.

Effort: **Migrate the auth schema from session cookies to JWTs.**

## The map

`docs/plan/2026-08-03-auth-jwt/auth-jwt.map.md`:

```markdown
---
kind: frontier-map
id: M-01
title: Migrate the auth schema from session cookies to JWTs
status: open
created: 2026-08-03T10:00:00Z
---

## Destination

A merged migration that issues JWTs on login and validates them on every
protected route, with session cookies and the session store removed.

## Notes

- Stack: Node + Express + Postgres.
- Standing preference: no new runtime dependencies unless a decision ticket
  names one and why the stdlib or an existing dep can't cover it.

## Decisions so far

- [What token lifetime should the JWT carry?](tickets/T-01-token-lifetime.md) — 15-minute access token with a rotating refresh token.
- [Which JWT library is maintained and fits our Node version?](tickets/T-02-jwt-library.md) — `jose` v5; maintained, native crypto, no Node version gap.

## Not yet specified

- Rollout — whether both schemes validate side by side during the migration,
  or the cutover is a single deploy. Waits on the rotation strategy.

## Out of scope

- [Integrate OAuth/SSO providers](tickets/T-06-oauth-sso.md) — separate effort; this migration only replaces the session-cookie schema.

## Superseded

- [Provision a signing key in the secrets store](tickets/T-03-signing-key.md) — HS256 assumed before the library landed; replaced by [Provision an RS256 key pair and publish the JWKS](tickets/T-05-rs256-keypair.md).
```

## A resolved grilling ticket

`docs/plan/2026-08-03-auth-jwt/tickets/T-01-token-lifetime.md`:

```markdown
---
kind: frontier-ticket
id: T-01
title: What token lifetime should the JWT carry?
map: M-01
status: closed
type: grilling
priority: 10
blocked_by: []
claimed:
---

## Question

What token lifetime should the JWT carry, and does it pair with a refresh
token?

Priority 10: the lifetime gates rotation, library choice, and key provisioning.

## Resolution

Confirmed with the user: a 15-minute access token issued at login, paired with
a rotating refresh token. Short-lived access limits replay windows; the refresh
flow keeps sessions usable across the access token's expiry. Logout invalidates
both.

Material uncertainty: rotation reuse detection — rejecting a refresh token
presented twice — is deferred to T-04.
```

## A resolved research ticket

Only the two sections a `grilling` ticket does not have:

```markdown
## Research context

- Unblocks: where the refresh token lives, and the signing-key provisioning task.
- Starting sources: Node.js `crypto` docs, the `jose` and `jsonwebtoken` READMEs
  and release history.
- Scope: sign/verify/rotate only; no OAuth, no JWKS caching unless rotation
  demands it. Evidence: URLs for anything claimed about maintenance or support.

## Resolution

`jose` v5. Maintained (weekly commits), runs on Node 20 LTS, uses the native
WebCrypto subtle APIs — no extra runtime dep beyond itself.

Evidence:

- `jose` README and v5 changelog: https://github.com/panva/jose
- Node 20 `crypto.subtle` docs: https://nodejs.org/api/webcrypto.html

Material uncertainty: no benchmark against `jsonwebtoken` for sign/verify
throughput; if auth hot-path latency surfaces later, it opens as a fresh
benchmark ticket rather than reopening this one.
```

## The redraw it triggered

Closing T-02 triggered one redraw round:

- T-03 superseded and closed — its resolution records why (`jose`'s JWKS helpers make an asymmetric pair the cheaper path for a multi-service verify) and links T-05 as the replacement. Its gist moves to **Superseded**, not **Decisions so far**.
- T-05 created through the barrier: allocated, written `initializing`, graph validated, committed to `open`.
- Fog patch _"signing-key approach — symmetric (HS256) or asymmetric (RS256) — depends on what the library supports"_ cleared from **Not yet specified**, since T-02 settled it. Fresh fog written in its place: rollout.
- Every other open ticket read against the resolution and recorded unaffected.
