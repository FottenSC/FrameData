import { GameFilterConfig } from "./types";
import type { FilterOperator } from "./types";

// Default field configs shared if a game doesn't override
export const defaultFields: GameFilterConfig["fields"] = [
  // Combined Stance + Command field renamed id to 'input'
  { id: "input", label: "Input", type: "text" },
  { id: "stance", label: "Stance", type: "text" },
  { id: "command", label: "Command", type: "text" },
  { id: "hitLevel", label: "Hit Level", type: "text" },
  { id: "impact", label: "Impact", type: "number" },
  { id: "damage", label: "Damage", type: "number" },
  { id: "block", label: "Block", type: "number" },
  { id: "hit", label: "Hit", type: "number" },
  { id: "counterHit", label: "Counter Hit", type: "number" },
  { id: "guardBurst", label: "Guard Burst", type: "number" },
  { id: "properties", label: "Properties", type: "text" },
  { id: "notes", label: "Notes", type: "text" },
  { id: "character", label: "Character", type: "text" },
];

// ------------------------------
// Soul Calibur 6 specific config
// ------------------------------

// Enumerated Hit Level options (keep the original values for compatibility)
const HIT_LEVEL_OPTIONS: { value: string }[] = [
  { value: ":H:" },
  { value: ":M:" },
  { value: ":L:" },
  { value: ":SM:" },
  { value: ":SL:" },
];

// Helper: clone a field and convert hitLevel to enum configuration
function createHitLevelField(
  base: GameFilterConfig["fields"][number],
): GameFilterConfig["fields"][number] {
  return {
    ...base,
    type: "enum",
    allowedOperators: ["inList"],
    options: HIT_LEVEL_OPTIONS,
  };
}

// Helper: shallow clone default fields (avoid accidental mutation)
const cloneDefaultFields = () => defaultFields.map((f) => ({ ...f }));

// Custom operator: checks if any of the selected values appears in the hit level string.
// Matching strategy:
// 1. Token-based: ":H::M:" -> tokens ["h","m"] (colons stripped, lower-cased)
// 2. Fallback substring: raw lowercase inclusion (allows partial or differently formatted input)
const inListOperator: FilterOperator = {
  id: "inList",
  label: "In List",
  input: "multi",
  appliesTo: ["enum"],
  test: ({
    fieldString,
    value,
  }: {
    fieldType: any;
    fieldString: string | null;
    fieldNumber: any;
    value?: string;
  }) => {
    if (!fieldString) return false;

    // Parse user selection list (comma separated)
    const selections = (value ?? "")
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
    if (selections.length === 0) return false; // nothing selected -> no match

    // Normalize field string to tokens (remove extra colons / whitespace) e.g. ":H::M:" => ["h","m"]
    const normalizedTokens = fieldString
      .split(/:+/)
      .map((t: string) => t.trim().toLowerCase())
      .filter(Boolean);
    const tokenSet = new Set(normalizedTokens);

    const fieldLower = fieldString.toLowerCase();

    // Match if any selection is either present as a normalized token OR as a raw substring
    return selections.some((sel: string) => {
      const selLower = sel.toLowerCase();
      const selToken = sel.replace(/:+/g, "").toLowerCase(); // ":H:" -> "h"
      return tokenSet.has(selToken) || fieldLower.includes(selLower);
    });
  },
};

// Construct Soul Calibur fields with hitLevel overridden
const soulCaliburFields: GameFilterConfig["fields"] = cloneDefaultFields().map(
  (f) => (f.id === "hitLevel" ? createHitLevelField(f) : f),
);

export const gameFilterConfigs: Record<string, GameFilterConfig> = {
  SoulCalibur6: {
    fields: soulCaliburFields,
    customOperators: [inListOperator],
  },
  Tekken8: {
    fields: defaultFields,
    // Example: Tekken might allow an 'endsWith' on command
    customOperators: [
      {
        id: "endsWith",
        label: "Ends With",
        input: "single",
        appliesTo: ["text"],
        test: ({ fieldString, value }) =>
          (fieldString ?? "")
            .toLowerCase()
            .endsWith((value ?? "").toLowerCase()),
      },
    ],
  },
};
