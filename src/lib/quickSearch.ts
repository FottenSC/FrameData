/**
 * Quick-search: stance + command fast filter.
 *
 * Deliberately narrow. The quick-search is for the one thing players do
 * constantly: "find this move by what I'd type to do it". It searches against
 * stance + command only — structured filters (character, tags, impact,
 * advantage, etc.) belong to the advanced filter builder below.
 *
 * The one upgrade over a plain `contains`: multi-word AND. Typing `ws 2k`
 * means "rows whose stance+command contains both `ws` and `2k`" — much
 * friendlier than having to get the exact concatenation right. Each term is
 * a case-insensitive substring match.
 */

import type { Move } from "@/types/Move";

export interface ParsedQuery {
  /** Lowercased whitespace-separated terms. All must match (AND). */
  terms: string[];
  /** True when the user typed nothing meaningful. */
  isEmpty: boolean;
}

export function parseQuickSearch(raw: string): ParsedQuery {
  const trimmed = raw.trim();
  if (!trimmed) return { terms: [], isEmpty: true };
  const terms = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
  return { terms, isEmpty: terms.length === 0 };
}

/**
 * Build the search haystack for a move. Stance + translated command +
 * the raw `stringCommand` so either "ws" / "WS" / `:6::A:` / `6A`
 * style inputs all work intuitively.
 */
function moveHaystack(move: Move): string {
  const parts: string[] = [];
  if (move.stance && move.stance.length > 0) parts.push(move.stance.join(" "));
  if (move.command && move.command.length > 0)
    parts.push(move.command.join(" "));
  if (move.stringCommand) parts.push(move.stringCommand);
  return parts.join(" ").toLowerCase();
}

/**
 * True when the move's stance+command matches every term in the parsed query.
 * Empty query always matches.
 */
export function matchesQuickSearch(move: Move, query: ParsedQuery): boolean {
  if (query.isEmpty) return true;
  const hay = moveHaystack(move);
  for (const t of query.terms) {
    if (!hay.includes(t)) return false;
  }
  return true;
}
