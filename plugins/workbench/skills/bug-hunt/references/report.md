# Report skeleton

Hub reads this when it writes the report, at the end of a run. Findings go to chat every run — a findings file is a document nobody reopens, and the report is only useful at the moment it lands.

```markdown
## Verdict

<N Critical, N Major, N Minor confirmed; N suspected> — <safe to ship / fix first>. <The single worst thing, one sentence.>

## Confirmed

### [Critical] Short title — `path/to/file.ext:120` <(carried from YYYY-MM-DD) — only when carried from ledger>

- **What:** what is actually wrong
- **Trigger:** the exact input, state, or sequence that causes it
- **Impact:** what breaks, for whom
- **Ruled out:** where this could have been handled and isn't — e.g. "`validate.ts:40` checks length but not null; the only caller `api.ts:88` passes the raw body"
- **Fix:** described or sketched — never applied

### [Major] ...

## Suspected

### [Major] Short title — `path/to/file.ext:44` <(carried from YYYY-MM-DD) — only when carried from ledger>

- **Why suspected:** the reasoning
- **Settles it:** the one check that would confirm or kill this

## Questions

<Only when the intended behavior is genuinely unknowable from the code. Not a dumping ground.>
- `path/to/file.ext:77` — is a negative quantity meant to be rejected, or treated as a refund?

## Coverage

<Every hunter's coverage object merged into one view.>

- **Read fully:** N files <list them when 15 or fewer>
- **Pulled in by blast radius:** <files and why>
- **Not audited:** <what and why — size cap, generated, no access>
- **Assumed:** <third-party behavior taken on trust>

## Ledger

Updated `.bug-hunt.md` — audited through `<ref>`, N carried forward, N dismissed. <Non-empty worklist: N files remain unhunted; a re-run resumes there.>
```

## Ranking

Rank findings by severity, then by number of call sites affected — never by discovery order.

Verdict counts cover this run's findings **plus** Open findings carried forward from the ledger — a carried Critical is still a ship-blocker. The Ledger line says how many of the count were carried, and every carried finding is tagged `(carried from <date>)` in its own heading. An untagged carried finding reads as new work and gets re-triaged.
