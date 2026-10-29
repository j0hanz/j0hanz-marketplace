# Logic Prototype

Single self-contained HTML file (**shareable demo**) letting anyone drive state model by clicking buttons. Use when question about **business logic, state transitions, or data shape**: things that look fine on paper but feel wrong once pushed through real cases.

One file, nothing to install → hand to non-developer (designer, PM, domain expert) to feel model themselves. So speak their language, not code's.

## When this is the right shape

- "I'm not sure if this state machine handles the edge case where X then Y."
- "Does this data model actually let me represent the case where..."
- "I want to feel out what the API should look like before writing it."
- Anything where someone wants to **press buttons and watch state change**.

If question is "what should this look like," wrong branch. Use [UI.md](UI.md).

## Process

### 1. State the question

Before code, write what state model and what question you're prototyping. One paragraph, top of demo (visible intro, not just comment). Prototype answering wrong question = pure waste, so make question explicit for later check.

### 2. Isolate the logic in a portable module

Put actual logic (bit answering question) in single `<script>` block as small pure module, liftable into real codebase later. Page around it throwaway; module not.

Shape depends on question:

- **Pure reducer**: `(state, action) => state`. Good when actions discrete events and state single value.
- **State machine**: explicit states and transitions. Good when "which actions legal right now" part of question.
- **Small set of pure functions** over plain data type. Good when no implicit current state, just transformations.
- **Class or module with clear method surface** when logic genuinely owns ongoing internal state.

Pick shape best fitting question, _not_ easiest to wire to page. Keep pure: no DOM, no `document`, no button handlers reaching inside. Page calls in; nothing flows other way. This makes prototype useful past own lifetime: once answered, validated reducer / machine / function set lifts into real module as-is.

### 3. Build the shareable HTML file

One file, plain HTML/CSS/JS: no framework, no bundler, no server, all inline so opens by double-click and survives email. Anyone runs it by opening.

Write for non-developer. Every label in **domain language**, not code: buttons and state read like business, not reducer. Explain in plain words what's happening.

Layout, clean hierarchy, top to bottom:

1. **Title and one-line explanation** of what demo explores (question from step 1).
2. **Current state**: full relevant state as readable panel (labelled fields, not raw JSON dump), re-rendered after every click so change visible. Where helpful for non-developer, call out what just changed.
3. **Free-play buttons**: one button per action, always available, poke model in any order. Each click dispatches action and re-renders state.
4. **Guided walkthroughs**: set of **scenarios**, one per tab. Each tab: short plain-language description (situation set up, what to watch for), underneath it ordered **buttons to press**. Each step real button: click performs action, moves to next step. Starting walkthrough resets to known initial state so scenario runs same every time.

Choose scenarios showing awkward cases, hard to reason about on paper: happy path, tricky edge case, attempt at something that should be illegal.

Beautiful but restrained: clean typography, generous spacing, one accent colour. No animations, no gimmicks: nothing competing with state and buttons.

### 4. Hand it over

Open file for user, give absolute path (see [SKILL](SKILL.md) rules). They click through walkthroughs and free-play when ready; interesting moments = "wait, that shouldn't be possible" or "huh, I assumed X would be different"; those are bugs in the _idea_, the whole point. Want new actions or scenario → add. Prototypes evolve.

### 5. Ca### 5. Capture the answer

Follow "When the question is answered" in [SKILL](SKILL.md). Logic-specific part: validated reducer / machine / function set lifts into real module; HTML shell does not.

atterns

- **Don't add tests.** Prototype needing tests no longer prototype.
- **Don't wire it to the real database.** In-memory state unless question specifically about persistence.
- **Don't generalise.** No "what if we wanted to support X later." Prototype answers one question.
- **Don't blur the logic and the page together.** If pure module references DOM, `document`, or button handlers, no longer liftable. Page = thin shell over pure module.
- **Don't reach for a framework, bundler, or server.** One file recipient double-clicks; React app or dev server defeats "shareable".
- **Don't ship the HTML shell into production.** Page optimised for hand click-through. Logic module behind it worth keeping.
