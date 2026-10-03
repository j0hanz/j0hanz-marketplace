---
name: research
description: Research a question in primary sources. Use when it needs sources, not the user — how a library behaves, what a spec requires, where something lives in this repo. Not for user decisions (grilling) or failures to reproduce (diagnose).
---

Dispatch a background agent (Claude Code: Agent tool, `subagent_type: "general-purpose"`, `run_in_background: true`; Copilot: `task`, `agent_type: "general-purpose"`, `mode: "background"`). Two source modes share one template: **web** (fetch and search outside the repo) or **directory** (read this working directory). A question spanning both is two dispatches, not one agent handed both source blocks.

Fill the template and pass it as the agent's prompt. Drop a whole tag when the run has nothing to put in it, and inside `<sources>` keep only the mode you picked — an agent handed both picks its own.

```text
<question>
{the one thing to find out, concrete enough to be answered wrong}
</question>

<sources>
Web mode — primary only: official docs, source code, specs, first-party APIs;
trace any secondary write-up back to the primary that owns the claim.
{pinned repos, domains, or version numbers, if any}

Directory mode — this working directory only: source, tests, config, fixtures,
and what the manifest scripts and `--help` actually print. Read the code that
owns the behavior; treat comments, READMEs, and docs as pointers to that code.
{paths, symbols, or directories to start from, if any}
</sources>

<scope>
{what is already known and needs no re-reading}
{what is out of bounds}
</scope>

<output>
Your final message is the whole deliverable — a single, self-contained report.
Open every source listed above; name the ones you opened and the ones you did
not, with why. Cite every fact with a link to the source that owns it (web) or
as `path:line` (directory), and quote the shortest excerpt that carries it.
Where a version or date is the answer, name the exact identifier; where a
convention is the answer, name one exemplar file to imitate. Where sources
contradict each other, report both rather than picking one. The deliverable is
the answer to the question asked.
</output>
```

Check the report when it returns — the agent's report reaches you, not the user. A report that misses the `<question>` as asked, or carries a fact without a citation, goes back once: re-dispatch with the gap named in `<scope>`. Under [frontier](../frontier/SKILL.md), its operations' reopen rule replaces that re-dispatch.

**Done when** the findings are relayed, every fact in them is cited or — only after the one re-dispatch — marked **unverified**, and the relay says whether the `<question>` as asked is answered.
