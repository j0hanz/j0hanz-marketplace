---
name: prompting
description: Rebuild a rough prompt into one paste-ready block.
disable-model-invocation: true
argument-hint: '<rough prompt>'
---

# Prompting

**Rebuild** rough-prompt argument. Already does job? Say so — one useful change, not **churn**.

## Target

Read what prompt for before rewriting word — usually inferable from where it gets pasted, what it discusses, whether it says "you are":

- **One-shot ask** — intent and request, nothing else. Most rough prompts; get worse in costume.
- **System prompt** — durable defaults that generalize past case that provoked them, served every turn to someone who never sees it. Long-running? Restate single most-violated rule once, near end — rule model drifts from by default; stylistic and format rules drift more than content.

Note what the harness already supplies — system text, tools, effort control — so Rebuild can cut restatements of it.

**Done when:** target type resolved (inferred, or focused question sent); harness supply identified; any inference stated in Changed note.

## Rebuild

Pull each of three **levers** — **intent**, **scope**, **shape** — from rough text and context; where a value is missing, state the low-risk assumption in the Changed note and keep the prompt clean — mark `[in brackets]` only when the user must confirm before use. When two readings produce structurally different deliverables (different output type, scope, or recipient), make one focused question the complete response before rebuilding; ask only when readings genuinely diverge — if one is clearly likeliest, assume it.

**Subtract** before adding. When phrase sits in two levers (e.g. "be thorough" both contradiction half and restated default), keep half carrying task-specific constraint, cut generic half.

- **Duplicate verification** — cut "double-check" or "verify again" when specific validation action or completion criterion already covers it; keep observable validation requester needs (tests, source reconciliation). If only verification, replace with specific checkable action rather than cut.
- **Reporting threshold** — keep intentional severity, audience, and scope limits; turn vague filter like "important" into checkable threshold; distinguish what to inspect from what to report.
- **Restated defaults** — cut generic behavior with no task-specific constraint ("be honest," "own your mistakes," "be thorough"); keep only non-default requests.
- **Traceability** — preserve citation, provenance, and evidence requirements; name expected source or format when it matters.
- **Contradictions** — "be concise" plus "cover everything relevant" — resolve toward intent.
- **Persona costume** — keep role only when it names expertise that changes which details matter. Otherwise state audience and standard directly.

**Intent.** Lead with it: what larger task is, who for, what outcome enables. One sentence carries small ask; non-trivial one earns current state, constraints, and goal as separate lines.

**Scope.** What to touch, where done is, what stays put. State done so model can check it, not claim it; name constraint that turns plausible answer into usable one. Frame wanted behavior with its reason so it generalizes across family of cases. Prohibition covers only what it names and makes that thing more available; keep one only as hard guardrail, paired with what to do instead.

**Shape.** What comes back and where it lands: reply text, file on disk, diff. State length when it matters — written files run longer than replies. For format and tone, one example beats paragraph of adjectives. Use tags (`<task>`, `<article>`) only when pasted content or multiple inputs need separating from instructions; on short prompt they noise.

**Done when:** intent leads; each lever (scope, shape) states checkable done; every Subtract rule applied or noted not applicable; required quality gates (tests, thresholds, citations, severity bars) named and checkable.

## Hand it back

````markdown
```text
<prompt -- rebuilt and paste-ready; the fence holds nothing else>
```

---

> Changed: <what changed and why, naming the **lever**> -- two to four short sentences
````
