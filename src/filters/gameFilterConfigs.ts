import { GameFilterConfig, FieldConfig } from "./types";
import type { FilterOperator } from "./types";
import type {
  HitLevelInfo,
  PropertyInfo,
  StanceInfo,
} from "../contexts/GameContext";

// Default field configs shared if a game doesn't override.
//
// Note the addition of `blockTags` / `hitTags` / `counterHitTags`. The
// `block`/`hit`/`counterHit` fields remain numeric (matching frame advantage);
// the *Tags fields are text-only and let users explicitly query outcome tags
// like KND, LNC or STN independent of the numeric advantage.
export const defaultFields: FieldConfig[] = [
  { id: "input", label: "Stance + Command", type: "text" },
  { id: "stance", label: "Stance", type: "text" },
  { id: "command", label: "Command", type: "text" },
  { id: "hitLevel", label: "Hit Level", type: "text" },
  { id: "impact", label: "Impact", type: "number" },
  { id: "damage", label: "Damage", type: "number" },
  { id: "block", label: "Block (adv)", type: "number" },
  { id: "blockTags", label: "Block tags", type: "text" },
  { id: "hit", label: "Hit (adv)", type: "number" },
  { id: "hitTags", label: "Hit tags", type: "text" },
  { id: "counterHit", label: "Counter Hit (adv)", type: "number" },
  { id: "counterHitTags", label: "Counter Hit tags", type: "text" },
  { id: "guardBurst", label: "Guard Burst", type: "number" },
  { id: "properties", label: "Properties", type: "text" },
  { id: "notes", label: "Notes", type: "text" },
  { id: "character", label: "Character", type: "text" },
];

// ---------------------------------------------------------------------------
// Option builders
// ---------------------------------------------------------------------------

/**
 * Unique sorted stance codes from the game-level registry AND every
 * character-specific registry. The "In list" dropdown on the stance field
 * should offer every stance any character could be in.
 *
 * Codes that also appear in the PROPERTIES registry are excluded here — the
 * SC6 Game.json has historical overlaps where tokens like "GI" (Guard
 * Impact) appear in both stances and properties, and they are semantically
 * properties. Trusting `properties` as the source of truth keeps the stance
 * dropdown clean without needing to edit the authored data.
 */
function buildStanceOptions(
  gameStances: Record<string, StanceInfo>,
  characterStances: Record<number, Record<string, StanceInfo>>,
  excludeCodes: ReadonlySet<string>,
): { value: string; label: string }[] {
  const seen = new Map<string, StanceInfo>();
  const add = (code: string, info: StanceInfo) => {
    if (excludeCodes.has(code)) return;
    if (!seen.has(code)) seen.set(code, info);
  };
  for (const [code, info] of Object.entries(gameStances)) add(code, info);
  for (const charMap of Object.values(characterStances)) {
    for (const [code, info] of Object.entries(charMap)) add(code, info);
  }
  return [...seen.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, info]) => ({
      value: code,
      label: info.name && info.name !== code ? `${code} — ${info.name}` : code,
    }));
}

function buildOptionsFromRecord(
  rec: Record<string, { name?: string }>,
): { value: string; label: string }[] {
  return Object.entries(rec)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, info]) => ({
      value: code,
      label: info.name && info.name !== code ? `${code} — ${info.name}` : code,
    }));
}

function buildCharacterOptions(
  characters: { id: number; name: string }[],
): { value: string; label: string }[] {
  return [...characters]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ value: c.name, label: c.name }));
}

// ---------------------------------------------------------------------------
// Config factory
// ---------------------------------------------------------------------------

/**
 * Generates a game-specific filter configuration.
 *
 * Every registry arg is optional so the factory still works in tests / older
 * call sites; in production FilterBuilder passes them all in so fields like
 * stance / properties / tags / character get "In list" dropdowns populated
 * with their real vocabulary.
 */
export function getGameFilterConfig(
  gameId: string,
  hitLevels: Record<string, HitLevelInfo> = {},
  gameStances: Record<string, StanceInfo> = {},
  characterStances: Record<number, Record<string, StanceInfo>> = {},
  gameProperties: Record<string, PropertyInfo> = {},
  characters: { id: number; name: string }[] = [],
): GameFilterConfig {
  const hitLevelOptions = buildOptionsFromRecord(hitLevels);
  const propertyOptions = buildOptionsFromRecord(gameProperties);
  const characterOptions = buildCharacterOptions(characters);
  // Stances minus any code that's really a property (GI, etc.) — prevents
  // historical overlaps in the Game.json stance registry from polluting
  // the stance dropdown.
  const propertyCodes = new Set(Object.keys(gameProperties));
  const stanceOptions = buildStanceOptions(
    gameStances,
    characterStances,
    propertyCodes,
  );

  // Custom "In list" operator. Relaxed to apply to both `text` and `enum`
  // fields so any field with an option list can use it; the old code had
  // this pinned to `enum` only which meant stance / properties / tags
  // couldn't surface a multi-select even though we knew all their values.
  // Shared multi-select predicate used by the Any-of / All-of / Not-in
  // operators. Picks fieldTokens first (exact atomic match, correct for
  // multi-word stances and prefix-colliding codes like SC / SCH) and falls
  // back to splitting fieldString on common separators for accessors that
  // don't declare a token projection.
  const multiSelectMatch = (
    mode: "any" | "all" | "none",
    fieldString: string | null | undefined,
    fieldTokens: string[] | null | undefined,
    value: string | undefined,
  ): boolean => {
    const selections = (value ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (selections.length === 0) return false;

    let tokenSet: Set<string>;
    if (fieldTokens && fieldTokens.length > 0) {
      tokenSet = new Set(fieldTokens.map((t) => t.toLowerCase()));
    } else if (fieldString) {
      tokenSet = new Set(
        fieldString
          .split(/[\s:,\/()]+/)
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      );
    } else {
      tokenSet = new Set();
    }

    const has = (sel: string) => tokenSet.has(sel.toLowerCase());
    switch (mode) {
      case "any":
        return selections.some(has);
      case "all":
        return selections.every(has);
      case "none":
        // A row with no tokens at all trivially passes "not in" — the
        // picks aren't there because nothing is there.
        return selections.every((sel) => !has(sel));
    }
  };

  /** Matches when AT LEAST ONE of the picks is on the row (OR / union). */
  const anyOfOperator: FilterOperator = {
    id: "inList",
    label: "Any of",
    input: "multi",
    appliesTo: ["enum"],
    test: ({ fieldString, fieldTokens, value }) =>
      multiSelectMatch("any", fieldString, fieldTokens, value),
  };

  /** Matches only when EVERY pick is on the row (AND / intersection). */
  const allOfOperator: FilterOperator = {
    id: "allOf",
    label: "All of",
    input: "multi",
    appliesTo: ["enum"],
    test: ({ fieldString, fieldTokens, value }) =>
      multiSelectMatch("all", fieldString, fieldTokens, value),
  };

  /** Matches when NONE of the picks are on the row (negation of Any-of). */
  const notInOperator: FilterOperator = {
    id: "notIn",
    label: "Not in",
    input: "multi",
    appliesTo: ["enum"],
    test: ({ fieldString, fieldTokens, value }) =>
      multiSelectMatch("none", fieldString, fieldTokens, value),
  };

  /**
   * Punctuation / whitespace-insensitive contains — the operator behind the
   * pinned quick-search row at the top of the builder. Strips everything
   * that isn't alphanumeric or `+` (kept because directional notation uses
   * it: `A+G`, `B+K`), so "ws 2k", "ws2k", "WS 2 K" and ":WS::2::K:" all
   * match the same move, and parenthesised optional inputs like `(2) B+K`
   * in the data are found by typing `2B+K`.
   *
   * When the accessor exposes `fieldTokens` (the `input` column does — one
   * string per OR-branch expansion of `_` separators in the command array),
   * this iterates each token individually. That way a move authored as
   * `(2) _ (8) B+K` gets expanded into "2 B+K" AND "8 B+K", and typing
   * "2B+K" hits the first branch without accidentally bridging the
   * underscore.
   *
   * Only meaningful for the stance+command text column (`input` field);
   * that field lists it first in allowedOperators so it's the default when
   * the pinned row is seeded.
   */
  const normalizeQuick = (s: string): string =>
    s.replace(/[^a-zA-Z0-9+]/g, "").toLowerCase();

  const quickContainsOperator: FilterOperator = {
    id: "quickContains",
    label: "Quick search",
    input: "single",
    appliesTo: ["text"],
    test: ({ fieldString, fieldTokens, value }) => {
      const needle = normalizeQuick(value ?? "");
      if (!needle) return true;
      if (fieldTokens && fieldTokens.length > 0) {
        return fieldTokens.some((t) => normalizeQuick(t).includes(needle));
      }
      return normalizeQuick(fieldString ?? "").includes(needle);
    },
  };

  // Multi-select fields (stance, properties, tags, hit level, character)
  // offer ONLY the three set-membership operators. Partial string ops like
  // "contains" / "equals" don't apply to a vocabulary that's already a
  // known list — the user picks from options rather than typing guesses.
  const MULTI_SELECT_OPS = [
    "inList", // "Any of"  — at least one pick present (legacy id)
    "allOf", // "All of"  — every pick present
    "notIn", // "Not in"  — none of the picks present
  ];

  const withOptions = (
    f: FieldConfig,
    options: { value: string; label: string }[],
  ): FieldConfig => ({
    ...f,
    // Flip to enum so the "Contains / Equals" text ops (which applyTo
    // text, not enum) naturally drop out of the operator dropdown.
    // FilterBuilder renders MultiCombobox for enum + multi operators.
    type: "enum" as const,
    options,
    allowedOperators: MULTI_SELECT_OPS,
  });

  const fields = defaultFields.map((f) => {
    switch (f.id) {
      case "input":
        // The Stance + Command column is also the quick-search target.
        // quickContains is listed first so it's the default when a fresh
        // filter row is seeded against this field; the standard text ops
        // stay available via the operator dropdown for power users.
        return {
          ...f,
          allowedOperators: [
            "quickContains",
            "contains",
            "startsWith",
            "equals",
            "notEquals",
          ],
        };
      case "hitLevel":
        return hitLevelOptions.length > 0
          ? withOptions(f, hitLevelOptions)
          : f;
      case "stance":
        return stanceOptions.length > 0 ? withOptions(f, stanceOptions) : f;
      case "properties":
      case "hitTags":
      case "counterHitTags":
      case "blockTags":
        return propertyOptions.length > 0
          ? withOptions(f, propertyOptions)
          : f;
      case "character":
        return characterOptions.length > 0
          ? withOptions(f, characterOptions)
          : f;
      default:
        return { ...f };
    }
  });

  const config: GameFilterConfig = {
    fields,
    customOperators: [
      anyOfOperator,
      allOfOperator,
      notInOperator,
      quickContainsOperator,
    ],
  };

  if (gameId === "Tekken8") {
    config.customOperators?.push({
      id: "endsWith",
      label: "Ends With",
      input: "single",
      appliesTo: ["text"],
      test: ({ fieldString, value }) =>
        (fieldString ?? "").toLowerCase().endsWith((value ?? "").toLowerCase()),
    });
  }

  return config;
}
