/**
 * Core data model for moves.
 *
 * A move has three independent outcome channels — {@link block}, {@link hit}
 * and {@link counterHit} — each of which carries BOTH a numeric frame advantage
 * and a list of outcome tags (e.g. KND, LNC, STN). This lets us express facts
 * like "+28 on hit, knocks down" as a single structured value rather than
 * munging them into a free-form string.
 *
 * The raw JSON source uses flat "Hit"/"HitDec"/"CounterHit"/etc. fields;
 * see {@link parseOutcome} and {@link processRawMove} for the normalization layer
 * that converts the stored shape into this richer in-memory representation.
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
   * Command input as an ordered list of "steps". Each step is itself a list
   * of alternative tokens the player can choose from — single-alternative
   * steps (the common case) have length 1; OR-steps authored as e.g.
   * `(3)_(6)_(9) A` become `[["(3)", "(6)", "(9)"], ["A"]]`.
   *
   * This replaces the older flat shape with a literal `"_"` sentinel token
   * between alternatives. The normaliser in useMoves accepts both formats
   * for backwards compatibility with older JSON on disk.
   */
  command: string[][] | null;
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
