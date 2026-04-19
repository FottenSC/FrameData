/**
 * Quick-search: stance + command fast filter.
 *
 * Deliberately narrow. The quick-search is for the one thing players do
 * constantly: "find this move by what I'd type to do it". It searches against
 * stance + command only — structured filters (character, tags, impact,
 * advantage, etc.) belong to the advanced filter builder below.
 *
 * Whitespace is **ignored entirely** on both the query and the move's
 * stance/command text. That means:
 *
 *   query "ws 2k"  → matches "WS 2 K"
 *   query "ws2k"   → same thing
 *   query "2 k"    → matches "2K"
 *
 * Players shouldn't have to think about whether the source data has spaces
 * between stance and command; they just type what they see.
 */

import type { Move } from "@/types/Move";

export interface ParsedQuery {
  /** Whitespace-stripped, lowercased search text. */
  term: string;
  /** True when the user typed nothing meaningful. */
  isEmpty: boolean;
}

const stripSpaces = (s: string): string => s.replace(/\s+/g, "");

export function parseQuickSearch(raw: string): ParsedQuery {
  const term = stripSpaces(raw).toLowerCase();
  return { term, isEmpty: term === "" };
}

/**
 * Build the search haystack for a move. Stance + translated command + the raw
 * `stringCommand` so `ws`, `WS`, `:6::A:`, `6A` style inputs all work.
 */
function moveHaystack(move: Move): string {
  const parts: string[] = [];
  if (move.stance && move.stance.length > 0) parts.push(move.stance.join(""));
  if (move.command && move.command.length > 0) parts.push(move.command.join(""));
  if (move.stringCommand) parts.push(move.stringCommand);
  return stripSpaces(parts.join("")).toLowerCase();
}

/**
 * True when the move's stance+command matches the query. Empty query always
 * matches. Whitespace is already stripped from both sides so `"ws 2k"` and
 * `"ws2k"` behave identically.
 */
export function matchesQuickSearch(move: Move, query: ParsedQuery): boolean {
  if (query.isEmpty) return true;
  return moveHaystack(move).includes(query.term);
}
