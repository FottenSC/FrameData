/**
 * Core data model for moves.
 *
 * A move has three independent outcome channels — {@link block}, {@link hit}
 * and {@link counterHit} — each of which carries BOTH a numeric frame advantage
 * and a list of outcome tags (e.g. KND, LNC, STN). This lets us express facts
 * like "+28 on hit, knocks down" as a single structured value rather than
 * munging them into a free-form string.
 *
 * Character JSON uses the sparse camelCase V2 transport shape.
 * `decodeCharacterMovesV2` fills omitted defaults and injects character
 * identity into this in-memory representation.
 */

/**
 * A single outcome channel (block / hit / counter-hit).
 *
 * Each field is independent:
 *
 * - `advantage` is the numeric frame advantage (or null when unspecified).
 * - `tags`      is an ordered list of outcome tag codes. Duplicates removed.
 * - `raw`       preserves the original authored string for tooltips/export.
 */
export interface MoveOutcome {
  advantage: number | null;
  tags: string[];
  raw: string | null;
}

/** Damage payload: raw per-hit breakdown plus a total for sorting/filtering. */
export interface MoveDamage {
  /** Per-hit breakdown as authored, e.g. "8,10,4,4,4,24". */
  raw: string | null;
  /** Sum of hits. null when not applicable. */
  total: number | null;
}

export interface Move {
  id: number;
  characterId: number;
  characterName: string;

  stringCommand: string | null;
  /**
   * Command input — a {@link Command}, indexed as
   * `command[stepIdx][altIdx][buttonIdx]`:
   *
   *   1. **Steps** are sequential — the outer array preserves "press these
   *      in order".
   *   2. **Alternatives** are OR-branches inside one step. Single-alt steps
   *      (the common case) have length 1; an OR-step authored as
   *      `(3)_(6)_(9) A` becomes a step with three alternatives.
   *   3. **Buttons** are the simultaneous AND-pressed inputs that make up
   *      one alternative, each a {@link CommandButton} (`{b:"A"}` plain,
   *      `{b:"A",h:true}` held).
   *
   * Example: `(3)_(6)_(9) A+B` →
   *
   *     [
   *       [ [{b:"3",h:true}], [{b:"6",h:true}], [{b:"9",h:true}] ],
   *       [ [{b:"A"},{b:"B"}] ],
   *     ]
   *
   * On disk the command is stored in exactly this three-level object-leaf
   * shape; the V2 decoder validates and reads it on load.
   */
  command: Command | null;
  stance: string[] | null;
  hitLevel: string[] | null;

  impact: number | null;
  damage: MoveDamage;

  /** What happens when the move is blocked. */
  block: MoveOutcome;
  /** What happens when the move hits a standing/crouching opponent. */
  hit: MoveOutcome;
  /** What happens when the move counter-hits. */
  counterHit: MoveOutcome;

  guardBurst: number | null;

  /** Move-wide properties (e.g. UA, BA, GI, SS, TH, RE, LH). Never null — empty array instead. */
  properties: string[];

  notes: string | null;
}

/** Create an empty outcome value. Useful as a default. */
export const EMPTY_OUTCOME: MoveOutcome = Object.freeze({
  advantage: null,
  tags: [],
  raw: null,
});

/** Create an empty damage value. */
export const EMPTY_DAMAGE: MoveDamage = Object.freeze({
  raw: null,
  total: null,
});

/**
 * Concise human-readable rendering of an outcome — used for CSV / Excel
 * export and as a sort key.
 *
 *   { advantage: 28, tags: ["KND"] }   -> "+28 KND"
 *   { advantage: -6, tags: [] }        -> "-6"
 *   { advantage: null, tags: ["KND"] } -> "KND"
 */
export function formatOutcome(o: MoveOutcome): string {
  const parts: string[] = [];
  if (o.advantage !== null) {
    parts.push((o.advantage > 0 ? "+" : "") + o.advantage);
  }
  if (o.tags.length > 0) {
    parts.push(o.tags.join(" "));
  }
  return parts.join(" ") || (o.raw ?? "");
}

// ----- Command model -----
//
// A command is a three-level structure: STEPS (sequential) → ALTERNATIVES
// (OR-branches inside a step) → BUTTONS (simultaneously-pressed inputs that
// make up one alternative). Each leaf is a `CommandButton` object so held /
// future flags can be read structurally without string surgery.

/**
 * A single button in a command — the leaf of a {@link Command}.
 *
 *   - `b` — the button token in the universal authoring alphabet (`A`/`B`/
 *     `C`/`D` for buttons, `1`-`9` numpad digits for directions, motion
 *     shorthands like `qcf`/`dp`, lowercase letters like `a` for slides).
 *   - `h` — `true` when the button is held for the duration. Omitted when
 *     false so the on-disk JSON stays compact for the common case.
 */
export interface CommandButton {
  b: string;
  h?: true;
}

/** One alternative within a step — the buttons pressed at the same instant (AND). */
export type CommandPress = CommandButton[];

/** One step — a list of OR-alternatives. Single-alt steps are the common case. */
export type CommandStep = CommandPress[];

/** A full command — an ordered sequence of steps. */
export type Command = CommandStep[];

/**
 * Render a single button as the canonical text form used by sort, search,
 * and CSV export. Held buttons get parens (`{b:"A",h:true}` → `"(A)"`),
 * plain buttons pass through as their `b` value. Co-located with the type
 * so consumers don't reinvent the convention.
 */
export const buttonToText = (b: CommandButton): string =>
  b.h ? `(${b.b})` : b.b;

// ----- Filter model (unchanged shape, preserved for consumers) -----

export interface FilterCondition {
  id: string;
  type?: "condition";
  field: string;
  condition: string;
  value: string;
  value2?: string;
}

export type FilterGroupOperator = "and" | "or";

export interface FilterGroup {
  id: string;
  type: "group";
  operator: FilterGroupOperator;
  filters: FilterItem[];
}

export type FilterItem = FilterCondition | FilterGroup;

/**
 * Columns a user can sort by. These map 1:1 to columns in the table; note that
 * {@link SortableColumn} also includes the derived "rawCommand" and "input"
 * columns that are not direct fields on {@link Move}.
 */
export type SortableColumn =
  | "character"
  | "stance"
  | "command"
  | "rawCommand"
  | "input"
  | "hitLevel"
  | "impact"
  | "damage"
  | "block"
  | "hit"
  | "counterHit"
  | "guardBurst"
  | "properties"
  | "notes";
