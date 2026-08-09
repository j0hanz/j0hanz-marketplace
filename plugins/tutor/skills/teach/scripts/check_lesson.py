#!/usr/bin/env python3
"""check_lesson.py — stdlib-only validator for teach lessons/reference docs.

Validates a generated lessons/*.html (or reference doc) against the contract
defined by templates/lesson.html + templates/assets/quiz.js + templates/assets/styles.css.

Usage:
  python skills/teach/scripts/check_lesson.py <path>                # lesson (default)
  python skills/teach/scripts/check_lesson.py --type=reference <path>
  python skills/teach/scripts/check_lesson.py --self                # validate templates/lesson.html

Stale copied assets are reported by `teach.py state`, which reuses parse_stamp
and TEMPLATES_DIR from here — this script does not check them a second time.

Exit: 0 pass, 1 violations found, 2 usage/parse error.
"""

import contextlib
import os
import posixpath
import re
import sys
from html.parser import HTMLParser

# The one place the templates directory is computed. scripts/ sits at
# <plugin>/skills/teach/scripts, templates/ at <plugin>/templates — three levels
# up. Hand-computing this in more than one file is what let teach.py drift to a
# two-level path and report every workspace's assets as fresh.
TEMPLATES_DIR = os.path.normpath(
    os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "..",
        "..",
        "..",
        "templates",
    )
)

# cold-open mapping comment: "cold-open: 1=0003-slug 2=0007-slug". The one
# implementation of this shape — teach.py imports both helpers below rather
# than re-deriving them, because the invariant they encode (contiguous
# positions, one record per item) decides which learning records `score`
# rewrites, and two copies of a scoring rule is one copy too many.
COLD_OPEN_PAIR_RE = re.compile(r"(\d+)=([0-9A-Za-z][0-9A-Za-z-]*)")

# record ids and data-lesson stems are 4-digit-prefixed (0003-slug). One regex
# for both sides of the contract so they cannot drift from teach.py
# resolve_record_path, which does re.match(r"(\d{4})", rec_id) and rejects any
# id without that prefix. A fifth restatement of the shape is a fifth thing to
# drift; this one mirrors teach.py line for line.
NNNN_RE = re.compile(r"(\d{4})")


def cold_open_pairs(text):
    """[(position, record_id), ...] from a mapping comment's text.

    Order is not meaningful — callers sort — so an out-of-order comment is not
    a fault; gaps and repeats are, and cold_open_faults reports those.
    """
    return [(int(n), rid) for n, rid in COLD_OPEN_PAIR_RE.findall(text or "")]


def cold_open_faults(pairs):
    """Structural faults in parsed pairs, as [(rule, message), ...]."""
    faults = []
    positions = sorted(p for p, _ in pairs)
    if positions != list(range(1, len(pairs) + 1)):
        faults.append(
            (
                "cold-open-comment-positions",
                f"comment positions {positions} must be 1..{len(pairs)} "
                f"with no gaps or repeats",
            )
        )
    ids = [rid for _, rid in pairs]
    dupes = sorted({r for r in ids if ids.count(r) > 1})
    if dupes:
        faults.append(
            (
                "cold-open-comment-duplicate",
                f"comment maps {', '.join(dupes)} to more than one position; "
                f"a cold open tests one learning record per item, and scoring "
                f"would write that record twice keeping only the last outcome",
            )
        )
    bad = sorted({r for r in ids if not NNNN_RE.match(r)})
    if bad:
        faults.append(
            (
                "cold-open-comment-id-shape",
                f"comment ids {', '.join(bad)} must be 4-digit-prefixed "
                f"record ids like 0003-slug; teach.py resolve_record_path "
                f"rejects any without the prefix and the ledger write would "
                f"lose them",
            )
        )
    return faults


# The per-lesson hooks are a closed set of names, and roots.css is where that
# set lives (DESIGN.md § Per-lesson hooks). Read it back out of the CSS the page
# actually links rather than restating it here — the set is already written down
# in four prose places, and a fifth copy is a fifth thing to drift. An absent
# attribute reads as the base :root, which is why no rule naming a "default"
# exists to find.
HOOK_RE = re.compile(r":root\[data-(accent|density)=['\"]([^'\"]+)['\"]\]")

# An unfilled `{{…}}` slot from templates/lesson.html. Matched by shape, not by
# name: the placeholder set is the template's, and a second list of names here
# is a third place for it to drift. A lesson teaching Handlebars/Vue/Jinja
# writes `{{ … }}` on purpose, so text inside <pre>/<code> is exempt.
PLACEHOLDER_RE = re.compile(r"\{\{\s*([^{}]{0,60})")

VOID = {
    "br",
    "img",
    "meta",
    "link",
    "input",
    "hr",
    "area",
    "base",
    "col",
    "embed",
    "source",
    "track",
    "wbr",
    "param",
}

# tags whose ref must resolve to a local file — SKILL.md bans every remote
# subresource, not just scripts and stylesheets: a lesson has to render with
# the cable out, and a remote image in a lesson built from fetched material
# is a beacon reporting when the learner opened it.
MEDIA_SRC = {
    "img": "src",
    "iframe": "src",
    "video": "src",
    "audio": "src",
    "source": "src",
    "embed": "src",
    "track": "src",
    "object": "data",
}


# ponytail: a single DocParser walks the doc and collects everything the
# verify pass needs. Two-pass: collect-then-verify (REQ-003).
class DocParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = set()
        self.quizzes = []  # {line, items:[{line,correct,options}], has_result, has_copy, releases}
        self.script_srcs = []  # (line, src)
        self.link_hrefs = []  # (line, href)  — stylesheet links only
        self.media_srcs = []  # (line, tag, ref)
        self.anchor_hrefs = []  # (line, href)
        self.html_attrs = {}  # attributes on <html> — lang and the two hooks
        self.inline_css = []  # (line, text)
        self._stack = []  # nesting context for quiz/item association
        self._css_cap = None
        self._css_line = 0
        self.sealed_ids = set()  # ids of elements carrying class="sealed"
        self.labeled_seal_ids = set()  # ids carrying a filled data-seal-label
        self.inert_ids = set()  # ids of elements carrying the inert attribute
        self.has_seal_note = False  # a .seal-note sits outside the seal
        self.other_links = []  # (line, rel, href) — <link> that is not a stylesheet
        self.cold_open_quizzes = (
            set()
        )  # id(q) of .quiz with a .cold-open ancestor
        self.cold_open_comment = (
            None  # (line, text) of the cold-open mapping comment
        )
        # earliest .quiz-item line inside any .cold-open — the mapping comment
        # must precede every item (SKILL.md: the comment is the FIRST line inside
        # .cold-open), so a comment after the first item is out of order
        self.cold_open_first_item_line = None
        self.placeholders = []  # (line, snippet) of unfilled {{…}} slots
        self.toc_stops = 0  # count of .toc-stop — the route's four stops

    def _note_placeholder(self, line, text):
        m = PLACEHOLDER_RE.search(text or "")
        if m:
            self.placeholders.append((line, m.group(1).strip()))

    def handle_starttag(self, tag, attrs):
        ad = {k: (v or "") for k, v in attrs}
        cls = set(ad.get("class", "").split())
        line = self.getpos()[0]
        # first <html> wins: a raw <html> in a markup sample further down must
        # not clobber the real one and take lang with it
        if tag == "html" and not self.html_attrs:
            self.html_attrs = ad
        if ad.get("id"):
            self.ids.add(ad["id"])
        # names as well as values: a slot written bare in a start tag —
        # `<div {{ATTRS}}>` — parses as an attribute name carrying no value,
        # and scanning values alone shipped it to the learner unfilled.
        for k, v in ad.items():
            self._note_placeholder(line, k)
            self._note_placeholder(line, v)
        if "toc-stop" in cls:
            self.toc_stops += 1
        if "sealed" in cls and ad.get("id"):
            self.sealed_ids.add(ad["id"])
        if ad.get("data-seal-label", "").strip() and ad.get("id"):
            self.labeled_seal_ids.add(ad["id"])
        if "inert" in ad and ad.get("id"):
            self.inert_ids.add(ad["id"])
        cur_quiz = None
        cur_item = None
        for f in reversed(self._stack):
            if f.get("is_quiz") and cur_quiz is None:
                cur_quiz = f["quiz"]
            if f.get("is_item") and cur_item is None:
                cur_item = f["item"]
        frame = {"tag": tag, "cls": cls, "is_quiz": False, "is_item": False}
        if "quiz" in cls:
            q = {
                "line": line,
                "items": [],
                "has_result": False,
                "has_copy": False,
                "result_hidden": False,
                "releases": ad.get("data-releases"),
                "lesson": ad.get("data-lesson"),
            }
            self.quizzes.append(q)
            frame["is_quiz"] = True
            frame["quiz"] = q
            cur_quiz = q
            if any("cold-open" in f.get("cls", ()) for f in self._stack):
                self.cold_open_quizzes.add(id(q))
        if "quiz-item" in cls and cur_quiz is not None:
            it = {
                "line": line,
                "correct": ad.get("data-correct"),
                "options": 0,
            }
            cur_quiz["items"].append(it)
            frame["is_item"] = True
            frame["item"] = it
            cur_item = it
            if id(cur_quiz) in self.cold_open_quizzes and (
                self.cold_open_first_item_line is None
                or line < self.cold_open_first_item_line
            ):
                self.cold_open_first_item_line = line
        if "quiz-btn" in cls and cur_item is not None:
            cur_item["options"] += 1
        if "quiz-result" in cls and cur_quiz is not None:
            cur_quiz["has_result"] = True
            if "hidden" in ad:
                cur_quiz["result_hidden"] = True
        if "quiz-copy" in cls and cur_quiz is not None:
            cur_quiz["has_copy"] = True
        if "seal-note" in cls:
            self.has_seal_note = True
        media_attr = MEDIA_SRC.get(tag)
        if media_attr and ad.get(media_attr):
            self.media_srcs.append((line, tag, ad[media_attr]))
        # srcset is a comma-separated candidate list; each candidate is
        # "<url> [descriptor]". Feeding each url into media_srcs reuses the
        # remote and missing-asset checks verify() already runs over that list.
        if tag in ("img", "source") and ad.get("srcset"):
            for cand in ad["srcset"].split(","):
                parts = cand.split()
                if parts:
                    self.media_srcs.append((line, tag, parts[0]))
        if tag == "a" and ad.get("href"):
            self.anchor_hrefs.append((line, ad["href"]))
        if tag == "script" and ad.get("src"):
            self.script_srcs.append((line, ad["src"]))
        if tag == "link" and ad.get("href"):
            if "stylesheet" in ad.get("rel", "").lower():
                self.link_hrefs.append((line, ad["href"]))
            else:
                self.other_links.append((line, ad.get("rel", ""), ad["href"]))
        if tag == "style":
            self._css_cap = []
            self._css_line = line
        if tag not in VOID:
            self._stack.append(frame)

    def handle_endtag(self, tag):
        for i in range(len(self._stack) - 1, -1, -1):
            if self._stack[i]["tag"] == tag:
                del self._stack[i:]
                break
        if tag == "style" and self._css_cap is not None:
            self.inline_css.append((self._css_line, "".join(self._css_cap)))
            self._css_cap = None

    def handle_data(self, data):
        if self._css_cap is not None:
            self._css_cap.append(data)
        if not any(f["tag"] in ("pre", "code") for f in self._stack):
            self._note_placeholder(self.getpos()[0], data)

    def handle_comment(self, data):
        line = self.getpos()[0]
        text = data.strip()
        self._note_placeholder(line, text)
        # only the cold-open mapping comment is of interest; identify it by the
        # literal 'cold-open:' prefix AND a cold-open ancestor on the stack.
        if not text.startswith("cold-open:"):
            return
        for f in reversed(self._stack):
            if "cold-open" in f.get("cls", set()):
                self.cold_open_comment = (line, text)
                break


def read_file(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def check_css(line, css):
    """Offline rules on one CSS block. Every block owes these independently —
    one remote reference anywhere breaks rendering with the cable out."""
    errors = []
    if re.search(r"@import", css):
        errors.append(
            (line, "css-import", "remove @import; inline CSS in assets/")
        )
    if re.search(r"url\(\s*['\"]?\s*(?:https?:|//)", css):
        errors.append(
            (line, "css-remote-url", "remove remote url(); use local assets/")
        )
    return errors


def check_quiz_css(css):
    """Quiz a11y rules, run once over every CSS block joined.

    These are properties of the stylesheet the page ends up with, not of any one
    block. Run per block they fail a lesson for adding four lines of inline style
    for a topic component, and push the model to duplicate tokens that live in
    exactly one place (DESIGN.md § Tokens). Only a document that actually has a
    quiz owes them.

    Reported against line 1 for the same reason: no single block owes them, and
    the earlier line-of-the-first-block was whichever <style> or <link> happened
    to sort first — never assets/styles.css, where the fix belongs.
    """
    errors = []
    if not re.search(r"quiz-btn\s*:focus-visible", css):
        errors.append(
            (1, "a11y-focus-visible", "add a .quiz-btn:focus-visible rule")
        )
    has_state_border = any(
        "[data-state" in block and re.search(r"\bborder", block)
        for block in re.split(r"\}", css)
    )
    if not has_state_border:
        errors.append(
            (
                1,
                "a11y-state-border",
                "use [data-state] with a border declaration, not color alone",
            )
        )
    return errors


def is_outside_assets(ref):
    """True if a script src / link href points outside assets/."""
    if not ref:
        return False
    if ref.startswith(("http://", "https://", "//")):
        return True
    # allow assets/..., ./assets/..., ../assets/...  (the template's form)
    # ponytail: strip the literal prefixes, not a char set — lstrip('./') would
    # eat a leading '/' and pass '/assets/...' as inside.
    while ref.startswith(("./", "../")):
        ref = ref[2:] if ref.startswith("./") else ref[3:]
    # collapse embedded .. (assets/../x.js) — posixpath keeps '/' so the
    # prefix test holds on Windows.
    return not posixpath.normpath(ref).startswith("assets/")


def resolve_local(html_dir, ref, self_mode):
    """Absolute path a local ref points at, or None when not checkable.

    None means: remote, inline data:, fragment-only, or an unfilled
    {{placeholder}} — none of which is a missing local file.
    """
    if not ref or "{{" in ref:
        return None
    if ref.startswith(("http://", "https://", "//", "data:", "mailto:", "#")):
        return None
    p = ref.split("#")[0].split("?")[0]
    if not p:
        return None
    full = os.path.normpath(os.path.join(html_dir, p))
    # --self validates templates/lesson.html, whose ../assets/x lives next to
    # the template instead. Same fallback the linked-CSS resolution uses.
    if not os.path.isfile(full) and self_mode:
        sib = os.path.join(html_dir, os.path.basename(p))
        if os.path.isfile(sib):
            return sib
    return full


def verify(
    doc_type, parser, linked_css, html_dir, self_mode=False, html_name=""
):
    """Every contract violation in a parsed document, as [(line, rule, fix)]."""
    errors = []
    if not parser.html_attrs.get("lang"):
        errors.append((1, "a11y-lang", "add a lang attribute to <html>"))
    # Two views of the page's CSS, and the difference is load-bearing. The
    # offline and a11y rules owe the whole of it, inline <style> included. The
    # per-lesson hooks owe the linked sheets only: a lesson that writes its own
    # :root[data-accent] rule inline is the case the closed set forbids, and
    # reading it back would let that lesson approve itself.
    css_blocks = linked_css + parser.inline_css
    for line, text in css_blocks:
        errors += check_css(line, text)
    if parser.quizzes and css_blocks:
        errors += check_quiz_css("\n".join(text for _, text in css_blocks))
    errors += _hook_errors(parser, "\n".join(t for _, t in linked_css))
    errors += _offline_errors(parser)
    errors += _missing_asset_errors(parser, html_dir, self_mode)
    errors += _anchor_errors(parser)
    if not self_mode:
        errors += _placeholder_errors(parser)
        errors += _broken_link_errors(parser, html_dir)
    if doc_type == "lesson":
        errors += _route_errors(parser)
        errors += _quiz_errors(parser, self_mode, html_name)
        errors += _seal_errors(parser)
        if not self_mode:
            errors += _cold_open_comment_errors(parser)
            errors += _roots_css_errors(parser, html_dir, self_mode)
    return errors


def _hook_errors(parser, linked):
    """A per-lesson hook naming something the linked stylesheets never define.

    The lesson silently renders the default otherwise, which is the whole
    failure: a lesson can pick `data-accent="cobolt"` and look correct. The
    allowed names come from the stylesheet itself, so adding a fifth accent to
    roots.css needs no edit here. Linked sheets only — see verify(). An
    unreadable one finds no names at all, and _linked_css already reports that
    as css-link, so stay quiet.
    """
    errors = []
    allowed = {"accent": set(), "density": set()}
    for hook, name in HOOK_RE.findall(linked):
        allowed[hook].add(name)
    for hook, names in allowed.items():
        # empty attribute reads as absent, and an unfilled one is already
        # reported as unfilled-placeholder
        value = parser.html_attrs.get(f"data-{hook}", "").strip()
        if not value or "{{" in value:
            continue
        # value set, non-empty, not a placeholder, but no linked sheet defines
        # any :root[data-{hook}] hook — distinct from "name not in the set"
        # below: here the set is empty, so the attribute names something no
        # sheet on the page can honour, and the lesson silently renders the
        # default. roots.css missing entirely is the usual cause, reported
        # separately as missing-roots-css; this fires when the attribute is set
        # against a sheet that defines no hook at all.
        if not names:
            errors.append(
                (
                    1,
                    f"unknown-{hook}-source",
                    f'html data-{hook}="{value}" set but no linked stylesheet '
                    f"defines any :root[data-{hook}] hook; link assets/roots.css "
                    f"or drop the attribute",
                )
            )
            continue
        if value not in names:
            errors.append(
                (
                    1,
                    f"unknown-{hook}",
                    f'<html data-{hook}="{value}"> names no rule in the '
                    f"linked CSS; use one of "
                    f"{', '.join(sorted(names))}, or drop the attribute "
                    f"for the default",
                )
            )
    return errors


def _route_errors(parser):
    """Stop labels are the lesson's own words; the route itself is the course
    skeleton (DESIGN.md § Variation). Four stops, always — a lesson free to
    drop one is a lesson that stop being this course."""
    if parser.toc_stops == 4:
        return []
    return [
        (
            1,
            "route-four-stops",
            f"lesson route carry {parser.toc_stops} .toc-stop; must be "
            f"exactly 4 — label each stop as the lesson need, never "
            f"add or drop one",
        )
    ]


def _offline_errors(parser):
    """Refs that reach the network — a lesson must render with the cable out."""
    errors = []
    for line, src in parser.script_srcs:
        if is_outside_assets(src):
            errors.append(
                (
                    line,
                    "offline-script",
                    f'script src "{src}" must be under assets/',
                )
            )
    for line, href in parser.link_hrefs:
        if is_outside_assets(href):
            errors.append(
                (
                    line,
                    "offline-stylesheet",
                    f'link href "{href}" must be under assets/',
                )
            )
    for line, tag, ref in parser.media_srcs:
        if ref.startswith(("http://", "https://", "//")):
            errors.append(
                (
                    line,
                    "offline-media",
                    f'<{tag}> loads "{ref}" from the network; lessons '
                    f"must render with the cable out - copy it into "
                    f"assets/ or drop it",
                )
            )
    for line, rel, href in parser.other_links:
        if href.startswith(("http://", "https://", "//")):
            errors.append(
                (
                    line,
                    "offline-link",
                    f'<link rel="{rel}"> loads "{href}" from the network; '
                    f"lessons must render with the cable out - copy it "
                    f"into assets/ or drop it",
                )
            )
    return errors


def _missing_asset_errors(parser, html_dir, self_mode):
    """Local refs that point nowhere — the same failure as no ref at all,
    and on file:// it fails silently. Stylesheets are excluded: _linked_css
    already reports an unreadable one as css-link."""
    errors = []
    for line, src in parser.script_srcs:
        target = resolve_local(html_dir, src, self_mode)
        if target and not os.path.isfile(target):
            errors.append(
                (
                    line,
                    "missing-asset",
                    f'script src "{src}" does not exist - copy '
                    f"templates/assets/quiz.js into the workspace assets/",
                )
            )
    for line, tag, ref in parser.media_srcs:
        target = resolve_local(html_dir, ref, self_mode)
        if target and not os.path.isfile(target):
            errors.append(
                (line, "missing-asset", f'<{tag}> src "{ref}" does not exist')
            )
    return errors


def _roots_css_errors(parser, html_dir, self_mode):
    """Lesson mode owes a roots.css link — the shared stylesheet where the
    per-lesson hooks and the course tokens live. Without it the hook check in
    _hook_errors is meaningless (no names found == no names defined), and a
    lesson that links only styles.css still renders the base :root but loses
    every hook the contract lets it name. Runs in lesson mode only; --self
    validates the template, which links roots.css itself."""
    errors = []
    for _line, href in parser.link_hrefs:
        p = href.split("#")[0].split("?")[0]
        if os.path.basename(p) != "roots.css":
            continue
        target = resolve_local(html_dir, href, self_mode)
        if target and os.path.isfile(target):
            return errors
    errors.append(
        (
            1,
            "missing-roots-css",
            "no assets/roots.css stylesheet linked; every lesson builds on "
            "the shared roots.css",
        )
    )
    return errors


def _anchor_errors(parser):
    """In-page jumps that land on no id. Checkable in both modes, since they
    resolve against this document — route stop 1 pointing at a #recall the
    lesson dropped with its cold open is the case this catches."""
    errors = []
    for line, href in parser.anchor_hrefs:
        if (
            href.startswith("#")
            and len(href) > 1
            and "{{" not in href
            and href[1:] not in parser.ids
        ):
            errors.append(
                (
                    line,
                    "broken-anchor",
                    f'link target "{href}" matches no id on this page',
                )
            )
    return errors


def _placeholder_errors(parser):
    """Template slots left unfilled — the template is all placeholders, and a
    lesson that still carries one ships the slot to the learner."""
    errors = []
    for line, snippet in parser.placeholders:
        errors.append(
            (
                line,
                "unfilled-placeholder",
                f'template slot "{{{{{snippet}" left unfilled; '
                f"fill it or drop the block",
            )
        )
    return errors


def _broken_link_errors(parser, html_dir):
    """Cross-links between lessons and reference docs are a completion
    criterion; external citation links are left alone by resolve_local.
    Never runs in --self, so resolve_local's sibling fallback stays off."""
    errors = []
    for line, href in parser.anchor_hrefs:
        target = resolve_local(html_dir, href, self_mode=False)
        if target and not os.path.isfile(target):
            errors.append(
                (
                    line,
                    "broken-link",
                    f'link target "{href}" does not exist',
                )
            )
    return errors


def _quiz_errors(parser, self_mode, html_name):
    """Every quiz on the page against the markup contract, cold-open rules
    included (DESIGN.md § Quiz)."""
    errors = []
    stem = os.path.splitext(html_name)[0] if html_name else ""
    for q in parser.quizzes:
        if not q["items"]:
            errors.append(
                (
                    q["line"],
                    "quiz-no-items",
                    "quiz has no .quiz-item; add at least one",
                )
            )
        # max 3 is a cold-open rule (SKILL.md step 5: one item per due
        # record, at most three). A skills practice quiz is uncapped.
        if id(q) in parser.cold_open_quizzes and len(q["items"]) > 3:
            errors.append(
                (
                    q["line"],
                    "quiz-item-cap",
                    f"{len(q['items'])} .quiz-item in the cold "
                    f"open; max 3 (one per due record)",
                )
            )
        if not q["has_result"]:
            errors.append(
                (
                    q["line"],
                    "quiz-result-missing",
                    "add a .quiz-result element inside .quiz",
                )
            )
        if q["result_hidden"]:
            errors.append(
                (
                    q["line"],
                    "quiz-result-hidden",
                    ".quiz-result must not carry hidden; quiz.js never "
                    "unhides it, so the learner never sees the line to "
                    "paste back and the cold open can never be scored",
                )
            )
        # only a cold open produces a line worth pasting back; a practice
        # quiz offering "Copy result" invites a paste against the wrong ledger
        if id(q) in parser.cold_open_quizzes and not q["has_copy"]:
            errors.append(
                (
                    q["line"],
                    "quiz-copy-missing",
                    "add a .quiz-copy button inside the cold-open .quiz",
                )
            )
        for it in q["items"]:
            try:
                c = int(it["correct"])
            except (TypeError, ValueError):
                errors.append(
                    (
                        it["line"],
                        "quiz-correct-range",
                        f'data-correct="{it["correct"]}" must be an integer index',
                    )
                )
                continue
            if c < 0 or c >= it["options"]:
                errors.append(
                    (
                        it["line"],
                        "quiz-correct-range",
                        f"data-correct={c} exceeds {it['options']} options; "
                        f"use 0..{it['options'] - 1}",
                    )
                )
        if q["releases"] and q["releases"] not in parser.ids:
            errors.append(
                (
                    q["line"],
                    "quiz-releases-target",
                    f'data-releases="{q["releases"]}" — no element id matches',
                )
            )
        if id(q) in parser.cold_open_quizzes and not q["releases"]:
            errors.append(
                (
                    q["line"],
                    "quiz-cold-open-no-releases",
                    "cold-open quiz must have data-releases pointing at the .sealed lesson body",
                )
            )
        if id(q) in parser.cold_open_quizzes and not q["lesson"]:
            errors.append(
                (
                    q["line"],
                    "cold-open-no-lesson-id",
                    'cold-open quiz must carry data-lesson="NNNN-slug"; without it '
                    "the result line cannot be matched to the open ledger",
                )
            )
        if (
            id(q) in parser.cold_open_quizzes
            and q["lesson"]
            and "{{" not in q["lesson"]
            and not NNNN_RE.match(q["lesson"])
        ):
            errors.append(
                (
                    q["line"],
                    "cold-open-lesson-id-shape",
                    f'data-lesson="{q["lesson"]}" must be a 4-digit-prefixed '
                    f"stem like 0003-slug; teach.py resolve_record_path rejects "
                    f"any without the prefix and the score line would not land",
                )
            )
        if (
            not self_mode
            and stem
            and q["lesson"]
            and id(q) in parser.cold_open_quizzes
            and q["lesson"] != stem
        ):
            errors.append(
                (
                    q["line"],
                    "cold-open-lesson-mismatch",
                    f'data-lesson="{q["lesson"]}" does not match the file name '
                    f'"{stem}"; the result line would be scored against the '
                    f"wrong lesson",
                )
            )
        if (
            q["releases"]
            and q["releases"] in parser.ids
            and q["releases"] not in parser.sealed_ids
        ):
            errors.append(
                (
                    q["line"],
                    "quiz-releases-not-sealed",
                    f'data-releases="{q["releases"]}" target must carry class="sealed"',
                )
            )
        # blur seals the gate for the eye only — inert is what holds it for
        # keyboard and screen-reader users. quiz.js drops both on release.
        if (
            q["releases"]
            and q["releases"] in parser.sealed_ids
            and q["releases"] not in parser.inert_ids
        ):
            errors.append(
                (
                    q["line"],
                    "quiz-releases-not-inert",
                    f'data-releases="{q["releases"]}" target must also carry inert '
                    f"— .sealed alone leaves the body tabbable and read aloud",
                )
            )
    return errors


def _seal_errors(parser):
    """A seal opens one way only: a quiz whose data-releases names it —
    quiz.js has no other path to it. A lesson that drops its cold open
    and leaves the body sealed is inert, blurred and unopenable, so the
    seal owes a releaser before the last two checks mean anything."""
    errors = []
    released = {q["releases"] for q in parser.quizzes if q["releases"]}
    for sid in sorted(parser.sealed_ids - released):
        errors.append(
            (
                1,
                "sealed-never-released",
                f'"{sid}" carries class="sealed" but no quiz '
                f"data-releases it; nothing on the page can open it - "
                f"drop sealed/inert/data-seal-label with the cold open, "
                f"or add the cold open back",
            )
        )
    # Both below are faults of a seal that a quiz does open. Run them over
    # every sealed id and a lesson that correctly dropped its cold open
    # gets told to add a .seal-note - the fix that produces a sealed lesson
    # nobody can open, which is how this hole stayed green.
    open_seals = parser.sealed_ids & released

    # Any quiz on the page needs quiz.js — the result line, copy control and
    # release gate all live in it. Two rules, one scan: a sealed body with no
    # script is unreadable and unrecoverable, so it gets its own name and wins
    # when both apply; a practice quiz with no seal is the other case.
    has_quiz_js = any(
        os.path.basename(s.split("#")[0].split("?")[0]) == "quiz.js"
        for _, s in parser.script_srcs
    )
    if not has_quiz_js and (open_seals or parser.quizzes):
        errors.append(
            (
                1,
                "sealed-no-quiz-script" if open_seals else "quiz-no-script",
                ("lesson body is sealed" if open_seals else "page has .quiz")
                + " but no quiz.js is linked; "
                'add <script src="../assets/quiz.js"></script>',
            )
        )

    # the veil renders attr(data-seal-label) and nothing else — the stylesheet
    # keeps no English literal behind it — so a seal without that attribute is
    # a blank veil over a lesson the learner cannot read past.
    for sid in sorted(open_seals - parser.labeled_seal_ids):
        errors.append(
            (
                1,
                "seal-label-missing",
                f'"{sid}" is sealed but carries no data-seal-label; the '
                f"veil renders blank - add the lesson's own line for it",
            )
        )

    # the seal's own label is CSS content inside the inert subtree, and
    # inert prunes that subtree from the accessibility tree — without a
    # .seal-note outside the seal the instruction reaches nobody who
    # cannot see the blur (DESIGN.md § Signature)
    if open_seals and not parser.has_seal_note:
        errors.append(
            (
                1,
                "seal-note-missing",
                "lesson body is sealed but no .seal-note element exists; "
                'add <p class="seal-note" role="status">…</p> as a '
                "sibling of the cold-open quiz, outside the seal",
            )
        )
    return errors


def _cold_open_comment_errors(parser):
    """The cold-open mapping comment (SKILL.md § Cold open — step 8 scoring
    depends on it)."""
    co_q = next(
        (q for q in parser.quizzes if id(q) in parser.cold_open_quizzes),
        None,
    )
    if co_q is None:
        return []
    if parser.cold_open_comment is None:
        return [
            (
                co_q["line"],
                "cold-open-comment-missing",
                "add a <!-- cold-open: 1=NNNN-slug 2=NNNN-slug --> comment "
                "inside .cold-open mapping items to record ids",
            )
        ]
    errors = []
    cline, ctext = parser.cold_open_comment
    # SKILL.md: the mapping comment is the FIRST line inside .cold-open, so it
    # must precede every .quiz-item. A comment after the first item is out of
    # order and the ledger write would map the wrong record to each item.
    if (
        parser.cold_open_first_item_line is not None
        and cline > parser.cold_open_first_item_line
    ):
        errors.append(
            (
                cline,
                "cold-open-comment-not-first",
                f"cold-open comment at line {cline} must be the first line "
                f"inside .cold-open; first .quiz-item is at line "
                f"{parser.cold_open_first_item_line}",
            )
        )
    pairs = cold_open_pairs(ctext)
    if len(pairs) != len(co_q["items"]):
        errors.append(
            (
                cline,
                "cold-open-comment-count",
                f"comment maps {len(pairs)} items but quiz has "
                f"{len(co_q['items'])} .quiz-item; counts must match",
            )
        )
    for rule, msg in cold_open_faults(pairs):
        errors.append((cline, rule, msg))
    return errors


def parse_stamp(text):
    """Return the integer teach-template-version stamp, or None if absent."""
    m = re.search(r"teach-template-version:\s*(\d+)", text)
    return int(m.group(1)) if m else None


def main(argv):
    # ponytail: same stream guard as teach.py — two fix messages carry an em
    # dash, and a cp437/cp932 console cannot encode it. Module-level there
    # because a hook imports it; here main() is the only entry.
    for stream in (sys.stdout, sys.stderr):
        with contextlib.suppress(AttributeError, OSError, ValueError):
            stream.reconfigure(errors="replace")
    doc_type = "lesson"
    self_mode = False
    path = None
    for a in argv[1:]:
        if a == "--self":
            self_mode = True
        elif a.startswith("--type="):
            v = a.split("=", 1)[1]
            if v not in ("lesson", "reference"):
                print(
                    "usage: --type must be lesson|reference", file=sys.stderr
                )
                return 2
            doc_type = v
        elif a.startswith("-"):
            print(f"unknown flag {a}", file=sys.stderr)
            return 2
        else:
            path = a
    if self_mode:
        path = os.path.join(TEMPLATES_DIR, "lesson.html")
        doc_type = "lesson"
    if not path:
        print(
            "usage: check_lesson.py [--type=lesson|reference] <path> | --self",
            file=sys.stderr,
        )
        return 2
    if not os.path.isfile(path):
        print(f"usage: {path} is not a file", file=sys.stderr)
        return 2

    try:
        text = read_file(path)
    except OSError as e:
        print(f"{path}: parse - cannot read file: {e}", file=sys.stderr)
        return 2

    parser = DocParser()
    try:
        parser.feed(text)
        parser.close()
    except Exception as e:
        print(f"{path}: parse - {e}", file=sys.stderr)
        return 2

    html_dir = os.path.dirname(os.path.abspath(path))
    linked, errors = _linked_css(parser, html_dir, self_mode)

    errors.extend(
        verify(
            doc_type,
            parser,
            linked,
            html_dir,
            self_mode,
            os.path.basename(path),
        )
    )

    if errors:
        for line, rule, fix in errors:
            print(f"{path}:{line}: {rule} - {fix}")
        return 1

    label = "self (templates/lesson.html)" if self_mode else path
    print(f"OK: {label}")
    return 0


def _linked_css(parser, html_dir, self_mode):
    """The page's linked stylesheets, as ([(line, text), ...], errors),
    resolved against the HTML dir. Inline <style> is already on the parser;
    verify() joins the two, and keeps them apart where that matters."""
    errors = []
    css_blocks = []
    for line, href in parser.link_hrefs:
        p = href.split("#")[0].split("?")[0]
        if p.startswith(("http://", "https://", "//")):
            continue  # flagged as offline-stylesheet in verify
        # --self validates templates/lesson.html, whose ./assets/styles.css
        # lives next to the template instead — same fallback resolve_local uses
        candidates = [os.path.normpath(os.path.join(html_dir, p))]
        if self_mode:
            candidates.append(os.path.join(html_dir, "styles.css"))
        css_text = None
        for cand in candidates:
            try:
                css_text = read_file(cand)
                break
            except OSError:
                continue
        if css_text is None:
            errors.append(
                (line, "css-link", f'cannot read linked CSS "{href}"')
            )
            continue
        css_blocks.append((line, css_text))
    return css_blocks, errors


if __name__ == "__main__":
    sys.exit(main(sys.argv))
