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

/**
 * A community link surfaced in the credits view. Per-game so each
 * fighter's discord / spreadsheet / etc. lives next to its data
 * instead of being hardcoded into the React component.
 */
export interface CommunityLink {
  /** Display name, e.g. "Framecalibur" or "Shared framedata spreadsheet". */
  label: string;
  /** Hyperlink target. */
  url: string;
  /** Optional one-line clarifier shown beneath the label. */
  description?: string;
}

/**
 * Per-game community / external resource bundle. Optional everywhere —
 * games without an entry simply don't render that link in the credits.
 */
export interface GameCommunity {
  /** Link to the canonical shared spreadsheet contributors edit. */
  dataSheet?: CommunityLink;
  /** Link to the community discord where data errors should be reported. */
  discord?: CommunityLink;
}

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
  /**
   * External community links surfaced in the credits view (shared
   * spreadsheet, discord, …). Empty object when the game's `Game.json`
   * has no `community` block.
   */
  community: GameCommunity;
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
    const normalizedCode = code.toUpperCase();
    if (typeof info === "string") {
      out[normalizedCode] = { name: info, description: "", className: "" };
    } else {
      out[normalizedCode] = {
        name: info?.name || normalizedCode,
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

const parseCommunityLink = (source: unknown): CommunityLink | undefined => {
  if (!source || typeof source !== "object") return undefined;
  const s = source as { label?: unknown; url?: unknown; description?: unknown };
  const url = typeof s.url === "string" ? s.url : "";
  const label = typeof s.label === "string" ? s.label : "";
  if (!url || !label) return undefined;
  const description =
    typeof s.description === "string" ? s.description : undefined;
  return { url, label, description };
};

const parseCommunity = (source: unknown): GameCommunity => {
  if (!source || typeof source !== "object") return {};
  const s = source as { dataSheet?: unknown; discord?: unknown };
  const out: GameCommunity = {};
  const dataSheet = parseCommunityLink(s.dataSheet);
  if (dataSheet) out.dataSheet = dataSheet;
  const discord = parseCommunityLink(s.discord);
  if (discord) out.discord = discord;
  return out;
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
 * Module-level promise cache.
 *
 * Game.json is build-time constant (regenerated only on deploy), so once
 * fetched and parsed there's nothing to be gained by redoing the work.
 * Storing the in-flight *promise* (not the resolved value) means:
 *
 *   - Concurrent callers — e.g. a hover-prefetch racing a click — share the
 *     same underlying fetch instead of firing two network requests.
 *   - A failed fetch self-evicts so a retry can actually retry.
 */
const gameDataCache = new Map<string, Promise<GameData>>();

/**
 * Synchronously-available cache of already-resolved Game.json payloads.
 * The promise map above is the source of truth (it also tracks in-flight
 * fetches); this mirror exists so UI code can detect a cache hit
 * *without* awaiting a microtask, avoiding a one-frame "loading"
 * flicker when switching to a game whose data is already in memory.
 */
const resolvedGameDataCache = new Map<string, GameData>();

async function doLoadGameData(gameId: string): Promise<GameData> {
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
    community: parseCommunity(data?.community),
  };
}

/**
 * Fetch and parse the Game.json file for a given game id. Results are
 * memoised for the lifetime of the page, so switching between games is
 * instant after the first visit.
 */
export function loadGameData(gameId: string): Promise<GameData> {
  const cached = gameDataCache.get(gameId);
  if (cached) return cached;

  const promise = doLoadGameData(gameId)
    .then((data) => {
      resolvedGameDataCache.set(gameId, data);
      return data;
    })
    .catch((err) => {
      // Drop the failed promise so the next call retries instead of
      // indefinitely replaying the error.
      gameDataCache.delete(gameId);
      throw err;
    });
  gameDataCache.set(gameId, promise);
  return promise;
}

/**
 * Synchronous cache probe. Returns the fully-parsed `GameData` for
 * `gameId` if it's already been loaded *and* resolved in this session,
 * otherwise `null`.
 *
 * Intended for UI code that wants to skip a loading indicator when it
 * can see the data is already in memory — e.g. switching between games
 * the user has visited before. Callers should still call
 * {@link loadGameData} as the authoritative source and treat this probe
 * as a pure optimisation.
 */
export function getCachedGameData(gameId: string): GameData | null {
  return resolvedGameDataCache.get(gameId) ?? null;
}

/**
 * Fire-and-forget variant that warms the cache. Intended for hover /
 * idle-time prefetching; swallows errors so a broken prefetch can't
 * surface as a rejected promise.
 */
export function prefetchGameData(gameId: string): void {
  loadGameData(gameId).catch(() => {
    /* prefetch errors are silent — the real load will surface them */
  });
}
