---
name: unslop
description: Use when writing or editing prose a person will read, or when text sounds AI-generated.
---

# Unslop

Edit text, remove AI patterns.

## Process

1. Scan for patterns below.
2. Rewrite. Keep meaning, match intended tone.

Done when every rule run against every sentence, heading, caption, diagram label, frontmatter line, and none fires.

## Patterns to detect and fix

Rule numbers = stable ids cited by writeup scan hook. Removed rule leaves gap.

### Content

3. **Superficial -ing phrases.** "highlighting...", "ensuring...", "reflecting...", "showcasing...", "fostering...". Delete or expand with real sources.
4. **Vague attributions.** "Experts believe", "Industry reports suggest", "Some critics argue". Name source or delete.

### Language

7. **AI vocabulary.** Additionally, crucial, delve, enduring, enhance, fostering, garner, interplay, intricate, landscape (abstract), pivotal, showcase, tapestry (abstract), testament, underscore, vibrant. Replace with plain words.
8. **Fancy ways to say "is".** "serves as", "stands as", "boasts", "features". Say "is" or "has".
9. **"Not just X, but Y."** State point directly.
10. **Rule of three.** Forcing ideas into groups of three. Use natural number.
11. **Synonym cycling.** Protagonist, main character, central figure, hero in one paragraph. Pick one, repeat.
12. **False ranges.** "from X to Y" where X, Y not on meaningful scale. List topics directly.

### Style

13. **Em dashes.** None. No parentheses, en dashes, hyphens as substitute. Thought needs separation → end sentence or use comma.
14. **Colon overuse.** Colons fine before list or example. Not as mid-sentence connectors. "If you're coming from traditional automation: instead of registering event handlers, you describe conditions" — colon adds nothing. Rewrite so point stands alone: "Describe when the scheduler should fire in plain English."
15. **Boldface overuse.** Bold only terms reader scans page for. Proper nouns, acronyms stay plain.
16. **Inline-header lists.** Tell = bold label + colon restating line: "**Performance:** Performance improved...". Convert to prose. Bold lead-in ending in period, naming item, followed by genuinely new detail ("**Schema in TypeScript.** Tables live in one file.") is fine, not tell.
17. **Title case headings.** Use sentence case.
18. **Decorative emojis.** Remove from headings, bullets.
19. **Curly quotes.** Replace with straight quotes.

### Communication artifacts

20. **Chatbot phrases.** "I hope this helps!", "Let me know if...", "Of course!", "Certainly!", "Found the smoking gun!" Remove.
21. **Sycophantic tone.** "Great question! You're absolutely right!" Respond directly.

### Filler

23. **Filler phrases.** "In order to" → "To". "Due to the fact that" → "Because". "It is important to note that" → delete.
24. **Excessive hedging.** "could potentially possibly be argued that it might" → "may".
25. **Generic conclusions.** "The future looks bright." State specific plans or facts.

### Jargon

26. **Abstract metaphor nouns.** Substrate, wedge, vector, locus, vantage, nexus, primitive (as noun), harness (as metaphor), surface (as in "API surface"), bedrock, scaffolding (as metaphor), modality, paradigm, gold-plating, ratchet (as metaphor), evacuate (for moving code), endgame, north star, flywheel. Sound technical, usually have plainer concrete word. "Substrate" → "base". "Wedge in" → "add". "Vector" → "way" or "method". "Gold-plating" → "more than the job needs". "Ratchet" → mechanism's real name or "a limit that only tightens". "Evacuate" → "move out". "Endgame" → "the last phase". Pick concrete word.

### Plain speech

27. **Say what it does, not how it feels.** "the database stays close at hand", "SQL you can read", "types that follow your schema" name feeling. Fix names mechanism or number: "`.toSQL()` returns the exact string sent to the database", "a column rename fails the build". Ask what sentence tells reader to do or know, write that. Can't restate as concrete instruction, fact, or number → cut. Extra check: sentence could appear unchanged in another project's docs → says nothing about this one. Cut.
28. **Shorten or split dense sentences.** Reader must backtrack to parse → split in two or drop clauses. One idea per sentence.
29. **Active voice.** Prefer it. Catch "is/are/was/were + past participle", name actor: "queries are validated" → "the compiler validates queries", "the file is parsed by the loader" → "the loader parses the file". Passive fine only when actor unknown or genuinely irrelevant.
30. **Cut adverbs, or use stronger verb.** "runs quickly" → "is fast" or number. "significantly improves" → measured delta. Adverb propping weak verb = wrong verb.
31. **Prefer plain word.** "utilize" → "use", "leverage" → "use", "facilitate" → "help", "numerous" → "many", "in the event that" → "if". Fancier synonym rarely clearer.
32. **Mannered prose.** Metaphor or flourish where literal phrase exists: aphorisms ("wire it or delete it"), rhetorical fragments for effect, personified code ("the plan holds it"), figurative verbs ("rides along", "stands on"), stock framing phrases. "A dial worth turning" → "a parameter worth varying". Say what you mean. Rule 26 covers metaphor nouns.
33. **Over-compression.** Dropped articles, verbless fragments, symbol-speak, abbreviations that make reader decode instead of read. "Parser rejects bad date → exit 2, no write" → "The parser rejects a bad date, exits with code 2, and writes nothing." Write whole sentences with articles and verbs, spell out arrows and abbreviations.
