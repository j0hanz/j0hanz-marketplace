# Worked example

One small run end to end. Read it once when a run's partitioning is not obvious — it shows why clusters and worklist entries are counted differently. Hub-only; no spoke reads this.

Repo on branch `feat/checkout`, tree clean, ledger exists with `audited-through: a1b2c3d`.

**1. Resolve.** Rule 3 matches. `git diff --name-only a1b2c3d..HEAD` gives `src/cart.ts`, `src/checkout.ts`, `src/format.ts`; `unaudited-in-scope` carries `src/legacy/tax.ts` from last run's size cap. Changed-set: 4 files.

**2. Map.** Grep every symbol those files export, repo-wide, before cutting anything. `cart.ts` exports `applyDiscount` — called in `checkout.ts` and `api/orders.ts`. `format.ts` exports `money` — called in 11 files.

**3. Partition.** Two clusters, not four:

- **Cluster 1** — changed `src/cart.ts`, `src/checkout.ts`; blast radius `api/orders.ts` (calls `applyDiscount`), `test/cart.test.ts`. The two changed files go together because they share `applyDiscount`; splitting them hands the caller to one hunter and the callee to another, and neither can judge the contract alone.
- **Cluster 2** — changed `src/format.ts`, `src/legacy/tax.ts`; the 11 `money` call sites sit in large view files, and reading enough of each to judge the contract busts the 1200-line budget well before the 15-file one. Pull the 3 that pass a computed value, record the other 8 under `not_audited`.

**4. Worklist.** Four `[pending]` entries, one per changed file — not two. Worklist is per file; dispatch is per cluster. The two counts are not meant to match.

**5. Dispatch, refute, report.** Two hunters. Cluster 1 returns two `confirmed-candidate` plus one `suspected`; cluster 2 returns one `confirmed-candidate`. The three candidates go to three blind refuters — one comes back `killed` and is dropped, appearing nowhere in the report. The `suspected` never goes to a refuter at all. Report: 2 Confirmed, 1 Suspected.

**6. Ledger.** Worklist deleted (every entry `[done]`). `src/legacy/tax.ts` clears from `unaudited-in-scope` — it was audited. The 8 unread `money` call sites are added to it, with reason and date, so the next run pulls them back.
