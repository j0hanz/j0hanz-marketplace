# Learning Record Format

Learning records live in `./learning-records/`, sequential numbering: `0001-slug.md`, `0002-slug.md`, etc. Create directory lazy — only when first record written.

Teaching equivalent of ADRs: capture non-obvious lessons, key insights, stated prior knowledge that steer future sessions. Used calculate zone of proximal development.

## Template

```md
---
next: YYYY-MM-DD
interval: 1
lesson: NNNN-slug
lapses: 0
---

# {Short title of what was learned or established}

{1-3 sentences: what was learned (or what prior knowledge was established), and why it matters for future sessions.}
```

Frontmatter required. `next` = date record due retest; `interval` = current gap days; `lesson` = `NNNN-slug` of lesson record learned from (lets step 5 of [SKILL.md](../SKILL.md) interleave by distinct source lesson; missing = unknown, counts distinct); `lapses` = times cold-open item answered wrong since last correct answer (missing = 0; step 8 increments on Wrong, resets to 0 on Right, step 4 reads it). Record written today seeds `interval: 1`, `next` = tomorrow, `lapses: 0` — all from system clock, never memory. `interval` and `lapses` rewrite only when user actually answered that item; `next` also move when cold open abandoned unscored, so pool keep rotating — see [Scoring](#scoring) and steps 5 and 8 in [SKILL.md](../SKILL.md).

Below frontmatter, that whole format. Learning record can be single paragraph. Value = recording _that_ this now known and _why_ it changes what teach next — not filling out sections.

## Scoring

`skills/teach/scripts/teach.py score` applies this table to every record open cold-open ledger names — five rows, first match wins. `teach.py` rewrites each record per-file atomic (tmp + replace), records saved before ledger line deleted; preserves unknown keys and body byte-for-byte — but no cross-file transaction, so crash mid-score may leave ledger open as recovery handle (manual reconciliation). Refuses on any parse ambiguity (no open ledger, position-count mismatch, unparseable result line) and writes nothing. Judgement — _did I actually see this line_ — stays in [SKILL.md](../SKILL.md) step 8; only model can make it.

`doubling` defaults to 2, `ceiling` to 90; override both via `spacing: { doubling: N, ceiling: N }` under `NOTES.md` `## Preferences` — exact shape only, any other shape does not parse and built-in 2/90 stands. Expanding schedule slightly weaker than fixed in classroom meta-analysis (Mawson & Kang 2025), so `ceiling` cap plus `asked: 2` abandon rotation compensate for stall failure mode expanding schedules hit — no mechanism change needed. For evidence-preferred fixed-7-day schedule, set `spacing: { doubling: 1, ceiling: 7 }`.

| Item outcome                    | Action on its record                                                                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Right, `interval` < ceiling     | `interval` → `min(interval * doubling, ceiling)`; `next` → today + new `interval`; `lapses` → `0`                                                           |
| Right, `interval` ≥ ceiling     | `status: retired`; `lapses` → `0` (pool stays bounded)                                                                                                      |
| Wrong                           | `interval` → `1`; `next` → tomorrow; `lapses` → `lapses + 1` (missing key = 0)                                                                              |
| No answer reported, ledger open | leave `next` and `interval` untouched — record stays overdue, correct while answer may still come                                                           |
| Ledger abandoned (`asked: 2`)   | `interval` and `lapses` untouched; `next` → today + current `interval` — no credit, no lapse, pool keeps rotating instead of freezing on same three records |

"No answer reported" row not `score` invocation — ledger stays open, `teach.py asked` increments counter; at `asked: 2` model runs `teach.py score "abandon"` and abandoned row applies. Result-line shape: `Cold open NNNN-slug: 1 right, 2 wrong, 3 right` (positions 1..N contiguous). `NNNN-slug` is lesson that produced line; `score` refuse line whose id don't match open ledger, refuse line with no id at all — that one come from `assets/quiz.js` older than template v3.

## Optional sections

Include only when genuine value added. Most records won't need them.

- **`status`** — optional frontmatter key (`active | retired | superseded by NNNN-slug`); absent = `active`. `retired` set when record hit configured ceiling (default 90) and answered right again; `superseded` when later record corrects earlier one — mark old `status: superseded by NNNN-slug`, never delete it (history of how understanding evolved itself useful signal). Both leave cold-open pool. Step 1 of [SKILL.md](../SKILL.md) reads `active` records full; `retired`/`superseded` read as title lines only — title still signals what learned for zone of proximal development, but banked/wrong body no longer costs full read every session.
- **Evidence** — how user demonstrated understanding (question answered, exercise completed, prior experience cited); useful when claim might get revisited.
- **Implications** — what record unlocked or ruled out for future sessions; worth recording when non-obvious.

## When to write a learning record

Write one when any true:

1. **User demonstrated genuine understanding of something non-trivial** — not just exposure, evidence they can use concept correctly. Sets new floor for what teach next.
2. **User disclosed prior knowledge** — "I already know X." Record so future sessions don't re-teach. Record _depth_ claimed too.
3. **Misconception corrected** — user previously believed something wrong, now sees why. High-value: predict future stumbling blocks for related topics.
4. **Mission shifted in response to learning** — user discovered they cared about something different than thought. Cross-link to `MISSION.md`, update it.

### What does _not_ qualify

- Material merely covered. Coverage not learning. Wait for evidence.
- Anything already captured tersely in `GLOSSARY.md` as term definition. No duplicate.
- Session-by-session activity logs. Learning records not journal — decision-grade insights.
