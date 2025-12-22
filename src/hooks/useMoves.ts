import { useQuery, useQueryClient, QueryClient } from "@tanstack/react-query";
import { Move } from "@/types/Move";

interface Character {
  id: number;
  name: string;
}

type ApplyNotationFn = (cmd: string | null) => string | null;

// Simple interning for common strings to save memory
const stringCache = new Map<string, string>();
const notationCache = new Map<string, string | null>();

export function clearStringCache() {
  stringCache.clear();
  notationCache.clear();
}

function intern(s: string | null): string | null {
  if (s === null) return null;
  // Only intern short strings that are likely to be repeated (stances, hit levels, buttons)
  // Long strings like notes or unique commands should not be interned as it prevents GC
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
  const cached = notationCache.get(cmd);
  if (cached !== undefined) return cached;
  const result = applyNotation(cmd);
  notationCache.set(cmd, result);
  return result;
}

// Fetch functions
async function fetchCharactersList(gameId: string): Promise<Character[]> {
  const res = await fetch(
    `/Games/${encodeURIComponent(gameId)}/Game.json`,
  );
  if (!res.ok)
    throw new Error(`Failed to fetch game data: ${res.status}`);
  const data = await res.json();
  return (Array.isArray(data?.characters) ? data.characters : []).map((c: any) => ({
    id: Number(c.id),
    name: intern(String(c.name))!,
  }));
}

async function fetchCharacterMoves(
  gameId: string,
  characterId: number,
  characterName: string,
  applyNotation: ApplyNotationFn,
): Promise<Move[]> {
  const res = await fetch(
    `/Games/${encodeURIComponent(gameId)}/Characters/${encodeURIComponent(String(characterId))}.json`,
  );
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];

  // Process moves and then clear the raw data reference
  const processed = data.map((m: any) =>
    processMove(m, characterId, characterName, applyNotation),
  );
  return processed;
}

function processMove(
  moveObject: any,
  charId: number,
  charName: string,
  applyNotation: ApplyNotationFn,
): Move {
  const mappedCommand =
    moveObject.Command != null
      ? Array.isArray(moveObject.Command)
        ? moveObject.Command.map((cmd: any) =>
            intern(cachedApplyNotation(String(cmd), applyNotation) ?? String(cmd)),
          )
        : [
            intern(
              cachedApplyNotation(String(moveObject.Command), applyNotation) ??
                String(moveObject.Command),
            ),
          ]
      : null;

  return {
    id: Number(moveObject.ID),
    stringCommand: moveObject.stringCommand != null ? String(moveObject.stringCommand) : null,
    command: mappedCommand,
    characterId: charId,
    characterName: intern(charName)!,
    stance: (() => {
      const raw = moveObject.Stance;
      if (Array.isArray(raw)) {
        const arr = raw
          .map((s: any) => (s != null ? intern(String(s)) : null))
          .filter((s): s is string => s !== null);
        return arr.length > 0 ? arr : null;
      }
      return raw ? [intern(String(raw))!] : null;
    })(),
    hitLevel: (() => {
      const raw = moveObject.HitLevel;
      if (Array.isArray(raw)) {
        const arr = raw
          .map((s: any) => (s != null ? intern(String(s)) : null))
          .filter((s): s is string => s !== null);
        return arr.length > 0 ? arr : null;
      }
      return raw ? [intern(String(raw))!] : null;
    })(),
    impact: moveObject.Impact != null ? Number(moveObject.Impact) : 0,
    damage: moveObject.Damage != null ? String(moveObject.Damage) : null,
    damageDec:
      moveObject.DamageDec != null ? Number(moveObject.DamageDec) : 0,
    block: moveObject.Block != null ? String(moveObject.Block) : null,
    blockDec: moveObject.BlockDec != null ? Number(moveObject.BlockDec) : 0,
    hit: moveObject.Hit != null ? String(moveObject.Hit) : null,
    hitDec: moveObject.HitDec != null ? Number(moveObject.HitDec) : 0,
    counterHit:
      moveObject.CounterHit != null ? String(moveObject.CounterHit) : null,
    counterHitDec:
      moveObject.CounterHitDec != null
        ? Number(moveObject.CounterHitDec)
        : 0,
    guardBurst:
      moveObject.GuardBurst != null ? Number(moveObject.GuardBurst) : 0,
    properties: (() => {
      const raw = moveObject.Properties;
      if (Array.isArray(raw)) {
        const arr = raw
          .map((p: any) => (p != null ? intern(String(p)) : null))
          .filter((p): p is string => p !== null);
        return arr.length > 0 ? arr : null;
      }
      return raw ? [intern(String(raw))!] : null;
    })(),
    notes: moveObject.Notes != null ? String(moveObject.Notes) : null,
  } as Move;
}

async function fetchAllCharactersMoves(
  gameId: string,
  applyNotation: ApplyNotationFn,
  queryClient: QueryClient,
  characters: Character[],
): Promise<Move[]> {
  // Fetch all characters in parallel. Browsers will handle connection pooling (usually 6-10 at a time).
  // This is significantly faster than sequential chunking while still being memory-efficient
  // because JSON parsing and processing are interleaved with network requests.
  const allResults = await Promise.all(
    characters.map((char) =>
      queryClient.fetchQuery({
        queryKey: ["moves", gameId, char.id],
        queryFn: () =>
          fetchCharacterMoves(gameId, char.id, char.name, applyNotation),
        staleTime: 1000 * 60 * 30, // 30 minutes
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
        // All characters
        return fetchAllCharactersMoves(gameId, applyNotation, queryClient, characters);
      } else {
        // Single character
        const charName =
          characters.find((c) => c.id === characterId)?.name || "Unknown";
        return fetchCharacterMoves(
          gameId,
          characterId,
          charName,
          applyNotation,
        );
      }
    },
    enabled: !!gameId && characterId !== null,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}
