# Ledger format and carry-forward rules

## File format

```markdown
# bug-hunt ledger

State file — findings are reported in chat, not here.

audited-through: <commit sha, or "no-git">
audited-at: <YYYY-MM-DD>
dirty-at-audit: src/a.ts, src/b.ts
unaudited-in-scope: src/legacy/ (size cap, YYYY-MM-DD)

## Worklist — in-scope, this audit

- [pending] `src/queue.ts` — retry path, money
- [done] `src/pager.ts` — pagination only, low risk

## Dismissed — do not re-report

- `pageOffset` — `for (let i = 0; i <= pages; i++)` — off-by-one in page offset — user: intentional, 0-indexed by design (YYYY-MM-DD) — `src/pager.ts:120`

## Open — carried forward

- [Critical] [confirmed] `verifyToken` — `if (token == expected) {` — compared with `==`, not constant-time — checked: `src/crypto.ts`, `src/middleware.ts` — first reported YYYY-MM-DD — `src/auth.ts:44`
- [Major] [suspected] `retryCharge` — `await chargeOnce(order.id)` — retry may double-charge; settles it: does `chargeOnce` dedupe by idempotency key? — checked: `src/orders.ts` — first reported YYYY-MM-DD — `src/queue.ts:88`
```

The `checked` list on an Open entry holds the file paths cited in the finding's `Ruled out` line — extracted by the hub when it writes the entry, so carry-forward rule 3 can tell whether a Ruled-out guard changed. Identity for matching is still symbol + excerpt (see Matching key), never `checked`.

## Carry-forward rules

Applies to any run where `.bug-hunt.md` exists.

1. Read ledger first, before all else.
2. File counts **unchanged** if it appears in neither `git diff --name-only <audited-through>..HEAD` nor current uncommitted changes, and is not listed under `dirty-at-audit`.
3. Carry forward each **Open** finding whose file is unchanged — re-report in chat, no re-derive. If a path in its `checked` list (the files its `Ruled out` line cited) changed, re-verify instead of blind carry: re-dispatch a refuter against the finding with the changed `checked` path named as required reading, using the refuter dispatch prompt in `../SKILL.md`. Route the verdict as usual — `killed` drops it from Open (say why in the report), `confirmed` re-reports under Confirmed, `suspected` re-reports under Suspected carrying the refuter's check as **Settles it**.
4. Drop carried findings whose file changed; that file is back in scope, gets fresh audit. Drop findings whose file is gone, and say so in report.
5. Never re-report anything under **Dismissed**, unless symbol containing cited excerpt changed — then report again and say explicitly why back.

## Matching key

Open and Dismissed entries match on **symbol plus one-line verbatim excerpt**, never on `file:line`. Trailing `file:line` is location hint only; lines drift on every unrelated edit above them, and ledger keyed on drifting lines re-raise settled findings. Match needs same enclosing symbol and same excerpt line, ignoring leading and trailing whitespace. Symbol renamed or excerpt line rewritten = no match; finding is fresh. The `checked` list is not part of the matching key — it exists only to feed carry-forward rule 3.

Path deliberately excluded here — a moved or renamed file must not resurrect a settled finding. Hub dedupe within one run keys differently: file plus symbol plus excerpt, since two files can hold the same symbol name.

## Worklist lifecycle

- Written by main thread right after map, one entry per in-scope changed file, each `[pending]` with one-line risk note.
- Flip to `[done]` as each hunter returns its cluster.
- Deleted from ledger entirely once every entry `[done]`. Empty worklist = no worklist.
- Run ending with `[pending]` entries leaves them in place; next run takes those files as its changed-set instead of re-resolving scope from git.
- **`audited-through` advances only to the sha whose full diff has been audited.** A run that resumes a pending worklist, or any run ending with `[pending]` entries, keeps the value it read — advancing it would silently drop the intervening diff from all future scope. A cold run whose worklist completes writes `audited-through` = HEAD.
- **Resume still re-maps and re-partitions — over pending files only.** Worklist stores files, never clusters: a cluster is changed files plus blast radius, and blast radius is derived from the tree at map time. Persisting it would cache a set that goes stale the moment a new caller appears, and a resumed run would then miss that caller — exactly the failure the blast-radius rule exists to catch. Cheaper than a cold run because the changed-set is smaller, not because mapping is skipped. A resumed run greps exported symbols for the pending files and partitions fresh.
- **Staleness:** a pending worklist is **discarded**, not resumed, when HEAD has advanced past the ledger's `audited-through` — the scope it described no longer matches the tree. Re-resolve scope from git via rule 3. (Decision is made at run start, when both the ledger's stored `audited-through` and current HEAD are known.)
- **Staleness without git:** `audited-through: no-git` never ages, so that comparison never fires. Discard the worklist instead whenever the scope the user names this run is not the same scope the worklist covers. Resume only on an identical scope.
- `unaudited-in-scope` is fed by two sources: total size cap at partition time, and any hunter `not_audited` entry naming in-scope file or directory. Each entry carries reason and date. Entry clears only when that path audited, never by aging out.

- `dirty-at-audit` is written with any in-scope file that had uncommitted changes at audit time — scope rule 4 fired, or a hunter observed the file change while reading. Each entry carries date; entry clears once that path is next audited clean. Files under `dirty-at-audit` get re-audited next run regardless of diff, because the version a hunter read mid-edit may not match the committed tree.

**Without git**, no incremental skip: ledger still holds Dismissed, Open, and worklist entries, but user must name scope each time. Say so, do not pretend work was skipped safely.
