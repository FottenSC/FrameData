import { GameFilterConfig, FieldConfig } from "./types";
import type { FilterOperator } from "./types";
import { HitLevelInfo } from "../contexts/GameContext";

// Default field configs shared if a game doesn't override
export const defaultFields: FieldConfig[] = [
  { id: "input", label: "Stance + Command", type: "text" },
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

/**
 * Generates a game-specific filter configuration.
 * @param gameId The ID of the game (e.g., 'Soulcalibur6')
 * @param hitLevels A map of tokens to their info (e.g., { H: { name: 'High', className: '...' } })
 */
export function getGameFilterConfig(
  gameId: string,
  hitLevels: Record<string, HitLevelInfo> = {}
): GameFilterConfig {
  // Create options for the hitLevel enum filter using the tokens as values
  const hitLevelOptions = Object.entries(hitLevels).map(([token, info]) => ({
    value: token,
    label: info.name,
  }));

  // Custom operator: checks if any of the selected values appears in the hit level string.
  const inListOperator: FilterOperator = {
    id: "inList",
    label: "In List",
    input: "multi",
    appliesTo: ["enum"],
    test: ({ fieldString, value }) => {
      if (!fieldString) return false;

      // Parse user selection list (comma separated tokens)
      const selections = (value ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (selections.length === 0) return false;

      // Normalize field string to tokens (remove extra colons / whitespace)
      const normalizedTokens = fieldString
        .split(/[\s:]+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      const tokenSet = new Set(normalizedTokens);
      const fieldLower = fieldString.toLowerCase();

      // Match if any selection's token is present
      return selections.some((sel) => {
        const mappedToken = sel.toLowerCase();
        return tokenSet.has(mappedToken) || fieldLower.includes(mappedToken);
      });
    },
  };

  // Clone default fields and override hitLevel if hitLevels are provided
  const fields = defaultFields.map((f) => {
    if (f.id === "hitLevel" && hitLevelOptions.length > 0) {
      return {
        ...f,
        type: "enum" as const,
        allowedOperators: ["inList"],
        options: hitLevelOptions,
      };
    }
    return { ...f };
  });

  const config: GameFilterConfig = {
    fields,
    customOperators: [inListOperator],
  };

  // Add game-specific overrides
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

