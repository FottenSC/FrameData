import { GameFilterConfig } from "./types";

// Default field configs shared if a game doesn't override
export const defaultFields: GameFilterConfig["fields"] = [
  { id: "character", label: "Character", type: "text" },
  { id: "stance", label: "Stance", type: "text" },
  { id: "command", label: "Command", type: "text" },
  { id: "hitLevel", label: "Hit Level", type: "text" },
  { id: "impact", label: "Impact", type: "number" },
  { id: "damage", label: "Damage", type: "number" },
  { id: "block", label: "Block", type: "number" },
  { id: "hit", label: "Hit", type: "number" },
  { id: "counterHit", label: "Counter Hit", type: "number" },
  { id: "guardBurst", label: "Guard Burst", type: "number" },
  { id: "notes", label: "Notes", type: "text" },
];

export const gameFilterConfigs: Record<string, GameFilterConfig> = {
  SoulCalibur6: {
    fields: [...defaultFields.map(f => ({ ...f })),
    ].map(f => f.id === "hitLevel"
      ? {
          ...f,
          type: "enum",
          allowedOperators: ["inList"],
          options: [
            { value: ":H:" },
            { value: ":M:" },
            { value: ":L:" },
            { value: ":SM:" },
            { value: ":SL:" },
          ],
        }
      : f
    ),
    customOperators: [
      {
        id: "inList",
        label: "In List",
        input: "multi",
        appliesTo: ["enum"],
        test: ({ fieldString, value }) => {
          if (!fieldString) {
            return false;
          }
          // Normalize field string to tokens without colons, e.g. ":H::M:" -> ["h","m"]
          const fieldTokens = fieldString
            .split(/:+/)
            .map(t => t.trim().toLowerCase())
            .filter(Boolean);
          const fieldSet = new Set(fieldTokens);

          const selectedRaw = (value ?? "")
            .split(",")
            .map(v => v.trim())
            .filter(Boolean);

          // If nothing selected, treat as not matching
          if (selectedRaw.length === 0) {
            return false;
          }

          // Match if any selected item is present as a token OR as a substring in the raw field string
          const rawLower = fieldString.toLowerCase();
          const result = selectedRaw.some(sel => {
            const token = sel.replace(/:+/g, "").toLowerCase(); // ":H:" -> "h"
            const hasToken = fieldSet.has(token);
            const hasRaw = rawLower.includes(sel.toLowerCase());
            const match = hasToken || hasRaw;
            return match;
          });
          return result;
        },
      }
    ],
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
        test: ({ fieldString, value }) => (fieldString ?? "").toLowerCase().endsWith((value ?? "").toLowerCase()),
      },
    ],
  },
};
