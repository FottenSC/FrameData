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

import {
  buttonToText,
  formatOutcome,
  type Command,
  type CommandPress,
  type Move,
  type MoveOutcome,
} from "@/types/Move";
import {
  expandMotionShorthand,
  getDirectionSet,
  isMotionShorthand,
  translateCommand,
  translateToken,
  type NotationStyle,
} from "./notation";

/** Join an optional string array with the given separator, or return null. */
const joinOrNull = (xs: string[] | null, sep: string): string | null =>
  xs && xs.length > 0 ? xs.join(sep) : null;

/**
 * Join an alternative's simultaneously-pressed buttons back into the
 * canonical `+`-separated token (`[{b:"A"},{b:"B"}]` → `"A+B"`). Held
 * buttons keep their parens (`[{b:"A",h:true}]` → `"(A)"`). Single-button
 * alts pass through with no separator.
 */
const joinButtons = (alt: CommandPress): string =>
  alt.map(buttonToText).join("+");

/**
 * Cartesian expansion of a command's OR-steps into concrete input sequences.
 *
 * A command is stored as steps × alternatives × simultaneously-pressed
 * buttons. We collapse the third level by `+`-joining each alternative's
 * buttons back into the human-readable token, then take the cartesian
 * product across steps:
 *
 *     [[[{b:"2",h}],[{b:"8",h}]], [[{b:"B"},{b:"K"}]]]            → ["(2) B+K", "(8) B+K"]
 *     [[[{b:"3",h}],[{b:"6",h}],[{b:"9",h}]], [[{b:"A"},{b:"G"}]]] → ["(3) A+G", "(6) A+G", "(9) A+G"]
 *     [[[{b:"A"}]], [[{b:"A"}]], [[{b:"B"}]]]                     → ["A A B"]
 *
 * Returned strings are space-joined; the search/filter layer normalises
 * further. Empty / null input yields `[""]` so callers can unconditionally
 * iterate without a null-check.
 */
export function expandCommand(cmd: Command | null): string[] {
  if (!cmd || cmd.length === 0) return [""];
  return cmd.reduce<string[]>(
    (acc, step) =>
      acc.flatMap((prefix) =>
        step.map((alt) => {
          const tok = joinButtons(alt);
          return prefix ? `${prefix} ${tok}` : tok;
        }),
      ),
    [""],
  );
}

/**
 * Expand a command into exactly the textual forms represented by the active
 * notation's renderer. OR-steps still produce one string per concrete branch.
 *
 * Motion shorthand follows the same rule as CommandRenderer: a style that
 * recognises `qcf` renders and searches the literal shorthand; other styles
 * render and search its translated component directions. No inactive or
 * canonical notation aliases are added to the quick-search corpus.
 */
export function expandCommandForDisplaySearch(
  cmd: Command | null,
  style: NotationStyle | null | undefined,
): string[] {
  if (!cmd || cmd.length === 0) return [""];

  const directionSet = getDirectionSet(style);
  const renderButtonForSearch = (button: CommandPress[number]): string => {
    if (!isMotionShorthand(button.b) || directionSet.has(button.b)) {
      return buttonToText(button);
    }

    const expansion = expandMotionShorthand(button.b) ?? [];
    return expansion
      .map((token) => {
        const translated = translateToken(token, style);
        return button.h ? `(${translated})` : translated;
      })
      .join(" ");
  };

  const stepAlternatives = cmd.map((step) =>
    step.map((alt) => alt.map(renderButtonForSearch).join("+")),
  );

  return stepAlternatives.reduce<string[]>(
    (acc, alternatives) =>
      acc.flatMap((prefix) =>
        alternatives.map((value) => (prefix ? `${prefix} ${value}` : value)),
      ),
    [""],
  );
}

/**
 * Human-readable flat rendering of a command, used for sort keys and CSV /
 * Excel export. Each alternative's buttons are `+`-joined, multi-alternative
 * steps collapse to `"a|b|c"`, and steps are space-separated. `null` /
 * empty → `null`.
 *
 *     [[[{b:"3",h}],[{b:"6",h}],[{b:"9",h}]], [[{b:"A"}]]] → "(3)|(6)|(9) A"
 *     [[[{b:"A"}]], [[{b:"A"}]], [[{b:"B"}]]]              → "A A B"
 *     [[[{b:"A"},{b:"B"}]]]                                → "A+B"
 */
export function formatCommandFlat(cmd: Command | null): string | null {
  if (!cmd || cmd.length === 0) return null;
  const out = cmd
    .map((step) => {
      const altStrs = step.map(joinButtons);
      return altStrs.length === 1 ? altStrs[0] : altStrs.join("|");
    })
    .filter((s) => s.length > 0)
    .join(" ");
  return out.length > 0 ? out : null;
}

/**
 * Outcome-tag "search string" used by text filters. V2 omits raw text when it
 * is exactly reconstructible from advantage/tags, so any raw value present
 * here is exceptional authored context worth retaining in search/export.
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
  const translatedCommandCache = new WeakMap<Move, Command | null>();
  const commandSearchTokensCache = new WeakMap<Move, string[] | null>();
  const inputSearchTokensCache = new WeakMap<Move, string[] | null>();

  /**
   * Get the command in the user's current notation. Called from every
   * command-touching accessor so translation is centralised. `null` in →
   * `null` out, mirroring the underlying field.
   */
  const cmdInStyle = (m: Move): Command | null => {
    if (translatedCommandCache.has(m)) {
      return translatedCommandCache.get(m) ?? null;
    }
    const translated = translateCommand(m.command, style);
    translatedCommandCache.set(m, translated);
    return translated;
  };

  const commandSearchTokens = (m: Move): string[] | null => {
    if (commandSearchTokensCache.has(m)) {
      return commandSearchTokensCache.get(m) ?? null;
    }

    const translated = cmdInStyle(m);
    if (!translated || translated.length === 0) {
      commandSearchTokensCache.set(m, null);
      return null;
    }

    const displayExpansions = expandCommandForDisplaySearch(translated, style);
    const result = displayExpansions.length > 0 ? displayExpansions : null;
    commandSearchTokensCache.set(m, result);
    return result;
  };

  const inputSearchTokens = (m: Move): string[] | null => {
    if (inputSearchTokensCache.has(m)) {
      return inputSearchTokensCache.get(m) ?? null;
    }

    const stancePart = joinOrNull(m.stance, " ") ?? "";
    const commandTokens = commandSearchTokens(m) ?? [""];
    const tokens = commandTokens.map((command) =>
      stancePart ? `${stancePart} ${command}` : command,
    );
    const result = tokens.length > 0 ? tokens : null;
    inputSearchTokensCache.set(m, result);
    return result;
  };

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
      // Token projection follows the active renderer exactly: one concrete
      // string per OR-branch, with motion shorthand either kept or expanded
      // according to the selected notation. Inactive notation aliases are
      // deliberately excluded so overlapping digits have one meaning.
      filterTokens: commandSearchTokens,
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
      filterTokens: inputSearchTokens,
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
      filterTokens: (m) => (m.block.tags.length > 0 ? [...m.block.tags] : null),
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
      filterTokens: (m) => (m.properties.length > 0 ? [...m.properties] : null),
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
