#!/usr/bin/env python3
"""teach_hook.py — SessionStart/Stop hook entry point for the teach plugin.

Wired from hooks/hooks.json; never invoked by the model. The deterministic state
it reads (ledger line, learning records, mission) is owned by
skills/teach/scripts/teach.py — this file only decides what a hook event should
say about that state, and stays a silent no-op outside a teach workspace.

Usage:
  teach_hook.py --event session-start|stop     (hook payload JSON on stdin)

Exit: 0 always for a well-formed event — a hook that cannot evaluate must not
deny, and on Stop any non-zero exit is a block whose message is stderr. 2 only
on usage error (argparse).
"""

import argparse
import contextlib
import hashlib
import json
import os
import sys

# teach.py is the state layer; it lives under skills/, not here.
sys.path.insert(
    0,
    os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        os.pardir,
        "skills",
        "teach",
        "scripts",
    ),
)

# resolved by the sys.path line above, which no static analyzer follows
from teach import (  # noqa: E402  # pyright: ignore[reportMissingImports]
    TeachError,
    is_workspace,
    load_records,
    mission_status,
    parse_ledger_line,
    read_notes,
    read_text,
    resume_target,
    split_records,
    today,
    write_text,
)


def _guard_path(cwd):
    """Stop-gate guard file for one workspace, or None when the data dir is unset.

    ${CLAUDE_PLUGIN_DATA} reaches hook processes and MCP/LSP subprocesses only
    — never the Bash tool the model runs `ledger` and `score` from. So only hook
    code may depend on it; the workspace ledger line stays the single source of
    truth for whether a cold open is outstanding. Without the data dir there is
    no way to remember state between turns, so the gate that uses it disables
    itself rather than trap the session in a loop it cannot exit by complying.

    One file per workspace, not one per install: lesson paths are
    workspace-relative and repeat across courses, so a single shared guard let
    two workspaces overwrite each other's armed lesson — and every overwrite
    re-arms the gate, turning "block once per lesson" into a block per
    interleaving. normcase because Windows hands back the same directory under
    more than one spelling, and two spellings would be two guard files.
    """
    d = os.environ.get("CLAUDE_PLUGIN_DATA")
    if not d:
        return None
    key = os.path.normcase(os.path.abspath(cwd)).encode("utf-8")
    # usedforsecurity=False or a FIPS build refuses sha1 outright, and main's
    # catch-all would turn that refusal into a permanently silent gate.
    h = hashlib.sha1(key, usedforsecurity=False).hexdigest()[:12]
    return os.path.join(d, f"nagged-{h}.txt")


def event_session_start(cwd):
    ledger = parse_ledger_line(read_notes(cwd))
    t = today()
    due = len(split_records(load_records(cwd))[2])
    lines = [
        "teach: workspace live",
        f"date: {t.isoformat()}",
        (
            f"ledger: OPEN {ledger['lesson']} tests "
            f"{', '.join(ledger['tests'])} asked={ledger['asked']}"
            if ledger
            else "ledger: closed"
        ),
        f"due: {due}",
        f"mission: {mission_status(cwd)}",
    ]
    rt = resume_target(cwd)
    if rt is None:
        resume_s = "—"
    elif rt["missing"]:
        resume_s = f"{rt['lesson']} file-missing"
    else:
        resume_s = f"{rt['lesson']} paste-pending" + (
            f" asked={rt['asked']}" if rt["asked"] else ""
        )
    lines.append(f"resume: {resume_s}")
    # The state above is inert without the skill: a returning learner does not
    # retype a slash command, and a model that only sees "workspace live" will
    # improvise a lesson with no retrieval gate, no validator and no ledger.
    # Name the entry point so the loop survives the session boundary.
    lines.append("next: load the tutor:teach skill before teaching")
    # ponytail: plain stdout -> added to Claude's context (verified). SessionStart
    # cannot block. If a future harness requires hookSpecificOutput wrapping,
    # wrap here — one-line change.
    print("\n".join(lines))
    return 0


def event_stop(cwd, payload):
    # The ledger line in NOTES.md is the state. The guard file only stops a
    # still-open ledger from blocking every single turn.
    if payload.get("stop_hook_active"):
        return 0
    ledger = parse_ledger_line(read_notes(cwd))
    guard = _guard_path(cwd)
    if guard is None:
        # loud on stderr, never on stdout, and only when there was something to
        # block on: without a guard file the block below would repeat every
        # turn, so the gate disables itself — say so, or the gate is silently
        # absent for the life of the install.
        # ASCII only: stderr goes to the raw console, which is cp1252 on Windows.
        if ledger is not None:
            print(
                "teach: CLAUDE_PLUGIN_DATA unset - Stop gate disabled "
                "(no guard file, cannot block once per lesson)",
                file=sys.stderr,
            )
        return 0
    if ledger is None:
        if os.path.isfile(guard):
            with contextlib.suppress(OSError):
                os.remove(guard)  # loop closed => re-arm for the next lesson
        return 0
    try:
        last = read_text(guard) if os.path.isfile(guard) else ""
    except OSError:
        last = ""
    seen, _, nagged = last.partition("\n")
    if seen.strip() != ledger["lesson"]:
        # First Stop after the ledger opened is the turn that shipped the
        # lesson — the learner has not had a chance to open it, let alone
        # answer. Arm and say nothing; blocking here nags before there is
        # anything to nag about, and burns an `asked` the abandon path counts.
        write_text(guard, ledger["lesson"])
        return 0
    if nagged.strip() == "nagged":
        return 0  # already said it once for this lesson
    if ledger["asked"]:
        return 0  # model already asked and logged it; nothing to catch
    write_text(guard, ledger["lesson"] + "\nnagged")
    # ponytail: decision:block feeds the reason to the model and continues the
    # conversation rather than ending the turn; the guard above is what keeps
    # that to once per lesson.
    # The repair has to name `asked`, not jump to abandon: this gate keys its
    # own silence on ledger["asked"], and RECORDS.md puts abandon at asked: 2.
    # A message that skips the counter teaches the model to drop a record's
    # rotation with no credit and no lapse, on the first ask.
    msg = (
        f"teach: lesson {ledger['lesson']} shipped without closing the loop — "
        f"ask the user for the cold-open result line, then run "
        f'`teach.py score "<result line>"`. Nothing came back? Run '
        f"`teach.py asked` (never hand-edit the line); only at `asked: 2` run "
        f'`teach.py score "abandon"`.'
    )
    print(json.dumps({"decision": "block", "reason": msg}))
    return 0


def main(argv):
    p = argparse.ArgumentParser(
        prog="teach_hook.py", description="teach session hooks"
    )
    p.add_argument("--event", required=True, choices=["session-start", "stop"])
    p.add_argument("--workspace", default=None)
    args = p.parse_args(argv[1:])

    payload = {}
    if not sys.stdin.isatty():
        try:
            payload = json.load(sys.stdin)
        except Exception:
            payload = {}
    cwd = payload.get("cwd") or args.workspace or os.getcwd()
    if not is_workspace(cwd):
        return 0  # silent no-op outside a teach workspace
    try:
        if args.event == "session-start":
            return event_session_start(cwd)
        return event_stop(cwd, payload)
    # Exit 0 on every failure, never e.code: on Stop a non-zero exit is a block
    # whose message is stderr, so an unexpected parse or IO failure would turn
    # into a spurious turn block. A hook that cannot evaluate must not deny.
    except BrokenPipeError:
        return 0
    except TeachError as e:
        print(f"teach: {e.msg}", file=sys.stderr)
        return 0
    except Exception as e:
        # Every exception, not just OSError: read_text decodes UTF-8, so one
        # workspace file saved in cp1252 (any Windows editor's "ANSI") raises
        # UnicodeDecodeError, which is a ValueError — the traceback used to
        # kill both hooks and leave the Stop gate silently dead for the life of
        # that file. Name the type, since this is now all the debugging there
        # is. resume_section in teach.py swallows the same way, same reason.
        print(f"teach: {type(e).__name__}: {e}", file=sys.stderr)
        return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
