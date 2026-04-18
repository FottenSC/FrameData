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
 * This module defines each column once. FrameDataTable looks up the accessor
 * by id for every operation; cell rendering stays in {@link MoveTableCell}
 * because it returns JSX rather than a primitive.
 */

import { formatOutcome } from "./parseOutcome";
import type { Move, MoveOutcome } from "@/types/Move";

/** Join an optional string array with the given separator, or return null. */
const joinOrNull = (xs: string[] | null, sep: string): string | null =>
  xs && xs.length > 0 ? xs.join(sep) : null;

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
  /** Plain value for CSV / Excel export. Will be stringified. */
  exportValue: (m: Move) => string | number | null;
}

export const FIELD_ACCESSORS: Record<string, FieldAccessor> = {
  character: {
    sortValue: (m) => m.characterName ?? null,
    sortType: "string",
    filterString: (m) => m.characterName || null,
    exportValue: (m) => m.characterName,
  },

  stance: {
    sortValue: (m) => joinOrNull(m.stance, ", "),
    sortType: "string",
    filterString: (m) => joinOrNull(m.stance, ", "),
    exportValue: (m) => joinOrNull(m.stance, ", ") ?? "",
  },

  command: {
    sortValue: (m) => joinOrNull(m.command, " "),
    sortType: "string",
    filterString: (m) => joinOrNull(m.command, " "),
    exportValue: (m) => joinOrNull(m.command, " ") ?? "",
  },

  rawCommand: {
    sortValue: (m) => m.stringCommand ?? null,
    sortType: "string",
    filterString: (m) => m.stringCommand,
    exportValue: (m) => m.stringCommand ?? "",
  },

  // "input" = stance + command, displayed / searched as a single combined field.
  input: {
    sortValue: (m) =>
      [joinOrNull(m.stance, " "), joinOrNull(m.command, " ")]
        .filter(Boolean)
        .join(" "),
    sortType: "string",
    filterString: (m) =>
      [joinOrNull(m.stance, " "), joinOrNull(m.command, " ")]
        .filter(Boolean)
        .join(" ") || null,
    exportValue: (m) =>
      [joinOrNull(m.stance, " "), joinOrNull(m.command, " ")]
        .filter(Boolean)
        .join(" "),
  },

  hitLevel: {
    sortValue: (m) => joinOrNull(m.hitLevel, " "),
    sortType: "string",
    filterString: (m) => joinOrNull(m.hitLevel, " "),
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
    sortValue: (m) => (m.properties.length > 0 ? m.properties.join(" ") : null),
    sortType: "string",
    filterString: (m) =>
      m.properties.length > 0 ? m.properties.join(" ") : null,
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

/** Get the accessor bundle for a column id. Returns null for unknown ids. */
export function getAccessor(fieldId: string): FieldAccessor | null {
  return FIELD_ACCESSORS[fieldId] ?? null;
}
