/**
 * Single source of truth for "how do I read column X from a Move?"
 *
 * Before this registry existed, three separate switch statements — for sort,
 * filter, and CSV/Excel export — all hard-coded the same column-to-field
 * mapping. Adding a column meant editing three places and keeping them in sync
 * (and the existing code had already started to drift — damage/block used
 * slightly different fallbacks across sort vs export vs filter). That's exactly
 * the kind of thing that becomes a bug farm.
 *
 * This module defines each column once. {@link buildFieldAccessors} returns
 * a bundle of accessors keyed by column id; FrameDataTable memoises that
 * bundle against the current notation style and looks columns up through it
 * for sort / filter / export. Cell rendering stays in {@link MoveTableCell}
 * because it returns JSX rather than a primitive.
 *
 * ## Notation awareness
 *
 * `Move.command` carries tokens exactly as authored (universal ABCD + numpad
 * directions). The current `NotationStyle` is passed to
 * {@link buildFieldAccessors} so any command-touching accessor (command,
 * input, rawCommand) translates tokens lazily into whatever style the user
 * is currently viewing — sort/filter/export always match what they see on
 * screen. Flipping styles rebuilds this bundle via a parent `useMemo` and
 * costs nothing at the data layer.
 */

import { formatOutcome } from "./parseOutcome";
import type { Move, MoveOutcome } from "@/types/Move";
import {
  expandMotionShorthand,
  isMotionShorthand,
  translateCommand,
  translateToken,
  type NotationStyle,
} from "./notation";

/** Join an optional string array with the given separator, or return null. */
const joinOrNull = (xs: string[] | null, sep: string): string | null =>
  xs && xs.length > 0 ? xs.join(sep) : null;

/**
 * Cartesian expansion of a command's OR-steps into concrete input sequences.
 *
 * A command is stored as an ordered list of steps where each step is a list
 * of alternative tokens:
 *
 *     [["(2)", "(8)"], ["B+K"]]          → ["(2) B+K", "(8) B+K"]
 *     [["(3)", "(6)", "(9)"], ["A+G"]]   → ["(3) A+G", "(6) A+G", "(9) A+G"]
 *     [["A"], ["A"], ["B"]]              → ["A A B"]
 *
 * Returned strings are space-joined; the search/filter layer normalises
 * further. Empty / null input yields `[""]` so callers can unconditionally
 * iterate without a null-check.
 */
export function expandCommand(cmd: string[][] | null): string[] {
  if (!cmd || cmd.length === 0) return [""];
  return cmd.reduce<string[]>(
    (acc, step) =>
      acc.flatMap((prefix) =>
        step.map((opt) => (prefix ? `${prefix} ${opt}` : opt)),
      ),
    [""],
  );
}

/**
 * Like {@link expandCommand} but additionally produces expansions that
 * substitute each motion-shorthand token (qcf / qcb / hcf / hcb / dp) with
 * its component direction sequence, translated through the current style.
 *
 * Why: a Tekken player thinking in shorthand types "qcf2" in the quick
 * search; a numpad player thinking in digits types "2361"; an FBUD
 * player types "d df f 2". All three should hit a row whose authored
 * command is `[["qcf"], ["B"]]` — so we expose a search token for each
 * rendering. Only shorthand tokens get expanded; plain tokens pass
 * through.
 *
 * Return value is deduped; in the common no-shorthand case this is
 * exactly {@link expandCommand}.
 */
export function expandCommandWithMotions(
  cmd: string[][] | null,
  style: NotationStyle | null | undefined,
): string[] {
  if (!cmd || cmd.length === 0) return [""];

  // For each step, build the list of display variants every alternative
  // should contribute. A plain token gives one variant (itself); a
  // shorthand gives TWO — the shorthand label AND its expanded sequence
  // rendered as a space-joined string. Cartesian-product those across
  // steps to get all command forms.
  const stepVariants = cmd.map((step) =>
    step.flatMap((tok) => {
      if (!isMotionShorthand(tok)) return [tok];
      const expansion = expandMotionShorthand(tok) ?? [];
      const expandedInStyle = expansion
        .map((t) => translateToken(t, style))
        .join(" ");
      return expandedInStyle ? [tok, expandedInStyle] : [tok];
    }),
  );

  const combinations = stepVariants.reduce<string[]>(
    (acc, variants) =>
      acc.flatMap((prefix) =>
        variants.map((v) => (prefix ? `${prefix} ${v}` : v)),
      ),
    [""],
  );

  // Dedup — a no-shorthand command produces the same set as `expandCommand`
  // but a shorthand-heavy one multiplies: cap the return via a Set.
  return [...new Set(combinations)];
}

/**
 * Human-readable flat rendering of a command, used for sort keys and CSV /
 * Excel export. Multi-alternative steps collapse to `"a/b/c"`; steps are
 * space-separated. `null` / empty → `null`.
 *
 *     [["(3)", "(6)", "(9)"], ["A"]] → "(3)/(6)/(9) A"
 *     [["A"], ["A"], ["B"]]          → "A A B"
 */
export function formatCommandFlat(cmd: string[][] | null): string | null {
  if (!cmd || cmd.length === 0) return null;
  const out = cmd
    .map((step) => (step.length === 1 ? step[0] : step.join("/")))
    .filter((s) => s.length > 0)
    .join(" ");
  return out.length > 0 ? out : null;
}

/**
 * Outcome-tag "search string" used by text filters. Joins parsed tags with the
 * raw authored string so queries like "contains KND" find both structured tag
 * matches and unusual author variations ("BREAK", "knockdown", etc.).
 */
const outcomeTagSearchString = (o: MoveOutcome): string | null => {
  const parts: string[] = [];
  if (o.tags.length > 0) parts.push(o.tags.join(" "));
  if (o.raw) parts.push(o.raw);
  return parts.length > 0 ? parts.join(" ") : null;
};

/** Accessor bundle for a single column. */
export interface FieldAccessor {
  /** Primary sort key (primitive). null values sort to end. */
  sortValue: (m: Move) => number | string | null;
  /** Which comparator variant to use. */
  sortType: "number" | "string";
  /** Numeric projection for numeric filter operators. null when N/A. */
  filterNumber?: (m: Move) => number | null;
  /** String projection for text / enum filter operators. */
  filterString: (m: Move) => string | null;
  /**
   * Atomic-token projection for fields whose natural source is a list
   * (stance, properties, tags, hit levels, …). Used by exact-match
   * operators like `inList` so picking "SC" doesn't bleed into "SCH" and
   * multi-word tokens like "Back Side" stay intact. null / undefined for
   * scalar-sourced fields.
   */
  filterTokens?: (m: Move) => string[] | null;
  /** Plain value for CSV / Excel export. Will be stringified. */
  exportValue: (m: Move) => string | number | null;
}

/**
 * Build the column-accessor bundle for a given notation style.
 *
 * Command-touching accessors (`command`, `input`, implicitly `rawCommand`)
 * translate `Move.command` through {@link translateCommand} so sort /
 * filter / export always reflect what the user is currently seeing. Every
 * other accessor is style-independent and returns the same value regardless
 * of the passed style; they're included in the same bundle so FrameDataTable
 * has one registry to index into.
 *
 * Translation is memoised per (style, token) inside `translateCommand`, so
 * calling this bundle's methods repeatedly across thousands of moves is
 * cheap — each unique token is regex-replaced exactly once per style.
 */
export function buildFieldAccessors(
  style: NotationStyle | null | undefined,
): Record<string, FieldAccessor> {
  /**
   * Get the command in the user's current notation. Called from every
   * command-touching accessor so translation is centralised. `null` in →
   * `null` out, mirroring the underlying field.
   */
  const cmdInStyle = (m: Move): string[][] | null =>
    translateCommand(m.command, style);

  return {
    character: {
      sortValue: (m) => m.characterName ?? null,
      sortType: "string",
      filterString: (m) => m.characterName || null,
      // Single scalar wrapped as a one-element list so "In list" against
      // characters matches exactly (multi-word names like "Seong Mi-na" don't
      // get split on whitespace).
      filterTokens: (m) => (m.characterName ? [m.characterName] : null),
      exportValue: (m) => m.characterName,
    },

    stance: {
      sortValue: (m) => joinOrNull(m.stance, ", "),
      sortType: "string",
      filterString: (m) => joinOrNull(m.stance, ", "),
      // Hand back the raw stance array so "Back Side" stays an atomic token
      // and picking "SC" in the "In list" dropdown doesn't also match moves
      // with "SCH" (Super-Charge Hold, etc.).
      filterTokens: (m) => (m.stance && m.stance.length > 0 ? m.stance : null),
      exportValue: (m) => joinOrNull(m.stance, ", ") ?? "",
    },

    command: {
      sortValue: (m) => formatCommandFlat(cmdInStyle(m)),
      sortType: "string",
      filterString: (m) => formatCommandFlat(cmdInStyle(m)),
      // Token projection is every concrete expansion of the command (one
      // string per OR-branch), PLUS — for rows that contain motion shorthand
      // — each shorthand's numpad expansion. That way a quick-search for
      // "qcf 2", "236 2" or "d df f 2" all hit the same move without the
      // user needing to know which notation shape was authored on disk.
      filterTokens: (m) => {
        const translated = cmdInStyle(m);
        if (!translated || translated.length === 0) return null;
        const expansions = expandCommandWithMotions(translated, style);
        return expansions.length > 0 ? expansions : null;
      },
      exportValue: (m) => formatCommandFlat(cmdInStyle(m)) ?? "",
    },

    rawCommand: {
      // The authored `:A::B+K:` source text is intentionally NOT translated —
      // it's the human-validation view used to cross-check against the
      // upstream sheet, so it should always look the same regardless of
      // which notation the user has picked.
      sortValue: (m) => m.stringCommand ?? null,
      sortType: "string",
      filterString: (m) => m.stringCommand,
      exportValue: (m) => m.stringCommand ?? "",
    },

    // "input" = stance + command, displayed / searched as a single combined
    // field. filterTokens expands OR-steps in the command (e.g. `[["(2)","(8)"]]`)
    // into separate alternative strings so the quick-search can match any
    // real input sequence without accidentally bridging across the alternatives.
    input: {
      sortValue: (m) =>
        [joinOrNull(m.stance, " "), formatCommandFlat(cmdInStyle(m))]
          .filter(Boolean)
          .join(" "),
      sortType: "string",
      filterString: (m) =>
        [joinOrNull(m.stance, " "), formatCommandFlat(cmdInStyle(m))]
          .filter(Boolean)
          .join(" ") || null,
      filterTokens: (m) => {
        const stancePart = joinOrNull(m.stance, " ") ?? "";
        const expansions = expandCommandWithMotions(cmdInStyle(m), style);
        const tokens = expansions.map((cmd) =>
          stancePart ? `${stancePart} ${cmd}` : cmd,
        );
        return tokens.length > 0 ? tokens : null;
      },
      exportValue: (m) =>
        [joinOrNull(m.stance, " "), formatCommandFlat(cmdInStyle(m))]
          .filter(Boolean)
          .join(" "),
    },

    hitLevel: {
      sortValue: (m) => joinOrNull(m.hitLevel, " "),
      sortType: "string",
      filterString: (m) => joinOrNull(m.hitLevel, " "),
      filterTokens: (m) =>
        m.hitLevel && m.hitLevel.length > 0 ? m.hitLevel : null,
      exportValue: (m) => joinOrNull(m.hitLevel, " ") ?? "",
    },

    impact: {
      sortValue: (m) => m.impact ?? null,
      sortType: "number",
      filterNumber: (m) => m.impact ?? null,
      filterString: (m) => (m.impact != null ? String(m.impact) : null),
      exportValue: (m) => m.impact ?? "",
    },

    damage: {
      sortValue: (m) => m.damage.total ?? null,
      sortType: "number",
      filterNumber: (m) => m.damage.total ?? null,
      filterString: (m) =>
        m.damage.total != null ? String(m.damage.total) : m.damage.raw,
      exportValue: (m) => m.damage.total ?? m.damage.raw ?? "",
    },

    block: {
      sortValue: (m) => m.block.advantage,
      sortType: "number",
      filterNumber: (m) => m.block.advantage,
      filterString: (m) => formatOutcome(m.block) || null,
      exportValue: (m) => formatOutcome(m.block),
    },
    blockTags: {
      sortValue: (m) => outcomeTagSearchString(m.block),
      sortType: "string",
      filterString: (m) => outcomeTagSearchString(m.block),
      filterTokens: (m) =>
        m.block.tags.length > 0 ? [...m.block.tags] : null,
      exportValue: (m) => outcomeTagSearchString(m.block) ?? "",
    },

    hit: {
      sortValue: (m) => m.hit.advantage,
      sortType: "number",
      filterNumber: (m) => m.hit.advantage,
      filterString: (m) => formatOutcome(m.hit) || null,
      exportValue: (m) => formatOutcome(m.hit),
    },
    hitTags: {
      sortValue: (m) => outcomeTagSearchString(m.hit),
      sortType: "string",
      filterString: (m) => outcomeTagSearchString(m.hit),
      filterTokens: (m) => (m.hit.tags.length > 0 ? [...m.hit.tags] : null),
      exportValue: (m) => outcomeTagSearchString(m.hit) ?? "",
    },

    counterHit: {
      sortValue: (m) => m.counterHit.advantage,
      sortType: "number",
      filterNumber: (m) => m.counterHit.advantage,
      filterString: (m) => formatOutcome(m.counterHit) || null,
      exportValue: (m) => formatOutcome(m.counterHit),
    },
    counterHitTags: {
      sortValue: (m) => outcomeTagSearchString(m.counterHit),
      sortType: "string",
      filterString: (m) => outcomeTagSearchString(m.counterHit),
      filterTokens: (m) =>
        m.counterHit.tags.length > 0 ? [...m.counterHit.tags] : null,
      exportValue: (m) => outcomeTagSearchString(m.counterHit) ?? "",
    },

    guardBurst: {
      sortValue: (m) => m.guardBurst ?? null,
      sortType: "number",
      filterNumber: (m) => m.guardBurst ?? null,
      filterString: (m) => (m.guardBurst != null ? String(m.guardBurst) : null),
      exportValue: (m) => m.guardBurst ?? "",
    },

    properties: {
      sortValue: (m) =>
        m.properties.length > 0 ? m.properties.join(" ") : null,
      sortType: "string",
      filterString: (m) =>
        m.properties.length > 0 ? m.properties.join(" ") : null,
      filterTokens: (m) =>
        m.properties.length > 0 ? [...m.properties] : null,
      exportValue: (m) =>
        m.properties.length > 0 ? m.properties.join(", ") : "",
    },

    notes: {
      sortValue: (m) => m.notes,
      sortType: "string",
      filterString: (m) => m.notes,
      exportValue: (m) => m.notes ?? "",
    },
  };
}

