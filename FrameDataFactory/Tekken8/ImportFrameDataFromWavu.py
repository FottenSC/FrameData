"""Tekken 8 frame data importer for Wavu Wiki.

Pulls structured rows from the wiki's Cargo `Move` table, normalises them
into the per-character JSON shape the React app already consumes (one
`Game.json` + `Characters/{id}.json` files), and downloads character
portraits to `public/Games/Tekken8/Images/`.

Wavu sits behind Anubis bot protection, so we solve the "preact" challenge
once at session start and reuse the resulting auth cookie for every
subsequent API or file request.
"""

import hashlib
import html
import io
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote

import requests

FACTORY_ROOT = Path(__file__).resolve().parent.parent
if str(FACTORY_ROOT) not in sys.path:
    sys.path.insert(0, str(FACTORY_ROOT))

from common.move_data_v2 import build_payload, write_payload_atomic

WAVU_BASE = "https://wavu.wiki"
WAVU_API = f"{WAVU_BASE}/w/api.php"
WAVU_FILE = f"{WAVU_BASE}/t/Special:Redirect/file"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 "
    "FrameDataFactory/2.0 (+https://github.com/FottenSC/FrameData)"
)

AVAILABLE_COLUMNS = [
    "character", "stance", "command", "rawCommand", "hitLevel", "impact",
    "damage", "block", "hit", "counterHit", "properties", "notes",
]

CARGO_FIELDS = [
    "_pageName=page",
    "id", "num", "name", "input", "parent",
    "target", "damage", "startup", "recv", "tot", "crush",
    "block", "hit", "ch", "notes",
]

# Stance prefixes that may appear at the start of a move's input string,
# e.g. `WS.4`, `H.2+3`, `BT.1`. Mapped to the human-readable code we expose
# in the per-move `Stance` array. Unknown prefixes are still extracted —
# anything matching `<UPPERCASE>.<rest>` is treated as a stance — but this
# table seeds Game.json's stance dictionary with friendly names.
SHARED_STANCES: Dict[str, Tuple[str, str]] = {
    "CH":            ("Counter Hit",           "Move requires a counter hit."),
    "WS":            ("While Standing",        "Move performed while rising from a crouch."),
    "FC":            ("Full Crouch",           "Move performed while crouching."),
    "BT":            ("Back Turned",           "Character is facing away from the opponent."),
    "H":             ("Heat",                  "While the Heat gauge is active."),
    "RA":            ("Rage Art",              "Spends Rage state."),
    "SS":            ("Sidestep",              "During a sidestep."),
    "SSR":           ("Sidestep Right",        ""),
    "SSL":           ("Sidestep Left",         ""),
    "WR":            ("While Running",         "Performed during a dash run."),
    "CD":            ("Crouch Dash",           "After a crouch-dash motion."),
    "FUFA":          ("Face Up Feet Away",     ""),
    "FUFT":          ("Face Up Feet Toward",   ""),
    "FDFA":          ("Face Down Feet Away",   ""),
    "FDFT":          ("Face Down Feet Toward", ""),
    "KND":           ("Knockdown",             ""),
    "OTG":           ("On the ground",         ""),
    # Multi-word stance labels lifted from input strings — `(Back to
    # wall).b,b,UB` puts the parenthetical in the Stance column without
    # the brackets, throws like `Back throw` are full-line stance
    # descriptors with no button command following.
    "Back to wall":  ("Back to wall",          ""),
    "2 steps or more": ("2 steps or more",      ""),
    "After 2 steps": ("After 2 steps",          ""),
    "During Enemy wall stun": ("During Enemy wall stun", ""),
    "While down, facing up": ("While down, facing up", ""),
    "While in the air": ("While in the air",    ""),
    "While landing":  ("While landing",         ""),
    "Wall stun":      ("Wall stun",             ""),
    "Behind 1 throw": ("Behind 1 throw",        ""),
    "Behind 2 throw": ("Behind 2 throw",        ""),
    "Tackle reverse": ("Tackle reverse",        ""),
    "Left throw":    ("Left throw",            ""),
    "Right throw":   ("Right throw",           ""),
    "Back throw":    ("Back throw",            ""),
    "Left Side Throw": ("Left Side Throw",      ""),
    "Right Side Throw": ("Right Side Throw",    ""),
}

# Note keywords -> Properties tag list. Order matters — earlier entries take
# precedence in tooltips. Keep tags ≤ 3 characters where possible to play
# nicely with the existing badge UI.
NOTE_PROPERTY_KEYWORDS: List[Tuple[str, str]] = [
    ("heat engager",  "HE"),
    ("heat smash",    "HS"),
    ("heat burst",    "HB"),
    ("heat dash",     "HD"),
    ("power crush",   "PC"),
    ("lethal hit",    "LH"),
    ("homing",        "HM"),
    ("balcony break", "BB"),
    ("wall break",    "WB"),
    ("floor break",   "FB"),
    ("wall blast",    "WBL"),
    ("tornado",       "TC"),
    ("spike",         "SP"),
]

# All property tags we ever emit, plus the outcome-tag tags that get attached
# to per-channel outcomes (LNC / KND / LH). Seeded into Game.json so authors
# can edit names / className without code changes.
PROPERTY_TAG_DEFAULTS: Dict[str, Dict[str, str]] = {
    "HE":  {"name": "Heat Engager",  "description": "On hit/block, transitions character into Heat.",
            "className": "bg-orange-500 text-zinc-900 border-white"},
    "HS":  {"name": "Heat Smash",    "description": "Spends Heat for a powerful super attack.",
            "className": "bg-red-600 text-white border-white"},
    "HB":  {"name": "Heat Burst",    "description": "Activates Heat from neutral.",
            "className": "bg-orange-600 text-white border-white"},
    "HD":  {"name": "Heat Dash",     "description": "Cancels into a forward dash, spending Heat.",
            "className": "bg-amber-500 text-zinc-900 border-white"},
    "PC":  {"name": "Power Crush",   "description": "Absorbs mid/high attacks during execution.",
            "className": "bg-blue-500 text-white border-white"},
    "LH":  {"name": "Lethal Hit",    "description": "Conditional hit triggers an enhanced reaction.",
            "className": "bg-rose-500 text-white border-white"},
    "HM":  {"name": "Homing",        "description": "Tracks sidestep movement.",
            "className": "bg-emerald-500 text-zinc-900 border-white"},
    "BB":  {"name": "Balcony Break", "description": "Breaks balcony stages on hit.",
            "className": "bg-green-500 text-zinc-900 border-white"},
    "WB":  {"name": "Wall Break",    "description": "Breaks wall stages on hit.",
            "className": "bg-green-600 text-white border-white"},
    "FB":  {"name": "Floor Break",   "description": "Breaks floor stages on hit.",
            "className": "bg-green-700 text-white border-white"},
    "WBL": {"name": "Wall Blast",    "description": "Slams opponent into the wall.",
            "className": "bg-lime-600 text-zinc-900 border-white"},
    "TC":  {"name": "Tornado",       "description": "Tornado spin state extends combos.",
            "className": "bg-violet-500 text-white border-white"},
    "SP":  {"name": "Spike",         "description": "Bounces airborne opponent off the ground.",
            "className": "bg-yellow-500 text-zinc-900 border-white"},
    "TH":  {"name": "Throw",         "description": "Grab attack — break with the matching button(s).",
            "className": "bg-fuchsia-400 text-zinc-900 border-white"},
    "UB":  {"name": "Unblockable",   "description": "Cannot be blocked.",
            "className": "bg-red-500 text-zinc-900 border-white"},
    # Outcome tags (also surfaced as move-wide properties when applicable).
    "LNC": {"name": "Launcher",      "description": "Launches the opponent into a juggle state.",
            "className": "bg-rose-700 text-white border-transparent"},
    "KND": {"name": "Knockdown",     "description": "Knocks the opponent down.",
            "className": "bg-indigo-700 text-white border-transparent"},
}

HIT_LEVEL_DEFAULTS: Dict[str, Dict[str, str]] = {
    "h":  {"name": "High",         "description": "Hits standing opponents; whiffs against crouch.",
           "className": "bg-pink-500"},
    "m":  {"name": "Mid",          "description": "Must be blocked standing; hits standing and crouching.",
           "className": "bg-yellow-500"},
    "l":  {"name": "Low",          "description": "Must be blocked low.",
           "className": "bg-cyan-500"},
    "sm": {"name": "Special Mid",  "description": "Blockable standing or crouching.",
           "className": "bg-purple-500"},
    "sl": {"name": "Special Low",  "description": "Blockable standing or crouching.",
           "className": "bg-cyan-400"},
    "t":  {"name": "Throw",        "description": "Grab attempt; break with matching buttons.",
           "className": "bg-fuchsia-400"},
    "!":  {"name": "Unblockable",  "description": "Cannot be blocked.",
           "className": "bg-red-500"},
}


def project_root() -> Path:
    """Repo root — two levels up from this script (`FrameDataFactory/Tekken8/`)."""
    return Path(__file__).resolve().parent.parent.parent


# ---------------------------------------------------------------------------
# Anubis bypass + Cargo client
# ---------------------------------------------------------------------------

def make_session() -> requests.Session:
    s = requests.Session()
    s.headers["User-Agent"] = USER_AGENT
    return s


def solve_anubis(session: requests.Session, probe_path: str = "/t/Main_Page") -> bool:
    """Run any Anubis "preact" challenge waiting on this session.

    Validation server-side is `result == sha256(challenge.randomData)` after
    `80ms × difficulty` — see TecharoHQ/anubis lib/challenge/preact/preact.go.
    """
    r = session.get(f"{WAVU_BASE}{probe_path}")
    if "anubis_challenge" not in r.text:
        return False

    m = re.search(
        r'<script id="anubis_challenge" type="application/json">(.*?)</script>',
        r.text, re.DOTALL,
    )
    if not m:
        raise RuntimeError("Anubis challenge HTML present but JSON block not found")

    ch = json.loads(m.group(1))
    data = ch["challenge"]["randomData"]
    chid = ch["challenge"]["id"]
    difficulty = ch["rules"]["difficulty"]

    result = hashlib.sha256(data.encode()).hexdigest()
    time.sleep(0.08 * difficulty + 0.05)

    r2 = session.get(
        f"{WAVU_BASE}/.within.website/x/cmd/anubis/api/pass-challenge",
        params={"id": chid, "redir": probe_path, "result": result},
        allow_redirects=False,
    )
    if "techaro.lol-anubis-auth-auth" not in session.cookies.get_dict():
        raise RuntimeError(f"Anubis pass-challenge failed (status={r2.status_code})")
    return True


def cargoquery(session: requests.Session, where: Optional[str] = None,
               limit: int = 500, offset: int = 0) -> List[Dict[str, Any]]:
    """One page of `Move` rows. Cargo wraps each row in `{"title": {...}}`.

    `_pageName` works in SELECT/GROUP BY but not WHERE on this install, so
    callers that need to scope by page filter client-side.
    """
    params = {
        "action": "cargoquery",
        "tables": "Move",
        "fields": ",".join(CARGO_FIELDS),
        "order_by": "id",
        "limit": str(limit),
        "offset": str(offset),
        "format": "json",
    }
    if where:
        params["where"] = where
    r = session.get(WAVU_API, params=params, timeout=30)
    r.raise_for_status()
    payload = r.json()
    if "error" in payload:
        raise RuntimeError(f"Cargo error: {payload['error']}")
    return [row["title"] for row in payload.get("cargoquery", [])]


def fetch_all_moves(session: requests.Session) -> List[Dict[str, Any]]:
    """Stream every Move row, then keep only per-character `<Name> movelist`
    pages. Generic pages (`Generic movelist`, `Heat`) are dropped — those rows
    don't belong to a specific character."""
    rows: List[Dict[str, Any]] = []
    offset = 0
    page_size = 500
    while True:
        page = cargoquery(session, limit=page_size, offset=offset)
        if not page:
            break
        rows.extend(page)
        print(f"  fetched {len(rows)} rows (offset {offset})")
        if len(page) < page_size:
            break
        offset += page_size
        time.sleep(0.3)

    movelist_rows = [
        r for r in rows
        if (r.get("page") or "").endswith(" movelist")
        and r.get("page") != "Generic movelist"
    ]
    print(f"  kept {len(movelist_rows)} per-character rows "
          f"(dropped {len(rows) - len(movelist_rows)} generic rows)")
    return movelist_rows


# ---------------------------------------------------------------------------
# Field-level transforms
# ---------------------------------------------------------------------------

_NUM_RE = re.compile(r"[-+]?\d+")
_TAG_RE = re.compile(r"<[^>]+>")
_LINK_RE = re.compile(r"\[\[(?:[^|\]]+\|)?([^\]]+)\]\]")
_TEMPLATE_RE = re.compile(r"\{\{[^}|]+\|([^}]+)\}\}")
_TEMPLATE_BARE_RE = re.compile(r"\{\{([^}|]+)\}\}")
_DOTLIST_PLAINLIST = re.compile(
    r'<div\s+class="plainlist">(.*?)</div>\s*$', re.DOTALL | re.IGNORECASE,
)
_MOVEDATA_ICON = re.compile(
    r'<div[^>]*class="[^"]*movedata-icon[^"]*"[^>]*>([^<]*)</div>',
    re.IGNORECASE,
)


def first_int(value: Optional[str]) -> Optional[int]:
    if not value:
        return None
    m = _NUM_RE.search(value)
    return int(m.group(0)) if m else None


_PLAIN_DAMAGE_RE = re.compile(r"\d+(?:\s*,\s*\d+)*")


def sum_damage(value: Optional[str]) -> Optional[int]:
    """Return a total only when every damage value is unambiguous.

    Wavu uses brackets, parentheses, slashes, semicolons, and trailing plus
    signs for conditional, scaled, recoverable, or alternate damage values.
    Adding every digit in those strings invents totals (for example
    ``22,37 (25)`` became 84). Preserve those expressions as raw damage and
    let the UI display them verbatim instead.
    """
    if not value:
        return 0
    normalized = value.strip()
    if not _PLAIN_DAMAGE_RE.fullmatch(normalized):
        return None
    return sum(int(part.strip()) for part in normalized.split(","))


def clean_notes(raw: Optional[str]) -> str:
    """Cargo returns notes as HTML-encoded wikitext. Decode entities, lift
    movedata-icon labels (Heat Engager / Balcony Break / Spike / …) to plain
    words, drop remaining HTML, and join bullet lines with `; `.
    """
    if not raw:
        return ""

    text = html.unescape(raw).replace("​", "")
    text = _MOVEDATA_ICON.sub(lambda m: m.group(1).strip(), text)
    m = _DOTLIST_PLAINLIST.search(text)
    if m:
        text = m.group(1)
    text = _TEMPLATE_RE.sub(r"\1", text)
    text = _TEMPLATE_BARE_RE.sub(r"\1", text)
    text = _LINK_RE.sub(r"\1", text)
    text = re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = _TAG_RE.sub("", text)

    parts: List[str] = []
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("*"):
            line = line[1:].strip()
        if line:
            parts.append(line)
    return "; ".join(parts)


def character_from_page(page: Optional[str]) -> str:
    if not page:
        return ""
    return page.removesuffix(" movelist").strip()


def walk_parent_chain(row: Dict[str, Any], by_id: Dict[str, Dict[str, Any]],
                      field: str) -> str:
    """Concatenate a comma-delta field up the parent chain. Wavu stores
    per-segment values for hit-level / startup / damage as leading-comma
    strings on child moves: parent target=`h`, child target=`,m`
    → full string `h,m`.
    """
    parts: List[str] = []
    cur: Optional[Dict[str, Any]] = row
    seen = set()
    while cur is not None and cur["id"] not in seen:
        seen.add(cur["id"])
        parts.append(cur.get(field) or "")
        parent_id = cur.get("parent")
        cur = by_id.get(parent_id) if parent_id else None
    ordered_parts = [str(part).strip() for part in reversed(parts) if part]
    if field in {"target", "damage", "startup"}:
        # Wavu's child rows are inconsistent here: some per-hit deltas include
        # a leading comma while others (for example Jack-8's SIT damage) omit
        # it. Every non-empty fragment represents another hit, so join these
        # fields with exactly one comma instead of producing merged values
        # such as damage `10101010`, hit level `mm`, or startup `i1215`.
        return ",".join(part.strip(",") for part in ordered_parts)
    return "".join(ordered_parts).lstrip(",").strip()


# ---------------------------------------------------------------------------
# Outcome parsing — Tekken edition
# ---------------------------------------------------------------------------
#
# Tekken 8 hit / block / counter-hit cells use a compact suffix grammar:
#
#   "+8"          neutral plus-frames
#   "-3"          minus-frames on block
#   "+15a"        +15, opponent airborne (juggle continues)
#   "+12d"        +12, opponent knocked down
#   "+31a (+21)"  +31 if connects airborne, +21 alternate
#   "+0c"         +0, recovers crouching
#   "-9c~-11c"    range of frame advantage on crouch recovery
#
# We split into a structured `{advantage, tags, raw}`:
#   * advantage = the leading signed integer (or null when only ranges /
#     non-numeric content is present)
#   * tags      = LNC for `a` suffix, KND for `d` suffix
#   * raw       = the original string verbatim
#
# Suffix letters c/g (crouch / grounded recovery) describe RECOVERY, not
# the hit reaction, so they don't contribute tags.

_OUTCOME_VALUE_RE = re.compile(r"([+-]?\d+)\s*([a-zA-Z]*)")


def parse_outcome(raw: Optional[str]) -> Dict[str, Any]:
    """Parse a Tekken hit/block/CH cell into `{advantage, tags, raw}`."""
    if raw is None:
        return {"advantage": None, "tags": [], "raw": None}
    s = str(raw).strip()
    if not s:
        return {"advantage": None, "tags": [], "raw": None}

    # Strip `[[Page#section|display]]` link markup that some authors write
    # into the frame-advantage cells when linking to combo guides; keep the
    # display text only.
    s = _LINK_RE.sub(r"\1", s)
    s = html.unescape(s).strip()

    advantage = None
    tags: List[str] = []

    # Take only the first number+suffix pair — the parenthetical
    # alternative ("+12 (+3)") is not the canonical advantage.
    m = _OUTCOME_VALUE_RE.search(s)
    if m:
        try:
            advantage = int(m.group(1))
        except (TypeError, ValueError):
            advantage = None
        suffix = m.group(2).lower()
        if "a" in suffix and "LNC" not in tags:
            tags.append("LNC")
        if "d" in suffix and "KND" not in tags:
            tags.append("KND")

    return {"advantage": advantage, "tags": tags, "raw": s}


# ---------------------------------------------------------------------------
# Universal notation transform — Tekken-native → portable ABCD/numpad form
# ---------------------------------------------------------------------------
#
# The React app's data layer stores commands in a *universal* form so the
# renderer can switch notation styles (Tekken FBUD, numpad, Soulcalibur
# ABKG, …) on the fly per `src/lib/notation.ts`. Wavu authors moves in
# Tekken-native style, so we translate during import.
#
# Mapping (applied per token after splitting on `,` and `+`):
#
#   Buttons        1 2 3 4              → A B C D
#   Tap dir        n u d f b            → 5 8 2 6 4
#                  uf ub df db          → 9 7 3 1
#                  UB                   → 7   (uppercase up-back used
#                                              in `b,b,UB` wall break
#                                              and `UB,b…` move starts;
#                                              wavu has no held-diagonal
#                                              convention so this is a
#                                              tap, not a held input.)
#   Held dir       U D F B              → (8) (2) (6) (4)
#                  UF DF DB             → (9) (3) (1)
#   Held suffix    X*                   → (X)        e.g. `2*` → `(B)`
#   Held compound  X*Y                  → (X)+Y      e.g. `df*2` → `(3)+B`
#   Motion shrth   QCF/qcf, QCB, …      → kept atomic, lowercased; the
#                                         renderer expands per-style.
#
# Stance prefixes (`WS.`, `H.WS.`, `BKP.`, `(Back to wall).`,
# `CLK(Two spins).`, …) and free-text descriptors (`P`, `Back throw`)
# are preserved verbatim.
#
# NOT idempotent: Tekken `1` (button) maps to universal `A`, but
# universal `1` is a numpad direction (down-back). Re-running this on
# already-converted data would mistakenly re-translate numpad digits as
# Tekken buttons. Run exactly once per source string.

_BUTTON_MAP: Dict[str, str] = {"1": "A", "2": "B", "3": "C", "4": "D"}

_TAP_DIR_MAP: Dict[str, str] = {
    "n": "5",
    "u": "8", "d": "2", "f": "6", "b": "4",
    "uf": "9", "ub": "7", "df": "3", "db": "1",
    # `UB` (uppercase) is treated as a tap up-back, not a held diagonal:
    # it shows up in the wall-break input `(Back to wall).b,b,UB` and at
    # the head of moves like `UB,b` / `UB,b,3+4`, all of which are tap
    # directional inputs in practice. Held diagonals aren't a wavu
    # authoring convention.
    "UB": "7",
}

_HELD_DIR_MAP: Dict[str, str] = {
    "U": "(8)", "D": "(2)", "F": "(6)", "B": "(4)",
    "UF": "(9)", "DF": "(3)", "DB": "(1)",
}

_MOTION_SHORTHAND: frozenset = frozenset({"qcf", "qcb", "hcf", "hcb", "dp"})

# Prefix patterns peeled off the front of a token before atom conversion.
# All three end in a literal `.` so what remains is the actual input atom.
_PAREN_PREFIX_RE = re.compile(r"^(\([^)]*\))\.")           # `(Back to wall).`
_STANCE_PAREN_RE = re.compile(r"^([A-Z][A-Za-z0-9]*\([^)]*\))\.")  # `CLK(Two spins).`
_STANCE_PREFIX_RE = re.compile(
    r"^([A-Z][A-Za-z0-9]*(?:\.[A-Z][A-Za-z0-9]*)*)\."
)


def _convert_atom(atom: str) -> str:
    """Translate a single bare atom (no prefix, no `*`) to universal form.
    Unknown atoms pass through unchanged so free-text descriptors survive."""
    if atom in _BUTTON_MAP:
        return _BUTTON_MAP[atom]
    if atom in _TAP_DIR_MAP:
        return _TAP_DIR_MAP[atom]
    if atom in _HELD_DIR_MAP:
        return _HELD_DIR_MAP[atom]
    if atom.lower() in _MOTION_SHORTHAND:
        return atom.lower()
    return atom


def _strip_prefixes(tok: str) -> Tuple[str, str]:
    """Peel any chain of meta / stance prefixes off the front of `tok`.
    Returns `(prefix_string, remainder)` — the prefix is reattached
    verbatim after the atom is converted, so `WS.4` survives as `WS.D`."""
    prefix = ""
    while True:
        for pat in (_PAREN_PREFIX_RE, _STANCE_PAREN_RE, _STANCE_PREFIX_RE):
            m = pat.match(tok)
            if m:
                prefix += m.group(0)
                tok = tok[m.end():]
                break
        else:
            return prefix, tok


def _convert_part(part: str) -> List[str]:
    """Convert one `+`-separated chunk; returns a list because an infix
    `*` (held direction + simultaneous button, e.g. `df*2`) splits into
    two sibling tokens at the same step level."""
    body = part.rstrip("*")
    suffix_stars = len(part) - len(body)

    if "*" in body:
        # Infix `*`: held-direction compound. Split on the FIRST `*`
        # and recurse on the tail so chained infixes (theoretical
        # `a*b*c`) keep working.
        left, right = body.split("*", 1)
        prefix_l, atom_l = _strip_prefixes(left)
        converted_left = _convert_atom(atom_l)
        # Don't double-wrap: a held-cardinal atom (`DF` → `(3)`) is
        # already paren-decorated, so the `*` only adds the marker once.
        if not (converted_left.startswith("(") and converted_left.endswith(")")):
            converted_left = f"({converted_left})"
        held_left = prefix_l + converted_left
        # Suffix stars from the original token belong on the rightmost
        # component; carry them along during recursion.
        right_with_stars = right + ("*" * suffix_stars)
        return [held_left] + _convert_part(right_with_stars)

    # No infix `*` — pure suffix or no `*` at all.
    prefix, atom = _strip_prefixes(body)
    converted = _convert_atom(atom)
    if suffix_stars >= 1:
        # Held-cardinal atoms (`D` → `(2)`) come back already paren-
        # wrapped, so an extra `*` would double-wrap to `((2))`. Skip
        # the wrap in that case but still preserve any extra stars
        # beyond the first (rare `**` authoring).
        already_held = converted.startswith("(") and converted.endswith(")")
        if not already_held:
            converted = f"({converted})"
        if suffix_stars > 1:
            converted += "*" * (suffix_stars - 1)
    return [prefix + converted]


# Sequential separators (`:`, `~`) and alternative separators (`_`, `/`)
# used inside Wavu command strings. We preserve them through universal
# conversion; parse_command then maps them onto the schema's step and
# alternative layers.
_STEP_SEP_RE = re.compile(r"([,:~_/<])")


def convert_to_universal(raw_command: str) -> str:
    """Translate a Tekken-native input string into universal notation.

    Splits the input on `,`, `:`, `~`, `_`, `/`, and `<` while keeping separators
    in place; each between-separator chunk is then split on `+` for
    simultaneous parts and atom-converted independently. Stance
    prefixes, parenthetical context tags, and unrecognised text
    descriptors are preserved verbatim — the converter only touches
    atoms it recognises as buttons, directions, or motion shorthand.
    """
    if not raw_command:
        return raw_command

    out: List[str] = []
    for chunk in _STEP_SEP_RE.split(raw_command):
        if chunk in (",", ":", "~", "_", "/", "<") or not chunk.strip():
            out.append(chunk)
            continue
        converted_parts: List[str] = []
        for plus_part in chunk.split("+"):
            plus_part = plus_part.strip()
            if plus_part:
                converted_parts.extend(_convert_part(plus_part))
        out.append("+".join(converted_parts))
    return "".join(out)


# ---------------------------------------------------------------------------
# Command parsing — universal-notation edition
# ---------------------------------------------------------------------------
#
# After `convert_to_universal` runs, the input string is in universal form:
# buttons `A B C D`, numpad-digit directions `1..9`, held inputs wrapped
# in parens (`(6)`, `(B)`), motion shorthand atomic and lowercased
# (`qcf`, `dp`). Steps are still comma-separated; within a step `+`
# joins simultaneously-pressed tokens. Stance prefixes (`WS.`, `H.WS.`,
# `BKP.`, `(Back to wall).`) are extracted into the per-move `Stance`
# array; full-line stance descriptors (`Back throw`, `Left throw`, …)
# are lifted whole into Stance with no button command following.
#
# Output shape matches the rest of the codebase: three-level
# `steps -> alternatives -> buttons`. Tekken authoring rarely uses OR
# alternatives in the same string, so most steps have exactly one
# alternative.

# `(Back to wall).b,b,UB` — the parenthetical is the stance label, not
# a button atom. The capture group strips the brackets so it lands in
# the Stance column as just "Back to wall".
_PAREN_META_PREFIX_RE = re.compile(r"^\(([^)]+)\)\.")

# Conditions are independent from the stance that follows them. In inputs
# such as `CH.WS.2,2`, CH is the counter-hit requirement and WS is the
# while-standing stance; the general stance regex would otherwise greedily
# combine them into a single `CH.WS` code.
_CONDITION_PREFIX_RE = re.compile(r"^(CH)\.")

# Wavu authors throw notation as a free-text label rather than an
# input. Same canonical labels appear in several syntactic positions:
#
#   `Back throw`            (whole input)
#   `(Back Throw)`          (bare-paren wrapping)
#   `Back Throw 1+3`        (prefix + space-separated input)
#   `Back Throw.1+3`        (prefix + dot-separated input)
#
# We normalise case so author-edited names in Game.json map cleanly to
# one code regardless of which casing the move row uses.
_CANONICAL_MULTIWORD_STANCES = (
    "Back throw",
    "Left throw",
    "Right throw",
    "2 steps or more",
    "Left Side Throw",
    "Right Side Throw",
)
_MULTIWORD_LOOKUP: Dict[str, str] = {
    s.lower(): s for s in _CANONICAL_MULTIWORD_STANCES
}
_MULTIWORD_ALT_RE = "|".join(re.escape(s) for s in _CANONICAL_MULTIWORD_STANCES)
_MULTIWORD_FULL_RE = re.compile(rf"^({_MULTIWORD_ALT_RE})$", re.IGNORECASE)
_MULTIWORD_WRAPPED_RE = re.compile(rf"^\(({_MULTIWORD_ALT_RE})\)$", re.IGNORECASE)
_MULTIWORD_WRAPPED_PREFIX_RE = re.compile(
    rf"^\(({_MULTIWORD_ALT_RE})\)[\s.]+",
    re.IGNORECASE,
)
_MULTIWORD_PREFIX_RE = re.compile(
    rf"^({_MULTIWORD_ALT_RE})[\s.]+",
    re.IGNORECASE,
)


def _canonicalize_multiword_stance(label: str) -> Optional[str]:
    """Return the canonical form of a multi-word stance label, or None."""
    return _MULTIWORD_LOOKUP.get(label.lower())

# Case normalisation for parenthetical context labels. Anything not in
# this map is kept verbatim — the author can curate it in Game.json
# afterwards.
_PAREN_PREFIX_NORMALIZE: Dict[str, str] = {
    "back to wall": "Back to wall",
}


_HELD_TOKEN_RE = re.compile(r"^\(([^()]+)\)\**$")


def _to_button_obj(token: str) -> Optional[Dict[str, object]]:
    """Wrap a single button token in the canonical object form:

        ``"A"``       -> ``{"b": "A"}``
        ``"(6)"``     -> ``{"b": "6", "h": True}``
        ``"(B)*"``    -> ``{"b": "B", "h": True}``  (rare `**` data)

    Empty / non-string input returns ``None``. Held is the only flag the
    on-disk schema currently knows about; further leaf-level metadata
    can attach as additional optional keys without breaking older readers.
    """
    if not isinstance(token, str):
        return None
    token = token.strip()
    if not token:
        return None
    m = _HELD_TOKEN_RE.match(token)
    if m:
        inner = m.group(1).strip()
        if inner:
            return {"b": inner, "h": True}
    return {"b": token}


def parse_command(raw_command: str) -> Tuple[List[List[List[Dict[str, object]]]], List[str]]:
    """Convert a (universal-notation) command string into the canonical
    3-level list ``steps -> alternatives -> button objects`` plus a list
    of stance codes lifted from leading prefixes. Each leaf is a button
    object — ``{"b": "A"}`` for a plain press, ``{"b": "6", "h": True}``
    for a held input — instead of a parens-decorated string.
    """
    if not raw_command:
        return [], []

    text = raw_command.strip()

    # Full-line stance descriptors — entire input *is* the stance, no
    # button command follows. Handles `Back throw`, `Back Throw`, and
    # the parenthesised variant `(Back Throw)`.
    m = _MULTIWORD_FULL_RE.match(text) or _MULTIWORD_WRAPPED_RE.match(text)
    if m:
        return [], [_canonicalize_multiword_stance(m.group(1)) or m.group(1)]

    stances: List[str] = []

    def _peel_prefixes(s: str) -> str:
        """Strip up to 3 chained paren-meta / stance prefixes off the front
        of `s`, appending each to the outer ``stances`` list. Used both on
        the full input and on each comma-separated step so a stance prefix
        sitting on a non-leading step (e.g. the `H.2` in `1,2,1,H.2`) gets
        lifted into the move-wide Stance column instead of leaking into the
        step's button as a literal `H.B` token."""
        for _ in range(3):
            m = _PAREN_META_PREFIX_RE.match(s)
            if m:
                label = m.group(1)
                stances.append(_PAREN_PREFIX_NORMALIZE.get(label.lower(), label))
                s = s[m.end():]
                continue
            m = _CONDITION_PREFIX_RE.match(s)
            if m:
                stances.append(m.group(1))
                s = s[m.end():]
                continue
            m = _STANCE_PREFIX_RE.match(s)
            if m:
                # Every dot-delimited prefix is an independent requirement.
                # `NSS.BT.d+1` means No Sword Stance + Back Turned, just as
                # `H.DGF.1` means Heat + Dragonfly and `SSH.CH.1` means
                # Silent Step + Counter Hit. Keeping these atomic lets the UI
                # filter each stance independently and reuse shared metadata.
                stances.extend(m.group(1).split("."))
                s = s[m.end():]
                continue
            break
        return s

    text = _peel_prefixes(text)

    if not text:
        return [], stances

    steps: List[List[List[Dict[str, object]]]] = []
    for raw_step in re.split(r"[,:~<]", text):
        alternatives: List[List[Dict[str, object]]] = []
        for raw_alternative in re.split(r"[_/]", raw_step):
            alternative = _peel_prefixes(raw_alternative.strip())
            if not alternative:
                continue
            buttons = [
                obj
                for obj in (_to_button_obj(b) for b in alternative.split("+"))
                if obj is not None
            ]
            if buttons:
                alternatives.append(buttons)

        if alternatives:
            # Wavu abbreviates alternatives by writing a shared leading
            # direction only once: `b+3_4` means `b+3` OR `b+4`. Repeat that
            # direction for alternatives that start directly with a button.
            shared_directions: List[Dict[str, object]] = []
            for button in alternatives[0]:
                token = str(button.get("b", ""))
                if token in _MOTION_SHORTHAND or (
                    len(token) == 1 and token in "123456789"
                ):
                    shared_directions.append(button)
                else:
                    break
            if shared_directions:
                for index in range(1, len(alternatives)):
                    first = str(alternatives[index][0].get("b", ""))
                    starts_with_direction = first in _MOTION_SHORTHAND or (
                        len(first) == 1 and first in "123456789"
                    )
                    if not starts_with_direction:
                        alternatives[index] = [
                            *[dict(button) for button in shared_directions],
                            *alternatives[index],
                        ]
            steps.append(alternatives)

    # Dedup while preserving first-seen order — `H.1,H.2` should yield
    # `["H"]`, not `["H", "H"]`.
    seen: set = set()
    unique_stances = [s for s in stances if not (s in seen or seen.add(s))]

    return steps, unique_stances


# Pre-parse normalisation: rewrites wavu authoring shortcuts into the
# canonical forms `parse_command` recognises. Operates on a *copy* of
# the raw input — `stringCommand` keeps the original wavu authoring,
# only the structured `Command` / `Stance` arrays see the rewrite.
_STANCE_VARIANT_TRANSLATIONS: Dict[str, str] = {
    # Alisa's `CLK(Two spins).3` → canonical `CLK2.3` so the stance
    # column gets a clean code; the per-character stance dict carries
    # the human-friendly "Clockwork two spins" description.
    "CLK(Two spins)": "CLK2",
    # Steve's free-text `after_2steps+1` is a condition plus a button,
    # not an underscore-separated alternative.
    "after_2steps": "(After 2 steps).",
}

_WS_DOTTED_RE = re.compile(r"\bws\.")
_WS_BARE_RE = re.compile(r"\bws(?=[0-9])")
_SS_DOTTED_RE = re.compile(r"\bss\.")
_SS_BARE_RE = re.compile(r"\bss(?=[0-9])")
_WR_DOTTED_RE = re.compile(r"\bwr\.")
_WR_BARE_RE = re.compile(r"\bwr(?=[0-9])")
# Wavu's heat-prefix shorthand: `hFC.` (`hWS.`, `hSS.`, …) means
# `H.<STANCE>.` — heat enabling a stance move. The leading `h` is
# always lowercase; the rest is uppercase. Anchor on uppercase to avoid
# matching arbitrary lowercase words like `host.` or `hint.`.
_LOWERCASE_HEAT_RE = re.compile(r"\bh([A-Z][A-Z0-9]*)\.")
_CH_SPACE_PREFIX_RE = re.compile(r"^CH\s+(?=\S)")
_COUNTER_HIT_SUFFIX_RE = re.compile(r"\s*\(counterhit\)\s*$", re.IGNORECASE)
_WALL_STUN_SUFFIX_RE = re.compile(r"\s*\(wall stun\)\s*$", re.IGNORECASE)


def _normalize_input_string(s: str) -> str:
    """Rewrite wavu shorthand into canonical authoring forms.

    Currently:
      * ``ws1`` / ``ws.1`` → ``WS.1`` (lowercase shorthand → canonical).
      * ``ss2`` / ``ss.2`` → ``SS.2`` (sidestep shorthand).
      * ``wr4`` / ``wr.4`` → ``WR.4`` (while-running shorthand).
      * ``hFC.1``           → ``H.FC.1`` (heat-prefix shorthand; same
        substitution covers any ``h<UPPER>.`` form).
      * ``CH b+1``          → ``CH.b+1`` (counter-hit condition prefix).
      * ``CLK(Two spins).`` → ``CLK2.`` (and any future `<code>(detail)`
        translations registered in ``_STANCE_VARIANT_TRANSLATIONS``).
    """
    if not s:
        return s
    s = s.replace("...", "")
    s = _CH_SPACE_PREFIX_RE.sub("CH.", s)
    s = re.sub(r"^BT\+", "BT.", s)
    s = re.sub(r"^UT,", "UT.", s)
    s = re.sub(r"^While in the air\s+", "(While in the air).", s)
    s = re.sub(r"^While landing\s+", "(While landing).", s)
    for src, dst in _STANCE_VARIANT_TRANSLATIONS.items():
        s = s.replace(src, dst)
    s = _LOWERCASE_HEAT_RE.sub(r"H.\1.", s)
    s = _WS_DOTTED_RE.sub("WS.", s)
    s = _WS_BARE_RE.sub("WS.", s)
    s = _SS_DOTTED_RE.sub("SS.", s)
    s = _SS_BARE_RE.sub("SS.", s)
    s = _WR_DOTTED_RE.sub("WR.", s)
    s = _WR_BARE_RE.sub("WR.", s)
    return s


_COMMAND_BRANCH_RE = re.compile(r"/\s+")


def parse_input_command(
    raw_command: str,
) -> Tuple[List[List[List[Dict[str, object]]]], List[str]]:
    """Parse a complete Wavu input, including alternate command branches."""
    parse_input = _normalize_input_string(raw_command).strip()

    extra_stances: List[str] = []
    full_parenthetical = re.fullmatch(r"\(([^)]+)\)", parse_input)
    if full_parenthetical:
        label = full_parenthetical.group(1).strip()
        return [], [_canonicalize_multiword_stance(label) or label]

    if _COUNTER_HIT_SUFFIX_RE.search(parse_input):
        parse_input = _COUNTER_HIT_SUFFIX_RE.sub("", parse_input)
        extra_stances.append("CH")
    if _WALL_STUN_SUFFIX_RE.search(parse_input):
        parse_input = _WALL_STUN_SUFFIX_RE.sub("", parse_input)
        extra_stances.append("Wall stun")

    # Parenthetical conditions can contain commas, so lift them before the
    # command is split into sequential steps.
    paren_match = re.match(r"^\(([^)]+)\)(?:\.|\s+)", parse_input)
    if paren_match:
        label = paren_match.group(1).strip()
        extra_stances.append(
            _canonicalize_multiword_stance(label)
            or _PAREN_PREFIX_NORMALIZE.get(label.lower(), label)
        )
        parse_input = parse_input[paren_match.end():]
    else:
        multi_match = _MULTIWORD_PREFIX_RE.match(parse_input)
        if multi_match:
            canonical = _canonicalize_multiword_stance(multi_match.group(1))
            if canonical:
                extra_stances.append(canonical)
                parse_input = parse_input[multi_match.end():]

    parsed_branches = [
        parse_command(convert_to_universal(branch.strip()))
        for branch in _COMMAND_BRANCH_RE.split(parse_input)
        if branch.strip()
    ]
    if not parsed_branches:
        return [], extra_stances

    branch_commands = [command for command, _ in parsed_branches]
    merged_steps: List[List[List[Dict[str, object]]]] = []
    for index in range(max((len(command) for command in branch_commands), default=0)):
        alternatives: List[List[Dict[str, object]]] = []
        for command in branch_commands:
            if index >= len(command):
                continue
            for alternative in command[index]:
                if alternative not in alternatives:
                    alternatives.append(alternative)
        if alternatives:
            merged_steps.append(alternatives)

    stances = extra_stances + [
        stance for _, branch_stances in parsed_branches for stance in branch_stances
    ]
    seen: set = set()
    unique_stances = [
        stance for stance in stances if not (stance in seen or seen.add(stance))
    ]
    return merged_steps, unique_stances


# ---------------------------------------------------------------------------
# Move record assembly
# ---------------------------------------------------------------------------

def derive_properties(notes_lower: str, hit_level_lower: str,
                      command_lower: str) -> List[str]:
    """Move-wide property tags. Uses the cleaned notes string, the chained
    hit-level vocabulary, and the raw command (to detect throws via `+1+2`,
    `+1+3`, `+2+4` patterns)."""
    props: List[str] = []
    for keyword, tag in NOTE_PROPERTY_KEYWORDS:
        if keyword in notes_lower and tag not in props:
            props.append(tag)

    levels = {x.strip() for x in hit_level_lower.split(",") if x.strip()}
    if "t" in levels and "TH" not in props:
        props.append("TH")
    if "!" in hit_level_lower and "UB" not in props:
        props.append("UB")
    return props


def row_to_move(row: Dict[str, Any], by_id: Dict[str, Dict[str, Any]],
                move_id: int) -> Dict[str, Any]:
    """Project one cargo row onto the per-character JSON move shape.

    The returned dict is JSON-ready — no NaN, no pandas types, only
    primitives and nested lists / dicts.
    """
    char_name = character_from_page(row.get("page"))

    # Command = the input chain assembled by walking parent rows. We
    # deliberately don't reverse-engineer it from the `id` field — that
    # column carries unexpanded Cargo template syntax (`${justFrame}`,
    # etc.) that the `input` field encodes more cleanly.
    raw_command = walk_parent_chain(row, by_id, "input")

    # Wavu round-trips some templates as double-escaped HTML entities
    # (`&amp;#58;` → `:`), so unescape twice to fully resolve them
    # before any token-level substitution. Doing this AFTER `#`→`*`
    # would leave `*58;` artefacts inside the inputs.
    raw_command = html.unescape(html.unescape(raw_command))

    # `#` in the {{justFrame}} template emits the literal hash; the
    # community uses `*` for the held / just-frame marker so normalise.
    # Also drop zero-width spaces wavu sprinkles into long inputs as
    # line-wrap hints — they survive the cargo round-trip and would
    # otherwise show up inside our tokens.
    raw_command = raw_command.replace("#", "*").replace("​", "")

    # `stringCommand` keeps the Tekken-native form authors see on the
    # wiki (`b+1+3`, `f,F+2`, `qcf+2`, …); only the structured
    # `Command` array gets translated into the universal authoring
    # layer (`ABCD`, numpad digits, parens for held). The renderer
    # can switch notation styles via the universal `Command`, while
    # search and copy-paste against `stringCommand` keeps working
    # against what wavu published. `_normalize_input_string` rewrites
    # wavu shorthand (`ws1` → `WS.1`, `CLK(Two spins)` → `CLK2`) on
    # the parse copy so stance extraction sees a canonical form.
    command_steps, stance_list = parse_input_command(raw_command)

    hit_level_str = walk_parent_chain(row, by_id, "target")
    # Wiki authors mix upper- and lowercase (`m,M`); normalise to lower so
    # filters and badge lookups match the HIT_LEVEL_DEFAULTS keys.
    hit_levels = [t.strip().lower() for t in hit_level_str.split(",") if t.strip()]

    raw_startup = walk_parent_chain(row, by_id, "startup") or (row.get("startup") or "")
    impact = first_int(raw_startup.lstrip("i"))

    damage = walk_parent_chain(row, by_id, "damage") or (row.get("damage") or "")

    notes = clean_notes(row.get("notes"))
    properties = derive_properties(
        notes.lower(),
        hit_level_str.lower(),
        raw_command.lower(),
    )

    block = parse_outcome(row.get("block"))
    hit = parse_outcome(row.get("hit"))
    counter_hit = parse_outcome(row.get("ch"))

    # If the move is move-wide LH, echo into hit/CH outcome tags so the
    # per-cell badges light up consistently with the SC6 pipeline.
    if "LH" in properties:
        for outcome in (hit, counter_hit):
            if "LH" not in outcome["tags"]:
                outcome["tags"].append("LH")

    return {
        "ID": move_id,
        "stringCommand": raw_command or None,
        "Command": command_steps if command_steps else None,
        "Stance": stance_list if stance_list else None,
        "Properties": properties if properties else None,
        "HitLevel": hit_levels if hit_levels else None,
        "Impact": impact,
        "Damage": damage or None,
        "DamageDec": sum_damage(damage),
        "Block": block,
        "Hit": hit,
        "CounterHit": counter_hit,
        "GuardBurst": None,
        "Notes": notes or None,
        "_character": char_name,
    }


# ---------------------------------------------------------------------------
# Game.json assembly + Characters/{id}.json export
# ---------------------------------------------------------------------------

def load_existing_game(path: Path) -> Dict[str, Any]:
    """Best-effort: pick up user-edited names/descriptions/className from a
    pre-existing Game.json. Anything we can't recognise is simply ignored —
    the file gets overwritten on every run."""
    if not path.exists():
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"  warn: failed to read existing Game.json: {e}")
        return {}


def merge_descriptors(defaults: Dict[str, Dict[str, str]],
                      existing: Dict[str, Any]) -> Dict[str, Dict[str, str]]:
    """Merge two `{code: {name, description, className?}}` dicts, preferring
    non-empty values from `existing` so author edits survive a re-run."""
    out: Dict[str, Dict[str, str]] = {}
    for code, defaults_entry in defaults.items():
        ex = existing.get(code) if isinstance(existing, dict) else None
        merged = dict(defaults_entry)
        if isinstance(ex, dict):
            for k in ("name", "description", "className"):
                v = ex.get(k)
                if isinstance(v, str) and v.strip():
                    merged[k] = v
        out[code] = merged
    # Preserve any extra codes the author added but we didn't ship defaults for.
    if isinstance(existing, dict):
        for code, ex in existing.items():
            if code in out or not isinstance(ex, dict):
                continue
            out[code] = {
                "name": ex.get("name", "") or "",
                "description": ex.get("description", "") or "",
                "className": ex.get("className", "") or "",
            }
    return out


def build_game_json(records: List[Dict[str, Any]],
                    existing: Dict[str, Any]) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """Build the full Game.json payload + return the characters manifest.

    Per-character stance dicts are populated with the codes that appear
    as move-input prefixes; `name` / `description` are intentionally
    seeded empty for new codes. Authors fill those in by hand in the
    JSON files, and existing values are preserved verbatim across
    re-runs so the manual curation never gets clobbered.
    """
    # Existing per-character entries, keyed by name, so we can preserve ids
    # / images / per-char stance descriptions across runs.
    existing_chars = {c["name"]: c for c in existing.get("characters", [])
                      if isinstance(c, dict) and "name" in c}
    max_id = max((c.get("id", 0) for c in existing_chars.values()), default=0)

    char_names = sorted({rec["_character"] for rec in records if rec["_character"]})
    chars_manifest: List[Dict[str, Any]] = []

    # Per-character stances pulled from the move data.
    per_char_stances: Dict[str, set] = {n: set() for n in char_names}
    for rec in records:
        if rec["Stance"]:
            per_char_stances.setdefault(rec["_character"], set()).update(rec["Stance"])

    # Game-level shared stance keys: anything in SHARED_STANCES is owned
    # by Game.json and stripped from per-character dicts so we don't
    # duplicate names. We use SHARED_STANCES (not the existing JSON's
    # stances dict) as source of truth — the existing dict can drift.
    game_stance_keys = set(SHARED_STANCES.keys())

    for name in char_names:
        existing_char = existing_chars.get(name, {})
        existing_stance_dict = existing_char.get("stances")
        if isinstance(existing_stance_dict, list):
            existing_stance_dict = {s.get("name", ""): s for s in existing_stance_dict
                                    if isinstance(s, dict)}
        existing_stance_dict = existing_stance_dict if isinstance(existing_stance_dict, dict) else {}

        cid = existing_char.get("id")
        if not isinstance(cid, int):
            max_id += 1
            cid = max_id

        stance_dict: Dict[str, Dict[str, str]] = {}
        for stance in sorted(per_char_stances.get(name, set())):
            if stance in game_stance_keys:
                continue
            ex = existing_stance_dict.get(stance, {})
            stance_dict[stance] = {
                "name": ex.get("name", "") or "",
                "description": ex.get("description", "") or "",
            }

        entry: Dict[str, Any] = {"id": cid, "name": name, "stances": stance_dict}
        entry["wikiUrl"] = f"{WAVU_BASE}/t/{quote(name.replace(' ', '_'), safe='_-')}"
        if existing_char.get("image"):
            entry["image"] = existing_char["image"]
        chars_manifest.append(entry)

    chars_manifest.sort(key=lambda c: c["id"])

    properties = merge_descriptors(PROPERTY_TAG_DEFAULTS, existing.get("properties", {}))
    hit_levels = merge_descriptors(HIT_LEVEL_DEFAULTS, existing.get("hitLevels", {}))

    # Game-level shared stances seeded from the SHARED_STANCES table; merged
    # with anything an author already curated.
    shared_defaults = {
        code: {"name": n, "description": d}
        for code, (n, d) in SHARED_STANCES.items()
    }
    existing_stances = existing.get("stances", {})
    if not isinstance(existing_stances, dict):
        existing_stances = {}
    game_stances: Dict[str, Dict[str, str]] = {}
    for code, entry in shared_defaults.items():
        ex = existing_stances.get(code, {}) if isinstance(existing_stances, dict) else {}
        game_stances[code] = {
            "name": ex.get("name") or entry["name"],
            "description": ex.get("description") or entry["description"],
        }
    for code, ex in existing_stances.items():
        if code in game_stances or not isinstance(ex, dict):
            continue
        game_stances[code] = {
            "name": ex.get("name", "") or "",
            "description": ex.get("description", "") or "",
        }

    # Strip stances from each per-character `stances` dict that are also
    # game-level shared (BT/FC/H/etc.) — they live in `Game.stances` and
    # the frontend resolves them from there.
    for char in chars_manifest:
        char["stances"] = {
            k: v for k, v in char.get("stances", {}).items()
            if k not in game_stances
        }

    game_json = {
        "availableColumns": AVAILABLE_COLUMNS,
        "properties": properties,
        "stances": game_stances,
        "hitLevels": hit_levels,
        "characters": chars_manifest,
    }

    # Seed credits + community with Wavu Wiki as the upstream source. We
    # always emit the Wavu line (it's where every byte of this data comes
    # from); any author-added entries in the existing Game.json are merged
    # in alongside, deduped on (role, name, url).
    default_credits: List[Dict[str, str]] = [
        {
            "role": "Frame data source",
            "name": "Wavu Wiki",
            "url": "https://wavu.wiki/t/Main_Page",
        },
    ]
    existing_credits = existing.get("credits")
    if isinstance(existing_credits, list):
        seen = {(c.get("role"), c.get("name"), c.get("url"))
                for c in default_credits}
        for entry in existing_credits:
            if not isinstance(entry, dict):
                continue
            key = (entry.get("role"), entry.get("name"), entry.get("url"))
            if key not in seen:
                default_credits.append(entry)
                seen.add(key)
    game_json["credits"] = default_credits

    default_community: Dict[str, Any] = {
        "wiki": {
            "label": "Wavu Wiki",
            "description": "Upstream Tekken 8 frame data wiki — report errors there",
            "url": "https://wavu.wiki/t/Main_Page",
        },
    }
    existing_community = existing.get("community")
    if isinstance(existing_community, dict):
        # Preserve author-added community entries; only fill in fields the
        # author hasn't already set so manual edits win on conflict.
        for k, v in existing_community.items():
            default_community.setdefault(k, v)
    game_json["community"] = default_community

    if "creditsDescription" in existing:
        game_json["creditsDescription"] = existing["creditsDescription"]
    return game_json, chars_manifest


def write_character_files(records: List[Dict[str, Any]],
                          chars_manifest: List[Dict[str, Any]],
                          characters_dir: Path) -> None:
    """One `<id>.json` per character, an array of move dicts."""
    characters_dir.mkdir(parents=True, exist_ok=True)
    by_name = {c["name"]: c["id"] for c in chars_manifest}

    grouped: Dict[int, List[Dict[str, Any]]] = {c["id"]: [] for c in chars_manifest}
    for rec in records:
        cid = by_name.get(rec["_character"])
        if cid is None:
            continue
        clean = {k: v for k, v in rec.items() if not k.startswith("_")}
        grouped[cid].append(clean)

    for cid, moves in grouped.items():
        # Stable per-character ordering: by Wavu's original ID string (the
        # `stringCommand`) which already follows the wiki's canonical sort.
        moves.sort(key=lambda m: (m.get("stringCommand") or "").lower())
        # Reassign per-character sequential IDs so the in-memory Move.id is
        # unique within a character file (matching SC6 conventions).
        for idx, m in enumerate(moves, start=1):
            m["ID"] = idx
        out_path = characters_dir / f"{cid}.json"
        write_payload_atomic(out_path, build_payload(moves))
    print(f"  wrote {len(grouped)} character files to {characters_dir}")


# ---------------------------------------------------------------------------
# Portrait downloads
# ---------------------------------------------------------------------------

def _portrait_filename(char_name: str) -> str:
    """Wavu's standard portrait convention is `<UrlSafeName>T8.png` —
    spaces become underscores, hyphens stay (`Jack-8T8.png`). A handful of
    characters (e.g. Fahkumram) deviate; `_lookup_portrait_filename` below
    is the fallback for those."""
    safe = char_name.replace(" ", "_")
    return f"{safe}T8.png"


def _lookup_portrait_url(session: requests.Session,
                         char_name: str) -> Optional[str]:
    """Find an actually-uploaded portrait via the `allimages` API.

    The character page can reference filenames that don't exist (typo'd
    template arguments, deleted-and-renamed uploads). `allimages` enumerates
    files that physically exist on disk; we filter by char-name prefix and
    pick the most portrait-looking one. Returns the absolute file URL or
    `None`.
    """
    name_token = char_name.lower().replace(" ", "").replace("_", "")
    try:
        r = session.get(WAVU_API, params={
            "action": "query",
            "list": "allimages",
            "aiprefix": char_name.replace(" ", "_").split("-", 1)[0],
            "ailimit": "50",
            "format": "json",
            "formatversion": "2",
        }, timeout=15)
        r.raise_for_status()
        images = r.json().get("query", {}).get("allimages", [])
    except (requests.RequestException, ValueError):
        return None

    def score(img: Dict[str, Any]) -> int:
        n = img.get("name", "").lower().replace(" ", "").replace("_", "").replace(".", "")
        if name_token not in n:
            return 9
        if "portrait" in n:
            return 0
        if "t8" in n:
            return 1
        return 2

    candidates = sorted(
        (img for img in images
         if img.get("name", "").lower().endswith((".png", ".jpg", ".webp"))
         and "transparent" not in img.get("name", "").lower()
         and name_token in img.get("name", "").lower().replace(" ", "").replace("_", "").replace(".", "")),
        key=score,
    )
    if not candidates:
        return None
    return candidates[0].get("url")


def download_portraits(session: requests.Session,
                       chars_manifest: List[Dict[str, Any]],
                       images_dir: Path,
                       overwrite: bool = False) -> None:
    """Download a portrait per character to `images_dir`, transcoding to
    WebP for parity with the SoulCalibur 6 pipeline (~4× smaller than the
    upstream PNG at quality 85). Tries the canonical `<NameT8>.png` first;
    falls back to the page's image list when that 404s. Updates each
    manifest entry's `image` field to the on-disk webp filename."""
    try:
        from PIL import Image
    except ImportError as e:
        raise RuntimeError(
            "Pillow is required for portrait conversion (pip install pillow)"
        ) from e

    images_dir.mkdir(parents=True, exist_ok=True)

    for entry in chars_manifest:
        name = entry["name"]
        local_name = f"{name}.webp"
        local_path = images_dir / local_name

        if local_path.exists() and not overwrite:
            entry["image"] = local_name
            continue

        # Try the canonical Special:Redirect URL first; if that 404s,
        # fall back to looking up an actually-uploaded file via allimages.
        urls: List[str] = [f"{WAVU_FILE}/{_portrait_filename(name)}"]
        fallback_url = _lookup_portrait_url(session, name)
        if fallback_url and fallback_url not in urls:
            urls.append(fallback_url)

        downloaded = False
        for url in urls:
            try:
                r = session.get(url, timeout=30, allow_redirects=True)
            except requests.RequestException as e:
                print(f"  warn: portrait download failed for {name}: {e}")
                continue

            ct = r.headers.get("Content-Type", "")
            if r.status_code != 200 or not ct.startswith("image/"):
                continue

            try:
                img = Image.open(io.BytesIO(r.content))
                # Match SoulCalibur VI's 155×155 1:1 portraits. Tekken's
                # source uploads are ~144×176 (5:6), so we top-anchor the
                # crop — character heads are framed in the upper half,
                # and dropping the bottom keeps the face on screen.
                w, h = img.size
                if h >= w:
                    img = img.crop((0, 0, w, w))
                else:
                    offset = (w - h) // 2
                    img = img.crop((offset, 0, offset + h, h))
                img = img.resize((155, 155), Image.LANCZOS)
                img.save(local_path, format="WEBP", quality=85, method=6)
            except (OSError, ValueError) as e:
                print(f"  warn: failed to transcode {name} portrait: {e}")
                continue

            entry["image"] = local_name
            print(f"  saved {local_name} ({local_path.stat().st_size // 1024} KB) "
                  f"from {url.rsplit('/', 1)[-1]}")
            downloaded = True
            break

        if not downloaded:
            print(f"  warn: no portrait found for {name} (tried {urls})")
        time.sleep(0.2)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main(character_filter: Optional[str] = None,
         skip_portraits: bool = False) -> None:
    print("Tekken 8 frame data import — wavu.wiki cargoquery")

    session = make_session()
    if solve_anubis(session):
        print("Anubis challenge solved.")
    else:
        print("No Anubis challenge required.")

    print("Fetching Move rows…")
    rows = fetch_all_moves(session)
    print(f"Got {len(rows)} total rows.")

    if character_filter:
        rows = [
            r for r in rows
            if character_from_page(r.get("page")).lower() == character_filter.lower()
        ]
        print(f"Filtered to {len(rows)} rows for {character_filter}.")

    by_id = {r["id"]: r for r in rows if r.get("id")}
    records = [row_to_move(r, by_id, idx) for idx, r in enumerate(rows, start=1)]

    out_root = project_root() / "public" / "Games" / "Tekken8"
    out_root.mkdir(parents=True, exist_ok=True)
    game_json_path = out_root / "Game.json"

    existing = load_existing_game(game_json_path)
    game_json, chars_manifest = build_game_json(records, existing)

    if not skip_portraits:
        print("Downloading character portraits…")
        download_portraits(session, chars_manifest, out_root / "Images")
        # build_game_json returned the manifest by reference, so the
        # `image` updates from download_portraits are already applied to
        # game_json["characters"].

    with open(game_json_path, "w", encoding="utf-8") as f:
        json.dump(game_json, f, ensure_ascii=False, indent=2)
    print(f"  wrote {game_json_path}")

    write_character_files(records, chars_manifest, out_root / "Characters")
    print("Done.")


if __name__ == "__main__":
    args = sys.argv[1:]
    char_filter = None
    skip_portraits = False
    for a in args:
        if a == "--no-portraits":
            skip_portraits = True
        elif not a.startswith("-"):
            char_filter = a
    main(character_filter=char_filter, skip_portraits=skip_portraits)
