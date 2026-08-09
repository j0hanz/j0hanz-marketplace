# Lesson voice

How every word learner read must sound. [DESIGN.md](DESIGN.md) spec container; this file spec what go in it.

Read at step 6 of [SKILL.md](../SKILL.md), before first `{{argument}}` filled, and again at finish checklist in [SKILL.md § Lessons](../SKILL.md#lessons). Cold-open question written at step 5 fall under it too.

## Two register, never mixed

This file, [SKILL.md](../SKILL.md), [DESIGN.md](DESIGN.md) and `templates/` all drop article on purpose (`CLAUDE.md`). That register is for author — compression between people already holding the system.

Lesson HTML is opposite register: ordinary standard English, whole sentence, written to one learner sitting alone at `file://` with nobody to ask. Every `{{argument}}` is that register, including the ones inside markup — `data-seal-label`, `data-unsealed-label`, quiz feedback, synthesis point. Author register leaking into lesson copy is the failure this file exist to stop: dropped-article prose is a telegram, and telegram only expand for reader who already know what it compress.

So this file run terse and take em dash freely. Every **after** example below does neither. Both correct.

## Two tests

**Say it out loud.** Would you say the sentence to one person beside you, aloud, in those words? Ship it. Would you only ever type it? Rewrite it.

**Two levels down.** Could a learner two levels below this lesson's target follow every sentence, even where the _task_ is past them? Wording never gate. Difficulty live in what lesson ask learner to do, never in how the asking is worded.

## Rules

1. **Write to one person.** "You", not "the learner", "students", "one". No passive that hide who act: not "the results are preserved", but "the parser keeps the results".
2. **Say "is".** Copula dodging is loudest machine tell. `serves as`, `stands as`, `represents`, `acts as`, `boasts`, `features`, `plays a key role in` → `is`, `has`, `does`.
3. **Cut participle tail.** Clause bolted on sentence end carry no fact: "…, highlighting its importance", "…, ensuring correctness", "…, reflecting a broader shift". Delete it, or promote to own sentence with real subject.
4. **No word learner must look up.** Term they cannot skip: define in one clause at first use, bold at that point only, add to `GLOSSARY.md` ([SKILL.md § Knowledge](../SKILL.md#knowledge)). Term used before defined is defect, same class as unfilled `{{argument}}`.
5. **One name per thing.** `GLOSSARY.md` term, every time. Synonym cycling ("the parser… the analyser… the front end") read as variety to writer and as three separate components to learner.
6. **Concrete beat category.** Real number, real file name, real command. "a configuration value" → `timeout=30`. Specific detail is what human prose keep and generated prose round off, and it cite better: vague claim have no source to point at.
7. **Vary sentence length.** Even mid-length cadence is rhythm tell. One short sentence after long one land hard. Four short ones in a row is drama, not emphasis.
8. **Say the thing, never announce it.** No "Let's dive in", "Here's what you need to know", "Now let's look at". Route stop already say where learner stand, `h2` already say what come next. Heading followed by one line restating the heading is padding — cut line, open on content.
9. **Em dash out of sentence prose.** Period, comma, colon or parentheses instead. Two em dash survive from template and are not prose: `<title>` separator, and `.sidenote` separator after link title. Leave those.
10. **Joke ride on example, never on claim.** Every claim cite ([SKILL.md § Lessons](../SKILL.md#lessons)), so joke that become claim is uncited claim. Test: delete every funny sentence, every citation still stand.

## Tics — read draft back for these

Word: `crucial`, `pivotal`, `vital`, `key` (adjective), `delve`, `leverage`, `robust`, `seamless`, `landscape`, `tapestry`, `testament`, `underscore`, `showcase`, `intricate`, `foster`, `realm`, `harness`, `journey`.

Phrase: "it is important to note that", "in order to", "due to the fact that", "at its core", "the real question is", "in today's world", "it's not just X, it's Y", "X is the Y of Z", "Here's the thing", "Honestly?".

Chatbot residue: "Great question!", "Great job!", "I hope this helps", "Let me know if", "Would you like me to", "You've got this!", "well on your way".

Shape: forced triad (three because three sound complete — not three because three exist; synthesis's 3–5 point is count of real idea, never padding); bullet list of bolded labels where paragraph belong; exclamation mark; emoji; ALL CAPS; run of short fragments manufacturing drama; closing paragraph of vague encouragement instead of last concrete fact.

Not a tic, do not flag: plain declarative prose, one `however`, formal term the topic genuinely own, straight repetition of the `GLOSSARY.md` term. Dryness is not a machine tell; the words above are.

## Plain wording is not low scaffolding

Two knobs. One always on, one gated. Author who collapse them ship the wrong lesson.

- **Wording — always plain, every lesson, every learner.** Expert does not earn denser sentence. No undefined jargon, no sentence read twice, at any level.
- **Scaffolding — gated on record state.** Worked example, per-step rationale, hint, partial solution, figure: density scale by fading rule ([SKILL.md § Skills](../SKILL.md#skills)) and expertise reversal ([DESIGN.md § Figure](DESIGN.md#figure--diagram), [§ Worked example](DESIGN.md#worked-example)). Competent learner get _less structure_, and a figure added for them actively hurt.

Plain is how it read. Faded is how much of it there is.

Wrong read of "explain like a beginner regardless of level": worked example in every lesson. That is expertise reversal walked into head first. Right read: `interval: 64, lapses: 0` learner get bare problem and no diagram — and that bare problem is still one sentence a beginner could parse.

> **Bare problem, wrong:** Implement the invariant described above for the aforementioned queue abstraction.
>
> **Bare problem, right:** Write the check that makes this true: no order leaves the queue twice.

Same difficulty. Second one just doesn't make learner decode the question before they can start on it.

## Funny inside a quiet design

[DESIGN.md § Signature](DESIGN.md#signature--the-retrieval-gate) commit the page to calm: no confetti, no green flash. Same rule one layer up — page stay quiet, sentence carry the person.

Personality live in word choice, which example you pick, the target of an analogy, one aside. Personality never live in new UI, emoji, motion, exclamation mark, colour or new component. Nothing in this file license a widget.

**Gate:** unlink `assets/styles.css` and the lesson still read like a person wrote it; link it back and nothing moved. Personality that need CSS is decoration.

**Dose:** roughly one moment of levity per lesson, in service of a concrete example. Comedian teaching is worse than dry teacher — learner came to learn, and second joke cost them the thread.

## Before and after

Same idea each time. **Before** is dense and machine-shaped, and every one is accurate — that is the point, correctness is not the thing being fixed. **After** is what a teacher would actually say, carrying the same claims.

**Knowledge body.**

> **Before:** Database indexing serves as a crucial mechanism for optimizing query performance, playing a pivotal role in modern data architecture. It is important to note that indexes fundamentally represent a trade-off between read and write operations, highlighting the intricate balance developers must strike.
>
> **After:** An index is a second copy of one column, kept sorted. The database can binary-search that copy instead of reading every row, so lookups get much faster. Writes get slower, because every insert now has two things to update instead of one.

**Quiz feedback** ([DESIGN.md § Quiz](DESIGN.md#quiz)).

> **Before:** Great job! That's correct. Option B is indeed the right answer here.
>
> **After:** Yes. `git revert` adds a new commit that undoes the old one, so the history everyone already pulled stays where it was. `git reset` rewrites that history, which is why it breaks a branch other people are working on.

**Follow-up invite** (`FOLLOW-UP`, Where next).

> **Before:** Congratulations on completing this lesson! You're well on your way to mastering concurrency — let me know if you'd like me to expand on any section. Happy to help!
>
> **After:** The thing most people trip on next is that a lock protects data, not code. If that sounds obvious and useless right now, ask me and I'll show you the bug it causes.

**Cold-open question** ([SKILL.md § Cold open](../SKILL.md#cold-open)).

> **Before:** Which of the following best describes the primary function of the aforementioned mechanism?
>
> **After:** You push to a branch two other people are on. Which command leaves their history working?
