# Workspace Formats

Four root docs hold workspace stable state — created lazy, each when first need. Together answer: why learn this ([Mission](#mission)), where knowledge come from ([Resources](#resources)), what words mean ([Glossary](#glossary)), how user want sessions run ([Notes](#notes)). Every teaching decision trace back here.

| File           | Holds                                                  | Spec                    |
| -------------- | ------------------------------------------------------ | ----------------------- |
| `MISSION.md`   | Why user learns this. Grounds every teaching decision. | [Mission](#mission)     |
| `RESOURCES.md` | Trusted sources for knowledge, communities for wisdom. | [Resources](#resources) |
| `GLOSSARY.md`  | Canonical language of topic.                           | [Glossary](#glossary)   |
| `NOTES.md`     | User preferences and your working notes.               | [Notes](#notes)         |

All four at workspace root. Create each when session flow in [SKILL.md](../SKILL.md) first need it — never speculative. [Learning record](RECORDS.md) format separate; track what learned, not what workspace know.

---

## Mission

`MISSION.md` capture _reason_ user learn topic — concrete real-world goal chased. Every teaching decision — what teach next, which resources surface, which exercises design — trace back here. Without it, lessons feel abstract.

### Template

```md
# Mission: {Topic}

## Why

{1-3 sentences: the concrete real-world goal — what changes in their life/work when they have this skill. Not "to understand X".}

## Success looks like

- {specific, observable thing they will be able to do}
- {…}

## Constraints

- {time, budget, prior commitments, learning preferences}

## Out of scope

- {adjacent topics they explicitly do not want to chase — protects the ZPD}
```

### Rules

- **One mission per workspace.** User want learn two unrelated things = two workspaces.
- **Concrete over abstract.** "Run a half marathon by October" beat "get fitter." "Ship a Rust CLI to my team" beat "learn Rust."
- **Push back on vagueness.** User cannot say why? Interview first, write nothing. Bad mission worse than no mission.
- **Revise when reality shifts.** Missions change. Goal move = update file. No stale mission steer future sessions. Mission shift from learning = also write [learning record](RECORDS.md) capturing shift, cross-linked here.
- **Keep it short.** `MISSION.md` past one screen = not compass anymore, now plan.
- **Mark provisional missions.** User decline interview: write narrowest mission their words support, put `**Provisional**` on own line directly under `# Mission:` heading, reopen next session. Provisional mission reopen once, then proceed — second session with `**Provisional**` still on it, treat settled, teach. Provisional mission steer teaching, never settle it.

---

## Resources

`RESOURCES.md` curated set of trusted sources for topic. Lesson knowledge come from here, never parametric guess. Wisdom come from communities listed here. See [SKILL.md](../SKILL.md) step 3 — thin resources mean find sources before teach anything.

### Template

```md
# {Topic} Resources

## Knowledge

- [Book: _Title_ — Author](URL)
  One line: what it covers, when to reach for it.

## Wisdom (Communities)

- [Community name](URL)
  One line: what kind of feedback or wisdom it offers.
```

### Rules

- **High-trust only.** Prefer primary sources, recognised experts, peer-reviewed work, communities strong moderation. Resource marketing dressed as education: leave out.
- **Annotate every entry.** Bare link useless in three months. Add one line: what cover, when reach for it.
- **Group by Knowledge / Wisdom.** Mirror philosophy in [SKILL.md](../SKILL.md) — knowledge captured, wisdom borrowed from practitioners. Fine for resource appear in one group only.
- **Surface gaps explicitly.** No good resource for area mission need: write `## Gaps` section listing what missing. Drive future search.
- **Prune ruthlessly.** Resource wrong, shallow, or off-mission: remove, not bury. Better five sharp sources than thirty mediocre.
- **Record community preferences.** User opt out joining communities: note here so future sessions stop proposing them.

---

## Glossary

`GLOSSARY.md` canonical language for this teaching workspace. All lessons, exercises, learning records follow its terms. Building it _is_ learning: compress concept into tight definition prove user understand it.

Term enter glossary only after user demonstrate understanding — see [SKILL.md](../SKILL.md) step 8, where evidence exists. Once term in, use it every lesson. Promotion before evidence = dictionary user read to learn, not record of what they know.

### Template

```md
# {Topic} Glossary

{One or two sentences on the topic this glossary covers.}

## Terms

**Term**:
One or two sentences: what it _is_. Use the glossary's own terms inside definitions.
_Avoid_: loose synonyms to flag
```

### Rules

- **Add term only when user understands it.** Glossary record compressed knowledge, not dictionary user read to learn. User just met concept: wait til use it correctly before promote here.
- **Be opinionated.** Many words same concept: pick best, list rest as aliases to avoid. That how language compress.
- **Keep definitions tight.** One or two sentences. Define what term _is_, not what it does or how to do it.
- **Use glossary's own terms inside definitions.** Term in glossary: prefer it everywhere, including inside other definitions. Make complex terms easier later.
- **Group under subheadings** when natural clusters emerge (e.g. `## Anatomy`, `## Programming`). Flat list fine when terms cohere.
- **Flag ambiguities explicitly.** Term used loosely in wider field: note resolution: "In this workspace, 'set' always means a working set — warm-ups are tracked separately."
- **Revise as understanding deepens.** Definition from week one may be wrong by week six. Update in place; no stale entries.

---

## Notes

`NOTES.md` hold two things steer sessions but belong in no other doc: what user prefer, what you must remember across session boundary. Two headings, nothing else.

### Template

```md
# Notes

## Preferences

- {durable preference read every session, obeyed}
- spacing: { doubling: 2, ceiling: 90 }

## Working notes

- unscored cold open: lessons/NNNN-slug.html tests NNNN-a, NNNN-b (asked: 0)
- {scratch that must outlive the session}
```

### Rules

- **Preference goes under `## Preferences`, never buried in prose.** Preference buried in prose is preference you miss. Read every session, obeyed.
- **One structured value, exact shape.** `spacing: { doubling: N, ceiling: N }` override cold-open schedule — `doubling` default 2, `ceiling` default 90. Step 8 of [SKILL.md](../SKILL.md) read it as value, not prose; any other shape not parse. Everything else under `## Preferences` free text.
- **Working notes scratch that must outlive session.** Cold-open ledger line live here — see [SKILL.md](../SKILL.md) § Cold-open ledger. Anything die with session belong in session, not file.
- **Prune.** Preference user reverse: delete it, don't annotate. Working note whose session done: delete it.
- **Never journal.** Session-by-session activity log belong nowhere in workspace — not here, not in [learning records](RECORDS.md).
