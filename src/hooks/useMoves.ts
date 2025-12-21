import { useQuery } from "@tanstack/react-query";
import { Move } from "@/types/Move";

interface Character {
  id: number;
  name: string;
}

type ApplyNotationFn = (cmd: string | null) => string | null;

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
    name: String(c.name),
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

  return data.map((m: any) =>
    processMove(m, characterId, characterName, applyNotation),
  );
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
        ? moveObject.Command.map((cmd: any) => applyNotation(String(cmd)) ?? String(cmd))
        : [applyNotation(String(moveObject.Command)) ?? String(moveObject.Command)]
      : null;

  return {
    id: Number(moveObject.ID),
    stringCommand:
      moveObject.stringCommand != null
        ? String(moveObject.stringCommand)
        : null,
    command: mappedCommand,
    characterId: charId,
    characterName: charName,
    stance: (() => {
      const raw = moveObject.Stance;
      if (Array.isArray(raw)) {
        const arr = raw
          .map((s: any) => (s != null ? String(s) : null))
          .filter((s): s is string => s !== null);
        return arr.length > 0 ? arr : null;
      }
      return raw ? [String(raw)] : null;
    })(),
    hitLevel: (() => {
      const raw = moveObject.HitLevel;
      if (Array.isArray(raw)) {
        const arr = raw
          .map((s: any) => (s != null ? String(s) : null))
          .filter((s): s is string => s !== null);
        return arr.length > 0 ? arr : null;
      }
      return raw ? [String(raw)] : null;
    })(),
    impact: moveObject.Impact != null ? Number(moveObject.Impact) : 0,
    damage: moveObject.Damage != null ? String(moveObject.Damage) : null,
    damageDec:
      moveObject.DamageDec != null ? Number(moveObject.DamageDec) : null,
    block: moveObject.Block != null ? String(moveObject.Block) : null,
    blockDec: moveObject.BlockDec != null ? Number(moveObject.BlockDec) : null,
    hit: moveObject.Hit != null ? String(moveObject.Hit) : null,
    hitDec: moveObject.HitDec != null ? Number(moveObject.HitDec) : null,
    counterHit:
      moveObject.CounterHit != null ? String(moveObject.CounterHit) : null,
    counterHitDec:
      moveObject.CounterHitDec != null
        ? Number(moveObject.CounterHitDec)
        : null,
    guardBurst:
      moveObject.GuardBurst != null ? Number(moveObject.GuardBurst) : null,
    properties: (() => {
      const raw = moveObject.Properties;
      if (Array.isArray(raw)) {
        const arr = raw
          .map((p: any) => (p != null ? String(p) : null))
          .filter((p): p is string => p !== null);
        return arr.length > 0 ? arr : null;
      }
      return raw ? [String(raw)] : null;
    })(),
    notes: moveObject.Notes != null ? String(moveObject.Notes) : null,
  } as Move;
}

async function fetchAllCharactersMoves(
  gameId: string,
  applyNotation: ApplyNotationFn,
): Promise<Move[]> {
  const chars = await fetchCharactersList(gameId);

  // Fetch all characters in parallel
  const results = await Promise.all(
    chars.map((char) =>
      fetchCharacterMoves(gameId, char.id, char.name, applyNotation),
    ),
  );

  return results.flat();
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
  return useQuery({
    queryKey: ["moves", gameId, characterId],
    queryFn: async () => {
      if (!gameId || characterId === null) return [];

      if (characterId === -1) {
        // All characters
        return fetchAllCharactersMoves(gameId, applyNotation);
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
    placeholderData: (previousData) => previousData, // Keep old data while loading new
  });
}
