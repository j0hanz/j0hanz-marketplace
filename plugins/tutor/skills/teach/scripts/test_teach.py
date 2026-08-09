#!/usr/bin/env python3
"""test_teach.py — the one runnable check for the two branchy things here:
the scoring table (RECORDS.md § Scoring) and the Stop gate's state machine.

Plain asserts, stdlib only, no framework. Run it:

  python skills/teach/scripts/test_teach.py

Exit 0 = every assertion passed; a failure raises and the traceback names the
line. Everything else in teach.py is straight-line parsing that fails loudly on
its own.
"""

import contextlib
import io
import os
import shutil
import sys
import tempfile
from datetime import date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, "hooks"))

import teach  # noqa: E402
import teach_hook  # noqa: E402  # pyright: ignore[reportMissingImports]

TODAY = date(2026, 8, 5)


def write_rec(
    base, rid, interval, lapses=0, status="active", nxt="2026-07-27"
):
    teach.write_text(
        os.path.join(base, "learning-records", rid + ".md"),
        f"---\ninterval: {interval}\nlapses: {lapses}\nstatus: {status}\n"
        f"next: {nxt}\n---\n\n# {rid}\n",
    )


def open_ledger(base, tests, spacing=""):
    line = (
        f"- unscored cold open: lessons/0001-x.html tests "
        f"{', '.join(tests)} (asked: 0)"
    )
    teach.write_text(
        os.path.join(base, "NOTES.md"), f"# Notes\n\n{spacing}{line}\n"
    )


def reload(base, rid):
    return teach.load_record(
        os.path.join(base, "learning-records", rid + ".md")
    )


def test_scoring(base):
    """Every row of the scoring table, through the single writer."""
    t = TODAY

    # Right below ceiling: interval 1 * doubling 2 = 2, lapses reset.
    write_rec(base, "0001-a", 1)
    open_ledger(base, ["0001-a"])
    rows, _ = teach.score_open_cold_open(base, "Cold open 0001-x: 1 right")
    assert rows[0]["interval"] == "2", rows[0]
    assert rows[0]["next"] == (t + timedelta(days=2)).isoformat(), rows[0]
    assert rows[0]["lapses"] == "0", rows[0]
    assert rows[0]["status"] == "active", rows[0]
    r = reload(base, "0001-a")
    assert r["interval"] == 2 and r["next"] == t + timedelta(days=2), r["fm"]
    assert r["lapses"] == 0 and r["status"] == "active", r["fm"]

    # Right at ceiling: retire, interval/next untouched, lapses reset.
    write_rec(base, "0002-b", 90)
    open_ledger(base, ["0002-b"])
    rows, _ = teach.score_open_cold_open(base, "Cold open 0001-x: 1 right")
    assert rows[0]["status"] == "retired", rows[0]
    assert rows[0]["interval"] == "90" and rows[0]["next"] == "2026-07-27", (
        rows[0]
    )
    assert reload(base, "0002-b")["status"] == "retired"

    # Wrong: interval -> 1, next +1 day, lapses +1.
    write_rec(base, "0003-c", 4, lapses=1)
    open_ledger(base, ["0003-c"])
    rows, _ = teach.score_open_cold_open(base, "Cold open 0001-x: 1 wrong")
    assert rows[0]["interval"] == "1", rows[0]
    assert rows[0]["next"] == (t + timedelta(days=1)).isoformat(), rows[0]
    assert rows[0]["lapses"] == "2", rows[0]
    r = reload(base, "0003-c")
    assert r["interval"] == 1 and r["lapses"] == 2, r["fm"]

    # Abandon: next += current interval, no credit, no lapse.
    write_rec(base, "0004-d", 3)
    open_ledger(base, ["0004-d"])
    rows, _ = teach.score_open_cold_open(base, "abandon")
    assert rows[0]["next"] == (t + timedelta(days=3)).isoformat(), rows[0]
    assert rows[0]["lapses"] == "0" and rows[0]["status"] == "active", rows[0]

    # asked bumps 0 -> 1 -> 2, then abandon closes the ledger.
    write_rec(base, "0005-e", 5)
    open_ledger(base, ["0005-e"])
    notes, n = teach.bump_asked(teach.read_notes(base))
    assert n == 1, n
    teach.write_text(os.path.join(base, "NOTES.md"), notes)
    notes, n = teach.bump_asked(notes)
    assert n == 2, n
    teach.write_text(os.path.join(base, "NOTES.md"), notes)
    rows, _ = teach.score_open_cold_open(base, "abandon")
    assert rows[0]["next"] == (t + timedelta(days=5)).isoformat(), rows[0]
    assert teach.parse_ledger_line(teach.read_notes(base)) is None

    # Fractional doubling rounds up, never truncates (1 * 1.5 = 1.5 -> 2 days).
    write_rec(base, "0006-f", 1)
    open_ledger(
        base, ["0006-f"], "- spacing: {doubling: 1.5, ceiling: 10}\n\n"
    )
    rows, _ = teach.score_open_cold_open(base, "Cold open 0001-x: 1 right")
    assert rows[0]["interval"] == "2", rows[0]
    assert rows[0]["next"] == (t + timedelta(days=2)).isoformat(), rows[0]

    # A fractional stored interval rounds on abandon too.
    write_rec(base, "0007-g", 1.5)
    open_ledger(
        base, ["0007-g"], "- spacing: {doubling: 1.5, ceiling: 10}\n\n"
    )
    rows, _ = teach.score_open_cold_open(base, "abandon")
    assert rows[0]["interval"] == "2", rows[0]
    assert rows[0]["next"] == (t + timedelta(days=2)).isoformat(), rows[0]


def test_result_line_refusals(base):
    """A line the schedule must not be rewritten from."""
    for bad in (
        "no colon here",
        "Cold open 0001-x: 1 maybe",
        "Cold open 0001-x: 2 right",  # positions must start at 1
        "Cold open 0001-x: 1 right, 3 wrong",  # and stay contiguous
    ):
        try:
            teach.parse_result_line(bad)
        except teach.TeachError as e:
            assert e.code == 2, (bad, e.code)
        else:
            raise AssertionError(f"parsed a bad line: {bad!r}")

    # A line from another lesson must not score the open ledger.
    write_rec(base, "0008-h", 1)
    open_ledger(base, ["0008-h"])
    try:
        teach.score_open_cold_open(base, "Cold open 9999-z: 1 right")
    except teach.TeachError as e:
        assert e.code == 1 and "9999-z" in e.msg, e.msg
    else:
        raise AssertionError("scored a line from the wrong lesson")
    assert teach.parse_ledger_line(teach.read_notes(base)) is not None


def test_stop_gate(base):
    """arm -> block -> asked-silent -> re-arm. The gate never runs by hand: it
    needs a Stop event and a guard file under CLAUDE_PLUGIN_DATA."""
    guard = teach_hook._guard_path(base)

    def write_ledger(asked, cwd=base):
        teach.write_text(
            os.path.join(cwd, "NOTES.md"),
            f"# Notes\n\n- unscored cold open: lessons/0001-x.html tests "
            f"0001-x (asked: {asked})\n",
        )

    def stop(cwd=base):
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            rc = teach_hook.event_stop(cwd, {})
        return rc, buf.getvalue()

    # Ship turn: first Stop after the ledger opened arms and says nothing.
    write_ledger(0)
    rc, out = stop()
    assert rc == 0 and out == "", (rc, out)
    assert teach.read_text(guard).strip() == "lessons/0001-x.html"

    # Second Stop blocks once, and the guard flips to the nagged marker.
    rc, out = stop()
    assert rc == 0 and '"block"' in out and '"reason"' in out, out
    assert "nagged" in teach.read_text(guard)

    # asked non-zero: the model already asked, so the gate stays quiet.
    write_ledger(1)
    assert stop() == (0, "")

    # Ledger closed: guard removed, gate re-armed for the next lesson.
    teach.write_text(os.path.join(base, "NOTES.md"), "# Notes\n\n- nothing\n")
    assert stop() == (0, "")
    assert not os.path.isfile(guard)

    # A second workspace must not disarm the first: lesson paths repeat across
    # courses, and a shared guard let every interleaved turn re-arm the gate.
    other = os.path.join(base, "other")
    os.makedirs(os.path.join(other, "learning-records"), exist_ok=True)
    write_ledger(0)
    write_ledger(0, cwd=other)
    assert stop() == (0, "") and stop(other) == (0, "")  # both armed
    assert '"block"' in stop()[1] and '"block"' in stop(other)[1]
    assert stop() == (0, "") and stop(other) == (0, "")  # both stay quiet


def main():
    base = tempfile.mkdtemp(prefix="teach-test-")
    old_pd = os.environ.get("CLAUDE_PLUGIN_DATA")
    teach.TODAY = TODAY
    try:
        os.environ["CLAUDE_PLUGIN_DATA"] = base
        os.makedirs(os.path.join(base, "learning-records"))
        os.makedirs(os.path.join(base, "lessons"))
        test_scoring(base)
        test_result_line_refusals(base)
        test_stop_gate(base)
    finally:
        teach.TODAY = None
        shutil.rmtree(base, ignore_errors=True)
        if old_pd is None:
            os.environ.pop("CLAUDE_PLUGIN_DATA", None)
        else:
            os.environ["CLAUDE_PLUGIN_DATA"] = old_pd
    print("test_teach OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
