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
 */
function buildStanceOptions(
  gameStances: Record<string, StanceInfo>,
  characterStances: Record<number, Record<string, StanceInfo>>,
): { value: string; label: string }[] {
  const seen = new Map<string, StanceInfo>();
  for (const [code, info] of Object.entries(gameStances)) {
    if (!seen.has(code)) seen.set(code, info);
  }
  for (const charMap of Object.values(characterStances)) {
    for (const [code, info] of Object.entries(charMap)) {
      if (!seen.has(code)) seen.set(code, info);
    }
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
  const stanceOptions = buildStanceOptions(gameStances, characterStances);
  const propertyOptions = buildOptionsFromRecord(gameProperties);
  const characterOptions = buildCharacterOptions(characters);

  // Custom "In list" operator. Relaxed to apply to both `text` and `enum`
  // fields so any field with an option list can use it; the old code had
  // this pinned to `enum` only which meant stance / properties / tags
  // couldn't surface a multi-select even though we knew all their values.
  const inListOperator: FilterOperator = {
    id: "inList",
    label: "In list",
    input: "multi",
    appliesTo: ["enum", "text"],
    test: ({ fieldString, value }) => {
      if (!fieldString) return false;

      // User-selected values are stored comma-separated by MultiCombobox.
      const selections = (value ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (selections.length === 0) return false;

      // Split the field's haystack on anything that could be a separator in
      // our data: whitespace, colons, commas, slashes, parens. Gives a clean
      // token set so e.g. stance "Back Side, AS" matches a selection of "AS"
      // but not "SS".
      const normalizedTokens = fieldString
        .split(/[\s:,\/()]+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      const tokenSet = new Set(normalizedTokens);
      const fieldLower = fieldString.toLowerCase();

      return selections.some((sel) => {
        const needle = sel.toLowerCase();
        return tokenSet.has(needle) || fieldLower.includes(needle);
      });
    },
  };

  // Attach enum-like options + allowed operators to the relevant fields.
  // Keep the default operators available alongside "In list" so users can
  // still do `stance contains "W"` etc.
  const defaultEnumOps = ["inList", "contains", "equals", "notEquals"];

  const withOptions = (
    f: FieldConfig,
    options: { value: string; label: string }[],
    allowed = defaultEnumOps,
  ): FieldConfig => ({
    ...f,
    // Keep the type as "text" so contains / equals continue to match.
    // The FilterBuilder uses the presence of `options` + the operator's
    // `input === "multi"` to decide when to render a MultiCombobox.
    type: f.type,
    options,
    allowedOperators: allowed,
  });

  const fields = defaultFields.map((f) => {
    switch (f.id) {
      case "hitLevel":
        return hitLevelOptions.length > 0
          ? withOptions(f, hitLevelOptions, defaultEnumOps)
          : f;
      case "stance":
        return stanceOptions.length > 0
          ? withOptions(f, stanceOptions, defaultEnumOps)
          : f;
      case "properties":
      case "hitTags":
      case "counterHitTags":
      case "blockTags":
        return propertyOptions.length > 0
          ? withOptions(f, propertyOptions, defaultEnumOps)
          : f;
      case "character":
        return characterOptions.length > 0
          ? withOptions(f, characterOptions, defaultEnumOps)
          : f;
      default:
        return { ...f };
    }
  });

  const config: GameFilterConfig = {
    fields,
    customOperators: [inListOperator],
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
