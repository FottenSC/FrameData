/**
 * Quick-search parser and matcher.
 *
 * The goal is a single-input omnibar that feels like Google or a command
 * palette — you type words and things narrow. Power users can reach for
 * prefixes without having to learn a DSL up front.
 *
 * Grammar (informal):
 *
 *   query     := term (SP term)*
 *   term      := ("-")? (fieldPrefix)? (quoted | bareToken)
 *   fieldPrefix := "char:" | "cmd:" | "stance:" | "note:" | "tag:"
 *                | "hit:"  | "ch:"  | "block:" | "imp:"   | "dmg:"
 *                | "level:"
 *   quoted    := "…any chars…"
 *   bareToken := non-space chars
 *
 * Semantics:
 *   - All top-level terms are AND-ed.
 *   - Each term is a case-insensitive substring match against a subset of
 *     fields determined by its (optional) prefix.
 *   - A leading "-" negates the term (the move must NOT match).
 *   - Numeric prefixes (imp, dmg, hit, ch, block) accept comparators:
 *     "<=12" "<12" ">=0" ">0" "=12" "12" — the last two are equality.
 *
 * Absent prefix ≡ "search every searchable field". This is what makes the
 * default experience intuitive: if you just type "amy knd", it finds Amy's
 * knockdown moves, without you thinking about which column.
 */

import type { Move } from "@/types/Move";

// ---------------------------------------------------------------------------
// Field aliases
// ---------------------------------------------------------------------------

type FieldAlias =
  | "char"
  | "cmd"
  | "stance"
  | "note"
  | "tag"
  | "hit"
  | "ch"
  | "block"
  | "imp"
  | "dmg"
  | "level";

// Accepted user spellings for each alias. Lowercased on match.
const FIELD_ALIASES: Record<string, FieldAlias> = {
  char: "char",
  character: "char",
  name: "char",
  cmd: "cmd",
  command: "cmd",
  input: "cmd",
  stance: "stance",
  note: "note",
  notes: "note",
  tag: "tag",
  tags: "tag",
  prop: "tag",
  property: "tag",
  properties: "tag",
  hit: "hit",
  ch: "ch",
  counter: "ch",
  counterhit: "ch",
  block: "block",
  blk: "block",
  imp: "imp",
  impact: "imp",
  speed: "imp",
  dmg: "dmg",
  damage: "dmg",
  lvl: "level",
  level: "level",
  hitlevel: "level",
};

const NUMERIC_ALIASES = new Set<FieldAlias>([
  "imp",
  "dmg",
  "hit",
  "ch",
  "block",
]);

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export interface ParsedTerm {
  /** Field alias (normalised). `undefined` = match any searchable field. */
  field?: FieldAlias;
  /** Search text, lowercased. For numeric terms this is the rhs of the op. */
  text: string;
  /** true if the term was prefixed with `-`. */
  negate: boolean;
  /**
   * Numeric comparator when the prefix is a number-scoped field AND `text`
   * parses as a number. Otherwise undefined and we fall back to substring.
   */
  numeric?: {
    op: "<" | "<=" | ">" | ">=" | "=";
    value: number;
  };
}

export interface ParsedQuery {
  terms: ParsedTerm[];
  /** True iff the user typed nothing meaningful. */
  isEmpty: boolean;
}

// Matches: optional leading `-`, optional `word:`, then either "quoted" or
// non-whitespace. The `\S+` branch greedily eats until the next space.
const TERM_RE = /(-?)(?:([a-zA-Z]+):)?(?:"([^"]*)"|(\S+))/g;
const NUMERIC_OP_RE = /^(<=|>=|<|>|=)?\s*(-?\d+(?:\.\d+)?)$/;

export function parseQuickSearch(raw: string): ParsedQuery {
  const terms: ParsedTerm[] = [];
  if (!raw) return { terms, isEmpty: true };

  TERM_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TERM_RE.exec(raw))) {
    const [, neg, prefix, quoted, bare] = match;
    const value = (quoted ?? bare ?? "").trim();
    if (!value && !prefix) continue;

    const fieldKey = prefix?.toLowerCase();
    const field = fieldKey ? FIELD_ALIASES[fieldKey] : undefined;

    // If the user typed a prefix we don't recognise, fold it back into the
    // text. e.g. `mid:5` with no `mid` alias becomes a literal "mid:5" search.
    const textWithFallback = prefix && !field ? `${prefix}:${value}` : value;

    if (!textWithFallback) continue;

    const term: ParsedTerm = {
      field,
      text: textWithFallback.toLowerCase(),
      negate: neg === "-",
    };

    // Numeric comparator parsing for numeric-scoped fields
    if (field && NUMERIC_ALIASES.has(field)) {
      const m = NUMERIC_OP_RE.exec(textWithFallback);
      if (m) {
        const op = (m[1] ?? "=") as "<" | "<=" | ">" | ">=" | "=";
        const num = Number(m[2]);
        if (Number.isFinite(num)) {
          term.numeric = { op, value: num };
        }
      }
    }

    terms.push(term);
  }

  return { terms, isEmpty: terms.length === 0 };
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

const joinLower = (xs: string[] | null | undefined, sep: string): string =>
  xs && xs.length > 0 ? xs.join(sep).toLowerCase() : "";

function allSearchableText(move: Move): string {
  // Single concatenated blob so a prefix-less term only allocates one string
  // per move per query. Matching is lower-cased substring.
  return [
    move.characterName,
    move.stringCommand ?? "",
    joinLower(move.command, " "),
    joinLower(move.stance, " "),
    joinLower(move.hitLevel, " "),
    move.notes ?? "",
    move.properties.join(" "),
    move.hit.tags.join(" "),
    move.counterHit.tags.join(" "),
    move.block.tags.join(" "),
    move.hit.raw ?? "",
    move.counterHit.raw ?? "",
    move.block.raw ?? "",
    move.impact != null ? String(move.impact) : "",
    move.damage.total != null ? String(move.damage.total) : "",
  ]
    .join("\u0001") // non-printing separator so adjacent fields can't bleed
    .toLowerCase();
}

/** Return the lower-cased haystack string for a single field alias. */
function fieldHaystack(move: Move, field: FieldAlias): string {
  switch (field) {
    case "char":
      return move.characterName.toLowerCase();
    case "cmd":
      return [
        joinLower(move.stance, " "),
        joinLower(move.command, " "),
        move.stringCommand?.toLowerCase() ?? "",
      ].join(" ");
    case "stance":
      return joinLower(move.stance, " ");
    case "note":
      return (move.notes ?? "").toLowerCase();
    case "tag":
      return [
        ...move.properties,
        ...move.hit.tags,
        ...move.counterHit.tags,
        ...move.block.tags,
      ]
        .join(" ")
        .toLowerCase();
    case "hit":
      return [move.hit.raw ?? "", ...move.hit.tags].join(" ").toLowerCase();
    case "ch":
      return [move.counterHit.raw ?? "", ...move.counterHit.tags]
        .join(" ")
        .toLowerCase();
    case "block":
      return [move.block.raw ?? "", ...move.block.tags].join(" ").toLowerCase();
    case "level":
      return joinLower(move.hitLevel, " ");
    case "imp":
      return move.impact != null ? String(move.impact) : "";
    case "dmg":
      return move.damage.total != null ? String(move.damage.total) : "";
  }
}

/** Numeric value of a field — used for numeric comparator terms. */
function fieldNumber(move: Move, field: FieldAlias): number | null {
  switch (field) {
    case "imp":
      return move.impact;
    case "dmg":
      return move.damage.total;
    case "hit":
      return move.hit.advantage;
    case "ch":
      return move.counterHit.advantage;
    case "block":
      return move.block.advantage;
    default:
      return null;
  }
}

function matchesTerm(move: Move, term: ParsedTerm, allText: string): boolean {
  // Numeric comparator path — only when the field is numeric-scoped AND the
  // text parsed as a number-with-op.
  if (term.numeric && term.field) {
    const n = fieldNumber(move, term.field);
    if (n === null) return false;
    const { op, value } = term.numeric;
    switch (op) {
      case "<":
        return n < value;
      case "<=":
        return n <= value;
      case ">":
        return n > value;
      case ">=":
        return n >= value;
      case "=":
        return n === value;
    }
  }

  // Substring match against the relevant field(s).
  const haystack = term.field ? fieldHaystack(move, term.field) : allText;
  return haystack.includes(term.text);
}

/**
 * True when the move satisfies every term in the parsed query (empty query
 * always matches). Pass the result of `parseQuickSearch` and reuse it across
 * the whole move list — parsing is much cheaper than allocating per-row.
 */
export function matchesQuickSearch(move: Move, query: ParsedQuery): boolean {
  if (query.isEmpty) return true;

  // Compute the "all text" haystack lazily and only once per move —
  // many terms may fall through to it.
  let allText: string | null = null;
  for (const term of query.terms) {
    const needed = !term.field && !allText;
    if (needed) allText = allSearchableText(move);
    const hit = matchesTerm(move, term, allText ?? "");
    if (term.negate ? hit : !hit) return false;
  }
  return true;
}
