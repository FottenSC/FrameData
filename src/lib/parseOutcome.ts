/**
 * Parsing utilities for move outcome strings.
 *
 * The source data represents an outcome (what happens on block / hit / counter-hit)
 * as a single string that mixes a numeric frame advantage with one or more symbolic
 * tags. Examples seen in the dataset:
 *
 *   "2"         -> advantage=2,   tags=[]
 *   "+28"       -> advantage=28,  tags=[]
 *   "-6"        -> advantage=-6,  tags=[]
 *   "KND"       -> advantage=null,tags=["KND"]
 *   "STN,+18"   -> advantage=18,  tags=["STN"]
 *   "LNC -43"   -> advantage=-43, tags=["LNC"]
 *   "UB, STN"   -> advantage=null,tags=["UB","STN"]
 *   "KND/-2"    -> advantage=-2,  tags=["KND"]
 *   "STN (+10)" -> advantage=10,  tags=["STN"]
 *   "STN,KND"   -> advantage=null,tags=["STN","KND"]
 *   "BREAK"     -> advantage=null,tags=["BREAK"]
 *
 * The goal of the new data model is that each of these outcomes is first class:
 * a move can simultaneously be +28 AND a knockdown, and the UI / filters can treat
 * those facts independently.
 */

import type { MoveOutcome } from "@/types/Move";

/**
 * Tokens that look like words but are **not** outcome tags — they're just
 * filler text authors typed into the spreadsheet. Excluded so we don't accidentally
 * treat e.g. "NC" or "vs" as an outcome tag.
 */
const NON_TAG_WORDS: ReadonlySet<string> = new Set([
  "NC",
  "NCC",
  "VS",
  "IF",
  "AND",
  "OR",
  "ON",
  "TO",
  "AT",
  "THE",
]);

/**
 * Heuristic: a token is a candidate outcome tag if it is 2–6 uppercase letters
 * and is not in the exclude list. Caller can refine with a whitelist.
 */
function looksLikeTag(token: string): boolean {
  if (token.length < 2 || token.length > 6) return false;
  if (!/^[A-Z]+$/.test(token)) return false;
  if (NON_TAG_WORDS.has(token)) return false;
  return true;
}

/**
 * Parse a raw outcome string into a {@link MoveOutcome}.
 *
 * @param raw       The original string from the data file. May be null/empty.
 * @param numericHint An optional pre-computed numeric value (e.g. the `HitDec`
 *                    field from the source JSON). Used as a fast path and
 *                    authoritative fallback when the raw string is ambiguous.
 * @param knownTags Optional whitelist. If provided, only tokens in this set
 *                    are accepted as tags; other alpha tokens are ignored.
 *                    If omitted, a heuristic is used. Passing a whitelist is
 *                    strongly recommended — it prevents author typos (e.g. "lol")
 *                    from being mistaken for a tag.
 */
export function parseOutcome(
  raw: string | null | undefined,
  numericHint: number | null | undefined,
  knownTags?: ReadonlySet<string>,
): MoveOutcome {
  const rawStr =
    typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;

  if (rawStr === null) {
    return {
      advantage:
        typeof numericHint === "number" && Number.isFinite(numericHint)
          ? numericHint
          : null,
      tags: [],
      raw: null,
    };
  }

  // Extract candidate alpha tokens
  const alphaMatches = rawStr.toUpperCase().match(/[A-Z]+/g) ?? [];
  const tagsSeen: string[] = [];
  for (const token of alphaMatches) {
    if (knownTags ? knownTags.has(token) : looksLikeTag(token)) {
      if (!tagsSeen.includes(token)) tagsSeen.push(token);
    }
  }

  // Extract numeric advantage.
  //
  //   - Explicitly-signed numbers (+28, -6) always win.
  //   - When the string carries tags, we REQUIRE an explicit sign to consider
  //     any trailing integer the frame advantage. This avoids reading numbers
  //     out of author prose (e.g. "LNC, STN (2nd)" — the "2" is an ordinal,
  //     not an advantage).
  //   - When there are no tags and only a single integer, we treat it as the
  //     positive advantage (raw input like "2" or "-6").
  let advantage: number | null = null;

  const signedMatches = [...rawStr.matchAll(/[+-]\d+/g)].map((m) => m[0]);
  if (signedMatches.length > 0) {
    advantage = Number(signedMatches[signedMatches.length - 1]);
  } else if (tagsSeen.length === 0) {
    const plainMatches = [...rawStr.matchAll(/-?\d+/g)].map((m) => m[0]);
    if (plainMatches.length === 1) {
      advantage = Number(plainMatches[0]);
    } else if (plainMatches.length > 1) {
      // Ambiguous untagged multi-number strings — preserve via raw, no advantage.
      advantage = null;
    }
  }

  // Prefer the numeric hint when the string has no numbers at all
  if (
    advantage === null &&
    typeof numericHint === "number" &&
    Number.isFinite(numericHint)
  ) {
    advantage = numericHint;
  }

  return {
    advantage,
    tags: tagsSeen,
    raw: rawStr,
  };
}

/** True when the outcome has neither an advantage nor any tags. */
export function isEmptyOutcome(o: MoveOutcome): boolean {
  return o.advantage === null && o.tags.length === 0;
}

/**
 * Produce a concise human-readable string for an outcome, used for display
 * when the UI needs a single compact representation (e.g. CSV export, sort keys).
 *
 *   { advantage: 28, tags: ["KND"] } -> "+28 KND"
 *   { advantage: -6, tags: [] }      -> "-6"
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

/** Default outcome tag registry used when the game JSON does not provide one. */
export const DEFAULT_OUTCOME_TAGS: ReadonlySet<string> = new Set([
  "KND", // knockdown
  "LNC", // launch
  "STN", // stun
  "JGL", // juggle
  "LH", // lethal hit
  "UB", // un-techable
  "GB", // guard burst / break
  "BREAK", // guard break (sc6 spelled out)
  "DZY", // dizzy
  "SLC", // slice
  "RE", // reversal edge
]);
