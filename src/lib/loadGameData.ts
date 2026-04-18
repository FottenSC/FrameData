/**
 * Parsing + fetching layer for `/Games/{gameId}/Game.json`.
 *
 * This module is intentionally decoupled from React. It exposes one async
 * function, {@link loadGameData}, which returns a fully-shaped
 * {@link GameData} value ready to hand to context state. Keeping this out of
 * the context component means:
 *
 *   1. Every "coerce this loose JSON into a typed record" branch lives in one
 *      place instead of being inlined into a 130-line useEffect.
 *   2. The parsing logic is trivially unit-testable with `fetch` stubbed.
 *   3. The GameProvider component shrinks to actual React concerns.
 */

import type {
  Character,
  CreditEntry,
  HitLevelInfo,
  PropertyInfo,
  StanceInfo,
} from "@/contexts/GameContext";

/** Fully-parsed payload derived from Game.json. */
export interface GameData {
  characters: Character[];
  /** Game-level stances. Shared across all characters. */
  gameStances: Record<string, StanceInfo>;
  /** Per-character stances keyed by characterId then stance code. */
  characterStances: Record<number, Record<string, StanceInfo>>;
  /**
   * Move-wide + outcome properties (UA, BA, GI, SS, TH, RE, LH, KND, LNC, …).
   * The same registry is used both for the Properties column and for the tag
   * chips rendered inside outcome cells — authors maintain a single list.
   */
  gameProperties: Record<string, PropertyInfo>;
  /** Hit level vocabulary (H, M, L, SM, SL). */
  hitLevels: Record<string, HitLevelInfo>;
  /** Credits block. Accepts either a legacy array or the object form. */
  credits: CreditEntry[];
  creditsDescription: string | null;
}

/** Shape of a generic code->descriptor record in Game.json. */
interface CodeRecord {
  name?: string;
  description?: string;
  className?: string;
}

const parseStances = (source: unknown): Record<string, StanceInfo> => {
  if (!source || typeof source !== "object") return {};
  const out: Record<string, StanceInfo> = {};
  for (const [code, info] of Object.entries(
    source as Record<string, CodeRecord>,
  )) {
    out[code] = {
      name: info?.name || code,
      description: info?.description || "",
    };
  }
  return out;
};

const parsePropLike = (source: unknown): Record<string, PropertyInfo> => {
  if (!source || typeof source !== "object") return {};
  const out: Record<string, PropertyInfo> = {};
  for (const [code, info] of Object.entries(
    source as Record<string, CodeRecord>,
  )) {
    out[code] = {
      name: info?.name || code,
      description: info?.description || "",
      className: info?.className || "",
    };
  }
  return out;
};

const parseHitLevels = (source: unknown): Record<string, HitLevelInfo> => {
  if (!source || typeof source !== "object") return {};
  const out: Record<string, HitLevelInfo> = {};
  for (const [code, info] of Object.entries(
    source as Record<string, string | CodeRecord>,
  )) {
    if (typeof info === "string") {
      out[code] = { name: info, description: "", className: "" };
    } else {
      out[code] = {
        name: info?.name || code,
        description: info?.description || "",
        className: info?.className || "",
      };
    }
  }
  return out;
};

const parseCredits = (
  source: unknown,
  fallbackDescription: unknown,
): { list: CreditEntry[]; description: string | null } => {
  if (!source) return { list: [], description: null };
  if (Array.isArray(source)) {
    return {
      list: source as CreditEntry[],
      description:
        typeof fallbackDescription === "string" ? fallbackDescription : null,
    };
  }
  if (typeof source === "object") {
    const obj = source as {
      contributors?: unknown;
      description?: unknown;
    };
    return {
      list: Array.isArray(obj.contributors)
        ? (obj.contributors as CreditEntry[])
        : [],
      description: typeof obj.description === "string" ? obj.description : null,
    };
  }
  return { list: [], description: null };
};

const parseCharacters = (source: unknown, gameId: string): Character[] => {
  if (!Array.isArray(source)) return [];
  return source.map((c: any) => ({
    id: Number(c.id),
    name: String(c.name),
    image: c.image
      ? `/Games/${encodeURIComponent(gameId)}/Images/${c.image}`
      : undefined,
    credits: Array.isArray(c.credits) ? c.credits : undefined,
  }));
};

const parseCharacterStances = (
  source: unknown,
): Record<number, Record<string, StanceInfo>> => {
  if (!Array.isArray(source)) return {};
  const out: Record<number, Record<string, StanceInfo>> = {};
  for (const char of source) {
    if (char?.stances && typeof char.stances === "object") {
      out[Number(char.id)] = parseStances(char.stances);
    }
  }
  return out;
};

/**
 * Fetch and parse the Game.json file for a given game id.
 * Throws on network failure; shape errors in the JSON are tolerated and
 * surface as empty registries.
 */
export async function loadGameData(gameId: string): Promise<GameData> {
  const url = `/Games/${encodeURIComponent(gameId)}/Game.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch game data (${res.status}): ${res.statusText}`,
    );
  }
  const data = await res.json();

  const credits = parseCredits(data?.credits, data?.creditsDescription);

  return {
    characters: parseCharacters(data?.characters, gameId),
    gameStances: parseStances(data?.stances),
    characterStances: parseCharacterStances(data?.characters),
    gameProperties: parsePropLike(data?.properties),
    hitLevels: parseHitLevels(data?.hitLevels),
    credits: credits.list,
    creditsDescription: credits.description,
  };
}
