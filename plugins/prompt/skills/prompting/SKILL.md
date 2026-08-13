---
name: prompting
description: Rewrite a rough, half-formed prompt into one that works on current Claude models.
disable-model-invocation: true
argument-hint: '<rough prompt>'
---

# Prompting

Argument = rough prompt. Return rebuilt one in paste-ready block, plus few lines on what changed.

Rough prompts fail two ways. Most state task but not what it for, so every decision prompt didn't cover get settled by guess. Rest were tuned for older models, still carry scaffolding current models trip over. Rebuild recover missing intent, strip scaffolding.

Prompt already do job? Say so, hand back one change that help. Rewrite for own sake = churn.

## What the prompt is for

Read target before rewriting word. Decide everything downstream, usually inferable from prompt itself — where it get pasted, what it talk about, whether it say "you are".

- **One-shot ask** — intent and request, nothing else. Most rough prompts this, get worse when dressed up.
- **System prompt** — read every turn, by model serving someone who never see it. State durable defaults that generalize past case that provoked them. Run long? Repeat single most-violated rule in one short line near end; position beat repetition of everything else.
- **Agent instructions** (CLAUDE.md, agent definition, harness prompt) — read mid-run, nobody watching. Carry stop conditions, scope boundaries, tool and delegation policy, checkable definition of done.
- **A skill** — not prompt but document loaded on demand, so levers are invocation, disclosure, pruning — not framing. Say so, hand to `/write-skills`.

**Model and harness.** Current Claude models all follow intent closely, so most of rewrite model-independent; what differ is which default need tuning. Opus 5 run long, narrate work, widen scope, delegate readily — rewrite aimed at it usually add length line and scope line, remove any verification line. Fable 5 punish enumeration hardest; one reasoned instruction worth more there than anywhere. Harness decide which dials exist at all: Claude Code and API expose effort and model choice, chat window not. Model unstated? Assume harness default, move on.

## The rebuild

Three levers live inside prompt. Fourth is dial outside it. What they need usually recoverable from rough text and surrounding context; when something isn't, fill with reading that make prompt useful, mark filled slot in brackets so it can be overwritten, note assumption underneath. Ask only when two readings lead to materially different work, rewrite for likelier one first.

**Intent.** Lead with it: what larger task is, who it for, what outcome enables. That what let model settle hundred micro-decisions prompt never mention — which of two equivalent approaches, how much detail, when to stop polishing. One sentence carry small ask; non-trivial one earn current state, constraints, goal as separate lines. Highest-leverage edit available.

**Scope.** Say what to touch, where done is, what stays put — state done so model can check it, not claim it, and name constraint that turn plausible answer into usable one. Frame as behavior you want: instruction with reason attached generalize across whole family of cases it imply, where prohibition cover only its own items and make elephant it banned more available by naming it. Keep one only as hard guardrail, paired with what to do instead.

**Shape.** Say what come back and where it land: text in reply, file on disk, diff. State length if length matter; written files run longer than replies. For format and tone, one example beat paragraph of adjectives; "conversational but professional" mean different thing to model than to you. Reach for tags (`<task>`, `<article>`) only when pasted content or several distinct inputs need separating from instructions — on short prompt they noise.

**Subtract before adding.** Deletion often whole rewrite:

- Verification and re-check instructions — "include a final verification step", "double-check your answer", "use a subagent to verify". Current models verify own work; these stack on top, buy passes not quality.
- Suppression phrasing in review prompts — "only report high-severity issues", "be conservative". Instruction-following good enough now that this obeyed literally, real findings go unreported. Ask for everything, filter in second pass.
- Restated defaults — be honest, don't over-format, own your mistakes, ask when unclear, be thorough, cite sources. Already how model behave. Repeating buy nothing, dilute lines that do work. Keep such line only when you want something _other_ than default.
- Contradictions — "be concise" plus "cover everything relevant" resolve to neither.
- Persona costume — keep role only when it name expertise that change which details matter. Otherwise state audience and standard directly, which is what role stood in for.

## Effort

Effort = how hard model think, not how much it say. Turning down won't shorten answer; ask for length in prompt. Recommend level in one line when target's harness expose dial, skip entirely when it doesn't.

| Work                                                                                     | Effort           |
| ---------------------------------------------------------------------------------------- | ---------------- |
| Trivial edits, formatting, lookups, mechanical passes                                    | `low`            |
| Summarizing, extraction, classification, routine analysis                                | `medium`         |
| Writing, coding, exploring an unfamiliar system                                          | `high` (default) |
| Demanding agentic coding, review and critique, planning, hard reasoning                  | `xhigh`          |
| Rare capability-bound problems — overthinks ordinary ones, returns little for the tokens | `max`            |

Keep thinking on. Disabling leak tool calls into visible text and internal tags into response; thinking at `low` beat thinking off at comparable cost. Prompt ask model to narrate or transcribe reasoning as output text? Rewrite that — can trigger refusals, progress belong in status line, not reasoning dump.

## Hand it back

1. Rewritten prompt in single fenced block containing nothing but prompt.
2. One line for effort, and model if it matter — only when harness support it.
3. Two to four lines on what changed and why, naming lever not edit.
4. Any assumption you filled, so it can be overwritten.

Every line of rough prompt either survive into rewrite or get named in notes. Keep reply short. Block = deliverable; notes = lesson.

**Worked example.** Rough: _"review my auth code and tell me what's wrong, be thorough, double check your work, only flag the important stuff"_

```text
Review the authentication code in <files> for correctness and security. It ships to production next week, so an auth bug that survives this pass is the expensive kind.

Report every issue you find, including small ones — I'll triage severity myself in a second pass. For each: where it is, what breaks, and the smallest fix that closes it.
```

Effort: `xhigh` — review capability-bound, missed finding cost more than latency.

Changed: added deadline and stakes as intent, so model can judge what matter instead of guessing. Turned "only flag the important stuff" into report-all-then-triage — suppression instructions followed literally now, bury real bugs. Dropped "double check your work" and "be thorough"; both already default, first buy extra passes not better ones. Named per-finding shape so output usable without follow-up.
