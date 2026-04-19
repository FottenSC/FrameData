/**
 * Notation styles.
 *
 * A *notation style* describes how the raw, game-agnostic button notation
 * stored in the character JSON files (A / B / C / D) should be rendered for
 * the user. Players expect different games to look different:
 *
 *   - Soulcalibur players want `A B K G`
 *   - Tekken players want `LP RP LK RK`
 *   - Some prefer to read the raw universal `A B C D`
 *
 * Each style is a self-contained object — no inheritance, no layering, no
 * multi-select. At any given time exactly ONE style is active per game; the
 * user's current selection lives in `UserSettingsContext` keyed by game id.
 *
 * Adding a new style: append to {@link NOTATION_STYLES}. It will appear
 * automatically in the Navbar switcher and the Command Palette view for any
 * game id it lists under `games`.
 */

export interface NotationStyle {
  /** Stable id used in storage. Do not rename without a migration. */
  id: string;
  /** Full user-facing name, shown in the switcher menu ("Soulcalibur (A B K G)"). */
  name: string;
  /** Compact label for the Navbar button — ideally 3–6 chars ("ABKG"). */
  short: string;
  /** One-line description shown under `name` in the menu. Optional. */
  description?: string;
  /** Games this style is valid for. Styles are filtered to the active game. */
  games: string[];
  /**
   * Source → display replacements. Applied as a single regex over each
   * command string by {@link applyNotationStyle}. Empty object = pass through.
   */
  replacements: Record<string, string>;
  /**
   * Tokens the command renderer should treat as **directional inputs** (to be
   * drawn as arrow icons or direction chips) rather than button pills.
   * Defaults to numpad digits `1..9`.
   *
   * Required for styles that re-purpose digits as buttons (e.g. Tekken's
   * `1 2 3 4` button labels) — in that case buttons *are* digits and the
   * renderer's old "first char is a digit → direction" heuristic breaks.
   */
  directionTokens?: readonly string[];
  /**
   * How to render direction tokens:
   *  - `"icon"` (default): look up an SVG at `/Games/{gameId}/Icons/{token}.svg`
   *  - `"text"`: render the token as a compact text chip (for styles whose
   *    directions are letter codes like `F` / `UF` and don't have artwork)
   */
  directionRenderMode?: "icon" | "text";
}

/** Default numpad direction set, used when a style doesn't declare its own. */
export const NUMPAD_DIRECTIONS: readonly string[] = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
];

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

const SC6_BUTTONS: Record<string, string> = {
  "(B+C)": "(B+K)",
  "(B+D)": "(B+G)",
  "(C+D)": "(K+G)",
  "A+B+C": "A+B+K",
  "A+D": "A+G",
  "A+C": "A+K",
  "B+C": "B+K",
  "B+D": "B+G",
  "C+D": "K+G",
  "(C)": "(K)",
  C: "K",
  c: "k",
  "(D)": "(G)",
  D: "G",
  d: "g",
};

const TEKKEN_BUTTONS: Record<string, string> = {
  A: "LP",
  B: "RP",
  C: "LK",
  D: "RK",
};

export const NOTATION_STYLES: NotationStyle[] = [
  {
    id: "universal",
    name: "Universal (A B C D)",
    short: "ABCD",
    description:
      "Generic ABCD notation — matches the underlying data, no translation.",
    games: ["SoulCalibur6", "Tekken8"],
    replacements: {},
  },
  {
    id: "soulcalibur",
    name: "Soulcalibur (A B K G)",
    short: "ABKG",
    description: "Native Soulcalibur notation: K = kick, G = guard.",
    games: ["SoulCalibur6"],
    replacements: SC6_BUTTONS,
  },
  {
    id: "tekken",
    name: "Tekken (LP RP LK RK)",
    short: "LP/RP…",
    description: "Tekken-style button abbreviations.",
    games: ["Tekken8"],
    replacements: TEKKEN_BUTTONS,
  },
  {
    id: "tekken-notation",
    name: "Tekken (F B U D / 1 2 3 4)",
    short: "FBUD",
    description:
      "Directional letters (F / B / UF / …) + numeric button labels (1–4).",
    games: ["Tekken8"],
    directionTokens: ["F", "B", "U", "D", "UF", "UB", "DF", "DB", "N"],
    directionRenderMode: "text",
    replacements: {
      // Numpad directions → letter codes
      "1": "DB",
      "2": "D",
      "3": "DF",
      "4": "B",
      "5": "N",
      "6": "F",
      "7": "UB",
      "8": "U",
      "9": "UF",
      // Universal buttons → Tekken numbers (1-4)
      A: "1",
      B: "2",
      C: "3",
      D: "4",
      a: "1",
      b: "2",
      c: "3",
      d: "4",
    },
  },
];

/**
 * Resolve the set of directional tokens for a style. Callers (the command
 * renderer in particular) use this to decide whether a command segment is a
 * direction or a button — critical for styles where digits are BUTTONS
 * (Tekken notation) rather than directions.
 */
export function getDirectionSet(
  style: NotationStyle | null | undefined,
): ReadonlySet<string> {
  const list = style?.directionTokens ?? NUMPAD_DIRECTIONS;
  return new Set(list);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getStylesForGame(gameId: string): NotationStyle[] {
  return NOTATION_STYLES.filter((s) => s.games.includes(gameId));
}

export function getNotationStyle(id: string): NotationStyle | undefined {
  return NOTATION_STYLES.find((s) => s.id === id);
}

/**
 * Migration map for the legacy UserSettings format that stored an ARRAY of
 * enabled mapping keys per game. The old keys were internal names like
 * `"soulcaliburButtons"` — translate them to the new style ids.
 */
export const LEGACY_STYLE_ID_MAP: Record<string, string> = {
  soulcaliburButtons: "soulcalibur",
  weirdTekken: "tekken",
};

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

// Cache compiled regexes per replacements object so we don't re-compile on
// every move. WeakMap keys are the object identities we ship in
// NOTATION_STYLES, which are stable for the lifetime of the app.
const regexCache = new WeakMap<Record<string, string>, RegExp | null>();

function getRegexFor(replacements: Record<string, string>): RegExp | null {
  const cached = regexCache.get(replacements);
  if (cached !== undefined) return cached;
  const keys = Object.keys(replacements);
  if (keys.length === 0) {
    regexCache.set(replacements, null);
    return null;
  }
  // Longer keys first so "B+K" matches before "B".
  const sorted = [...keys].sort((a, b) => b.length - a.length);
  const escaped = sorted.map((k) =>
    k.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"),
  );
  const regex = new RegExp(escaped.join("|"), "g");
  regexCache.set(replacements, regex);
  return regex;
}

/**
 * Apply a style's replacements to a single command string. Null-safe; returns
 * null when given null, and passes the input straight through for empty or
 * no-op styles.
 */
export function applyNotationStyle(
  text: string | null,
  style: NotationStyle | null | undefined,
): string | null {
  if (text === null) return null;
  if (!style) return text;
  const regex = getRegexFor(style.replacements);
  if (!regex) return text;
  return text.replace(regex, (match) => style.replacements[match] ?? match);
}
