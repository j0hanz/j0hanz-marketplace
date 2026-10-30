# j0hanz-marketplace

A marketplace of standalone plugins for coding agents (Claude Code, GitHub Copilot CLI, and Antigravity CLI).

## Language

**Client**:
A coding-agent host that installs and runs plugins (Claude Code, GitHub Copilot CLI, or Antigravity CLI).
_Avoid_: Host, platform, harness, runner

**Plugin**:
A self-contained folder under `plugins/<name>/` that ships skills, agents, hooks, or MCP servers for one or more clients.
_Avoid_: Package, extension, addon

**Capability**:
A skill, agent, or MCP server a plugin ships; the site enumerates, counts, and searches them as one list.
_Avoid_: Feature, offering, item

**Catalog**:
The central listing at `.claude-plugin/marketplace.json` from which Claude Code, GitHub Copilot CLI, the landing page, and the README derive available plugins.
_Avoid_: Registry, index, manifest list

**Filter**:
What the visitor narrows the catalog by: the chosen client, the chosen category, and the search needle.
_Avoid_: View, query state

**Mod**:
A Claude Code-only plugin whose `hooks/hooks.json` loads a TypeScript module rather than shell command hooks.
_Avoid_: Extension, native plugin

**Gate**:
A `PreToolUse` hook that inspects an impending tool call and either allows it or denies it with a reason before the tool executes.
_Avoid_: Validator, interceptor, blocker, guard

**Advisory**:
Non-blocking feedback emitted after a tool call (`PostToolUse`) or delivered on the next model step (`PreInvocation`) to guide the agent without refusing the write.
_Avoid_: Warning, hint, lint note

**Sweep**:
A turn-end (`Stop`) check that inspects dirty or newly added lines across the working tree and reports findings once per session.
_Avoid_: Finalizer, teardown check, post-run audit

**Ledger**:
A session-scoped record in the OS temporary directory that tracks which findings, advisories, or notices have already been emitted so a hook never nags twice for the same item.
_Avoid_: Cache, state store, seen list, dedupe file

**Effort**:
A dated directory under `docs/plan/YYYY-MM-DD-<name>/` that groups the workbench artifacts (`spec`, `plan`, `run`, `verify`, `diagnose`, and hunts) for one unit of work.
_Avoid_: Project folder, task directory, workspace
