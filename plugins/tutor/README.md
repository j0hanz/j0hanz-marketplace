# Tutor

![License](https://img.shields.io/github/license/j0hanz/j0hanz-marketplace)

Learn one topic for real, across many sessions, instead of forgetting it a week later.

Tutor is a Claude Code plugin that turns a directory on your machine into a personal course. You tell it what you want to learn and why. It builds lessons, quizzes you before each one to pull what you already know back to the surface, and brings the right lesson back on a spaced-repetition schedule so retention sticks. Every lesson is a single offline HTML page you open in a browser. No accounts, no cloud, no subscriptions.

## A session, end to end

You start in an empty folder:

```text
/teach Rust ownership
```

Claude asks why you want this. You answer in a sentence: "I keep fighting the borrow checker at work, I want to stop." It writes that reason down as your mission and stops there. No lesson yet. The first session is just the interview.

Next day, you open Claude in the same folder and type two words:

```text
carry on
```

A hook fires on session start, reads your workspace, and tells Claude where you left off. You don't retype a command, you don't re-explain the goal. Claude picks the next thing sitting just inside your reach, builds a lesson, and opens it.

The lesson opens in your browser. The first block is a cold open: a few short questions about what you learned last time, pulled from your own learning records. The lesson body stays sealed until you answer every one. That is the point. Retrieval before instruction is the moment you actually pay attention.

You answer, paste the result line back:

```text
Cold open 0003-ownership: 1 right, 2 wrong, 3 right
```

Claude scores only what it saw you answer, moves that record's schedule, and keeps teaching. Wrong answers reschedule that one record. They never derail the lesson you asked for.

Days later, that same record comes due again. You type `carry on`, and the cold open pulls it back. That is how a fact stops being something you recognized once and becomes something you own.

## What you get in the folder

Each file is created when first needed, never up front.

| Path                            | Holds                                                  |
| ------------------------------- | ------------------------------------------------------ |
| `MISSION.md`                    | Why you want this. Grounds every lesson.               |
| `RESOURCES.md`                  | Trusted sources Claude teaches from.                   |
| `GLOSSARY.md`                   | The topic's own language, promoted as you use it.      |
| `NOTES.md`                      | Your preferences and Claude's working notes.           |
| `lessons/NNNN-slug.html`        | One self-contained lesson each. Open from `file://`.   |
| `reference/slug.html`           | Reference sheets you come back to.                     |
| `learning-records/NNNN-slug.md` | What you actually learned, and when.                   |
| `assets/*`                      | Shared stylesheet, quiz widget, reused across lessons. |
| `index.html`                    | Course home. Rebuilt from state, never hand-edited.    |

The workspace is the source of truth, not the chat transcript. Close Claude, reboot, come back next month. Your schedule, ledger, and records are all still there.

## What it works for

Anything where you want durable retention, not a one-time overview.

- A programming concept you keep faking: `Rust ownership`, `React useEffect`, `SQL window functions`.
- A body of knowledge for an exam or interview: `TCP handshake`, `Big-O for data structures`, `compound interest`.
- A physical skill with a feedback loop: `yoga poses for tight hips`, `guitar barre chords`, `deadlift setup`.
- A topic you tried and dropped: `linear algebra`, `Italian cooking`, `options pricing`.

Tell it your real reason. A vague mission makes vague lessons. "I want to stop fighting the borrow checker" beats "learn Rust."

## Why it works

Two kinds of strength, and most study tools build the wrong one. **Fluency** feels like mastery in the moment and fades. **Storage** is what you still have next month. Tutor builds storage through desirable difficulty: retrieval practice (recall from memory, before each lesson), spacing (practice distributed across sessions), and interleaving (related topics mixed, for skills).

It will not teach you from parametric knowledge. It searches high-trust material first, records those sources in `RESOURCES.md`, and cites them in every lesson. If a source is thin, it says so and goes to find more before building anything.

## Install

You need Claude Code and Python 3.11 or newer on your `PATH`.

From a Claude Code session:

```text
/plugin marketplace add j0hanz/j0hanz-marketplace
/plugin install tutor@j0hanz-marketplace
```

Or clone and install from a local path:

```bash
git clone https://github.com/j0hanz/j0hanz-marketplace.git
```

```text
/plugin marketplace add /absolute/path/to/j0hanz-marketplace
/plugin install tutor@j0hanz-marketplace
```

## Day one

1. Make an empty folder for one topic.
2. Open Claude Code there.
3. Run `/teach "Rust ownership"` (or whatever you want to learn).
4. Answer the mission question honestly. Stop there.
5. Next session, type `carry on`.

That is the whole loop. From the second session on, you never type a command again. You just show up and carry on.

## License

[MIT](LICENSE)
