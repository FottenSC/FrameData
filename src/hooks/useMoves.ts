import {
  useQuery,
  useQueryClient,
  QueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { Move, MoveOutcome } from "@/types/Move";
import { DEFAULT_OUTCOME_TAGS, parseOutcome } from "@/lib/parseOutcome";

interface Character {
  id: number;
  name: string;
}

type ApplyNotationFn = (cmd: string | null) => string | null;

// ---------- String interning ----------
//
// Large characters generate thousands of Move objects whose stance/command/hit-level
// strings are overwhelmingly drawn from a small vocabulary. Interning those common
// short strings collapses them to a single JS heap object and cuts allocation churn
// dramatically.
//
// We deliberately do NOT intern notes or unique commands (length > 40) — those
// are almost always unique and interning them would defeat GC.
const stringCache = new Map<string, string>();

// Notation-application cache. Keyed by the applyNotation function *identity* so
// that changing notation settings (which creates a new function) invalidates the
// old cache automatically via WeakMap.
const notationCache = new WeakMap<
  ApplyNotationFn,
  Map<string, string | null>
>();

export function clearStringCache() {
  stringCache.clear();
}

/** @deprecated the notation cache now self-cleans via WeakMap. */
export function clearNotationCache() {
  // no-op retained for call-site compatibility
}

function intern(s: string | null): string | null {
  if (s === null) return null;
  if (s.length > 40) return s;
  const cached = stringCache.get(s);
  if (cached !== undefined) return cached;
  stringCache.set(s, s);
  return s;
}

function cachedApplyNotation(
  cmd: string | null,
  applyNotation: ApplyNotationFn,
): string | null {
  if (cmd === null) return null;
  let fnCache = notationCache.get(applyNotation);
  if (!fnCache) {
    fnCache = new Map();
    notationCache.set(applyNotation, fnCache);
  }
  const cached = fnCache.get(cmd);
  if (cached !== undefined) return cached;
  const result = applyNotation(cmd);
  fnCache.set(cmd, result);
  return result;
}

// ---------- Data fetching ----------

export async function fetchCharacterMoves(
  gameId: string,
  characterId: number,
  characterName: string,
  applyNotation: ApplyNotationFn,
): Promise<Move[]> {
  const res = await fetch(
    `/Games/${encodeURIComponent(gameId)}/Characters/${encodeURIComponent(
      String(characterId),
    )}.json`,
  );
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];

  const internedCharName = intern(characterName)!;
  return data.map((m: any) =>
    processMove(m, characterId, internedCharName, applyNotation),
  );
}

// ---------- Normalization ----------

/** Normalize a string-or-array-of-strings source field into a string[]|null. */
function toStringArray(raw: unknown): string[] | null {
  if (raw == null) return null;
  const arr = Array.isArray(raw) ? raw : [raw];
  const out: string[] = [];
  for (const v of arr) {
    if (v != null && String(v).length > 0) {
      out.push(intern(String(v))!);
    }
  }
  return out.length > 0 ? out : null;
}

/** Normalize the `Properties` field — never null, always a string[]. */
function toPropertyArray(raw: unknown): string[] {
  return toStringArray(raw) ?? [];
}

/**
 * Normalize an outcome field (Block / Hit / CounterHit).
 *
 * Accepts BOTH shapes to ease migration:
 *
 *   1. The new structured shape emitted by the Python script, where the JSON
 *      already carries ``{ advantage, tags, raw }``. In that case we just
 *      coerce the types (and intern tag strings).
 *   2. The legacy flat shape where the JSON has two correlated fields — a raw
 *      string like "KND,+16" and a pre-computed numeric "*Dec". Here we fall
 *      through to {@link parseOutcome} so the tag list is recovered on load.
 *
 * This lets the frontend read any character JSON regardless of whether it was
 * produced before or after the data-pipeline refactor.
 */
function parseOutcomeField(
  structured: unknown,
  legacyRaw: unknown,
  legacyDec: unknown,
): MoveOutcome {
  if (
    structured &&
    typeof structured === "object" &&
    !Array.isArray(structured) &&
    ("advantage" in structured || "tags" in structured || "raw" in structured)
  ) {
    const s = structured as {
      advantage?: unknown;
      tags?: unknown;
      raw?: unknown;
    };
    const advantage =
      typeof s.advantage === "number" && Number.isFinite(s.advantage)
        ? s.advantage
        : null;
    const tags = Array.isArray(s.tags)
      ? s.tags
          .filter((t): t is string => typeof t === "string" && t.length > 0)
          .map((t) => intern(t)!)
      : [];
    const raw = typeof s.raw === "string" && s.raw.length > 0 ? s.raw : null;
    return { advantage, tags, raw };
  }

  return parseOutcome(
    typeof legacyRaw === "string" ? legacyRaw : null,
    typeof legacyDec === "number"
      ? legacyDec
      : legacyDec != null
        ? Number(legacyDec)
        : null,
    DEFAULT_OUTCOME_TAGS,
  );
}

/**
 * Convert a single raw JSON move object into the rich in-memory {@link Move}.
 *
 * The raw shape uses SC6-era field names ("HitDec", "CounterHit", etc.) and
 * represents an outcome as either a string or number. We parse these into
 * structured {@link MoveOutcome} values.
 */
function processMove(
  raw: any,
  charId: number,
  charName: string,
  applyNotation: ApplyNotationFn,
): Move {
  const mappedCommand = (() => {
    const cmd = raw.Command;
    if (cmd == null) return null;
    const arr = Array.isArray(cmd) ? cmd : [cmd];
    const out: string[] = [];
    for (const c of arr) {
      const mapped = cachedApplyNotation(String(c), applyNotation) ?? String(c);
      out.push(intern(mapped)!);
    }
    return out.length > 0 ? out : null;
  })();

  // Outcomes. The current Python pipeline emits the pre-parsed
  //     { advantage, tags, raw }
  // structure directly; older JSON files still in the wild have the flat
  //     "Block": "KND,+16", "BlockDec": 16
  // shape. parseOutcomeField accepts either.
  const block = parseOutcomeField(raw.Block, raw.Block, raw.BlockDec);
  const hit = parseOutcomeField(raw.Hit, raw.Hit, raw.HitDec);
  const counterHit = parseOutcomeField(
    raw.CounterHit,
    raw.CounterHit,
    raw.CounterHitDec,
  );

  return {
    id: Number(raw.ID),
    characterId: charId,
    characterName: charName,
    stringCommand: raw.stringCommand != null ? String(raw.stringCommand) : null,
    command: mappedCommand,
    stance: toStringArray(raw.Stance),
    hitLevel: toStringArray(raw.HitLevel),
    impact: raw.Impact != null ? Number(raw.Impact) : null,
    damage: {
      raw: raw.Damage != null ? intern(String(raw.Damage)) : null,
      total: raw.DamageDec != null ? Number(raw.DamageDec) : null,
    },
    block,
    hit,
    counterHit,
    guardBurst: raw.GuardBurst != null ? Number(raw.GuardBurst) : null,
    properties: toPropertyArray(raw.Properties),
    notes: raw.Notes != null ? String(raw.Notes) : null,
  };
}

// ---------- Query hook ----------

async function fetchAllCharactersMoves(
  gameId: string,
  applyNotation: ApplyNotationFn,
  queryClient: QueryClient,
  characters: Character[],
): Promise<Move[]> {
  const allResults = await Promise.all(
    characters.map((char) =>
      queryClient.fetchQuery({
        queryKey: ["moves", gameId, char.id],
        queryFn: () =>
          fetchCharacterMoves(gameId, char.id, char.name, applyNotation),
        staleTime: 1000 * 60 * 30,
      }),
    ),
  );
  return allResults.flat();
}

interface UseMoveOptions {
  gameId: string | undefined;
  characterId: number | null;
  applyNotation: (cmd: string | null) => string | null;
  characters: Character[];
}

export function useMoves({
  gameId,
  characterId,
  applyNotation,
  characters,
}: UseMoveOptions) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["moves", gameId, characterId],
    queryFn: async () => {
      if (!gameId || characterId === null) return [];
      if (characterId === -1) {
        return fetchAllCharactersMoves(
          gameId,
          applyNotation,
          queryClient,
          characters,
        );
      }
      const charName =
        characters.find((c) => c.id === characterId)?.name || "Unknown";
      return fetchCharacterMoves(gameId, characterId, charName, applyNotation);
    },
    enabled: !!gameId && characterId !== null,
    staleTime: 1000 * 60 * 5,
    gcTime: characterId === -1 ? 1000 * 60 * 5 : 1000 * 60 * 15,
    placeholderData: keepPreviousData,
  });
}
