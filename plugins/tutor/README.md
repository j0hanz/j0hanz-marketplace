# tutor

Learn one topic over many sessions. `/teach` builds a course in the current folder: a mission, sourced lessons, quizzes and a course home page.

## Commands

- `/teach <topic>` starts a course in the current folder, for example `/teach Rust ownership`.
- `/teach` resumes the course in the current folder with the next lesson.
- `/teach review` writes a quiz from your learning records and past lessons.

A topic named exactly `review` routes to the review command. Quote a longer phrase to get around it, for example `/teach "code review"`.

## A session

On the first `/teach Rust ownership`, the tutor confirms the folder path, then interviews you about why you want to learn it. It writes your answer to `MISSION.md`, finds sources, and builds a short lesson around one win. The lesson opens in your browser. The next day, a bare `/teach` reads the course folder, picks up where you stopped and builds the next lesson. Open `index.html` any time: the course home shows your mission, a continue card, every lesson, the reference sheets and the glossary. Every lesson links back to it.

## The course folder

| Path                            | Holds                                                  |
| ------------------------------- | ------------------------------------------------------ |
| `MISSION.md`                    | Why you are learning this                              |
| `RESOURCES.md`                  | Annotated sources the lessons draw on                  |
| `GLOSSARY.md`                   | Terms you have shown you can use                       |
| `NOTES.md`                      | Your preferences and the tutor's working notes         |
| `learning-records/NNNN-slug.md` | What you have shown you hold                           |
| `lessons/NNNN-slug.html`        | Lessons and reviews                                    |
| `reference/<slug>.html`         | Printable cheat sheets                                 |
| `assets/`                       | Shared stylesheet, quiz script and reusable components |
| `index.html`                    | The course home, rebuilt after each lesson             |

## Requirements

Any of Claude Code, GitHub Copilot CLI or Antigravity CLI. Node.js 18+ is optional: it only builds the course home and the resume report. Without it, teaching continues and the course home is not refreshed.

## Install

```text
/plugin install tutor@j0hanz-marketplace
```

For Copilot CLI and Antigravity CLI, see the install section of the marketplace README.

## Credits

Built on Matt Pocock's `teach` skill (https://github.com/mattpocock/skills/tree/main/skills/productivity/teach).

## License

MIT
