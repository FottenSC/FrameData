import { useQuery, useQueryClient, QueryClient, keepPreviousData } from "@tanstack/react-query";
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

export function clearNotationCache() {
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

export async function fetchCharacterMoves(
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

  const internedCharName = intern(characterName)!;

  // Process moves and then clear the raw data reference
  const processed = data.map((m: any) =>
    processMove(m, characterId, internedCharName, applyNotation),
  );
  return processed;
}

function processMove(
  moveObject: any,
  charId: number,
  charName: string,
  applyNotation: ApplyNotationFn,
): Move {
  const rawCommand = moveObject.Command;
  const mappedCommand =
    rawCommand != null
      ? Array.isArray(rawCommand)
        ? rawCommand.map((cmd: any) =>
            intern(cachedApplyNotation(String(cmd), applyNotation) ?? String(cmd))!,
          )
        : [
            intern(
              cachedApplyNotation(String(rawCommand), applyNotation) ??
                String(rawCommand),
            )!,
          ]
      : null;

  const move: Move = {
    id: Number(moveObject.ID),
    stringCommand: moveObject.stringCommand != null ? String(moveObject.stringCommand) : null,
    command: mappedCommand,
    characterId: charId,
    characterName: charName,
    stance: (() => {
      const raw = moveObject.Stance;
      if (!raw) return null;
      if (Array.isArray(raw)) {
        const arr = [];
        for (const s of raw) {
          if (s != null) arr.push(intern(String(s))!);
        }
        return arr.length > 0 ? arr : null;
      }
      return [intern(String(raw))!];
    })(),
    hitLevel: (() => {
      const raw = moveObject.HitLevel;
      if (!raw) return null;
      if (Array.isArray(raw)) {
        const arr = [];
        for (const s of raw) {
          if (s != null) arr.push(intern(String(s))!);
        }
        return arr.length > 0 ? arr : null;
      }
      return [intern(String(raw))!];
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
      if (!raw) return null;
      if (Array.isArray(raw)) {
        const arr = [];
        for (const p of raw) {
          if (p != null) arr.push(intern(String(p))!);
        }
        return arr.length > 0 ? arr : null;
      }
      return [intern(String(raw))!];
    })(),
    notes: moveObject.Notes != null ? String(moveObject.Notes) : null,
  };

  // Pre-calculate searchable strings for performance
  move._searchStance = move.stance ? move.stance.join(", ") : "";
  move._searchCommand = move.command ? move.command.join(" ") : "";
  move._searchHitLevel = move.hitLevel ? move.hitLevel.join(" ") : "";
  move._searchProperties = move.properties ? move.properties.join(" ") : "";
  move._searchInput = [
    move.stance ? move.stance.join(" ") : null,
    move.command ? move.command.join(" ") : null,
  ]
    .filter(Boolean)
    .join(" ");

  return move;
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
    placeholderData: keepPreviousData,
  });
}
