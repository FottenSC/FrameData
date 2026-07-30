import { queryOptions, useQuery, useQueries } from "@tanstack/react-query";
import type { Move } from "@/types/Move";
import { clearMoveDataStringCache } from "@/lib/decodeMoveDataV2";
import { fetchCharacterMovesDirect } from "@/lib/fetchCharacterMovesDirect";
import {
  loadCharacterMovesInWorker,
  MoveWorkerUnavailableError,
} from "@/lib/moveDataWorkerClient";

interface Character {
  id: number;
  name: string;
}

export function clearStringCache() {
  clearMoveDataStringCache();
}

// ---------- Data fetching ----------
//
// The data layer is notation-agnostic. Move.command carries tokens as
// authored in the source JSON (universal ABCD + numpad directions), and
// notation translation is applied lazily by the presentation layer —
// CommandRenderer, copyCommand, and the accessor bundle. This decouples
// the react-query cache from the notation style so flipping styles is a
// pure re-render, no refetch or re-process.

export async function fetchCharacterMoves(
  gameId: string,
  characterId: number,
  characterName: string,
  signal?: AbortSignal,
): Promise<Move[]> {
  const url = `/Games/${encodeURIComponent(
    gameId,
  )}/Characters/${encodeURIComponent(String(characterId))}.json`;
  const request = { gameId, characterId, characterName, url };

  try {
    return await loadCharacterMovesInWorker(request, signal);
  } catch (error) {
    if (!(error instanceof MoveWorkerUnavailableError)) throw error;
    return fetchCharacterMovesDirect(request, signal);
  }
}

// ---------- Query hook ----------
//
// Caching strategy: character JSON only changes on deploy, so we mark each
// per-character query as `staleTime: Infinity`. Once fetched, react-query
// will serve the in-memory cache for the rest of the session without any
// revalidation round-trip. `gcTime` is generous (30 min) so backgrounded
// tabs don't evict the big "all characters" set on return.
//
// The "All" selection is implemented as N parallel per-character queries
// via `useQueries` rather than a single aggregate query. That gives us two
// wins:
//
//   1. **Progressive display** — rows appear as each character's JSON
//      lands, instead of waiting for the slowest request.
//   2. **Cache reuse** — the same query keys back individual character
//      views, so clicking Astaroth after "All" is instant.

const MOVES_STALE_TIME = Infinity;
const MOVES_GC_TIME = 1000 * 60 * 30;

export function characterMovesQueryOptions(
  gameId: string,
  character: Character,
) {
  return queryOptions({
    queryKey: ["moves", gameId, character.id] as const,
    queryFn: ({ signal }) =>
      fetchCharacterMoves(gameId, character.id, character.name, signal),
    staleTime: MOVES_STALE_TIME,
    gcTime: MOVES_GC_TIME,
  });
}

/**
 * Shared empty-array sentinel. Returning `[]` literals every render
 * would churn referential identity and cascade through downstream
 * useMemos (displayedMoves, deferredMoves) causing an infinite
 * re-render loop: fresh `[]` → fresh `displayedMoves` → useDeferredValue
 * reports stale → toolbar `setIsUpdating(true)` → context propagates →
 * re-render → fresh `[]` again.
 */
const EMPTY_MOVES: readonly Move[] = Object.freeze([]);

interface UseMoveOptions {
  gameId: string | undefined;
  characterId: number | null;
  characters: Character[];
}

export interface UseMovesResult {
  data: Move[];
  isLoading: boolean;
  isPlaceholderData: boolean;
  error: unknown;
  /**
   * Progressive-load telemetry for the "All" case. `loaded` is the number
   * of characters whose move JSON has already arrived; `total` is the total
   * number expected. For single-character views these are always 1/1 once
   * the data lands. Components can use the ratio to show a progress bar
   * while characters are still being fetched.
   */
  loaded: number;
  total: number;
}

interface MoveQueryResult {
  data?: Move[];
  error?: unknown;
}

export function combineMoveQueryResults(
  results: readonly MoveQueryResult[],
): UseMovesResult {
  if (results.length === 0) {
    return {
      data: EMPTY_MOVES as Move[],
      isLoading: true,
      isPlaceholderData: false,
      error: null,
      loaded: 0,
      total: 0,
    };
  }

  const out: Move[] = [];
  let loaded = 0;
  let firstError: unknown = null;
  for (const result of results) {
    if (result.data !== undefined) {
      out.push(...result.data);
      loaded += 1;
    }
    if (!firstError && result.error) firstError = result.error;
  }

  const fullyLoaded = loaded === results.length && !firstError;
  return {
    data: fullyLoaded ? out : (EMPTY_MOVES as Move[]),
    isLoading: !fullyLoaded && !firstError,
    isPlaceholderData: false,
    error: firstError,
    loaded,
    total: results.length,
  };
}

export function useMoves({
  gameId,
  characterId,
  characters,
}: UseMoveOptions): UseMovesResult {
  const isAll = characterId === -1;

  // Single-character path. Disabled when "All" is selected — we fall back
  // to the per-character fan-out below.
  //
  // Note: we deliberately do NOT use `keepPreviousData` here. Keeping
  // the previous character's move list visible while fetching the next
  // reads as "the wrong character is loaded" to users — they switch to
  // Astaroth and see Voldo's moves dim for a beat before the table
  // refreshes. Falling through to react-query's default "no data while
  // loading" makes the FrameDataTable's existing skeleton kick in for
  // the brief loading window, which is the clearer signal.
  const selectedCharacter = {
    id: characterId ?? -1,
    name:
      characters.find((character) => character.id === characterId)?.name ??
      "Unknown",
  };
  const singleQuery = useQuery({
    ...characterMovesQueryOptions(gameId ?? "", selectedCharacter),
    enabled: !!gameId && characterId !== null && !isAll,
  });

  // "All" path. One useQuery per character running in parallel; `combine`
  // folds them into a single stable result.
  //
  // Why `combine` and not a local `useMemo`: `useQueries` returns a new
  // array identity on every render, so a `useMemo` keyed on that array
  // recomputes every render, producing a fresh `{data, isLoading, ...}`
  // object each time. Downstream consumers (FrameDataTable's
  // `displayedMoves` memo, `useDeferredValue`) see churning identity and
  // fall into a re-render loop. react-query's `combine` handles this
  // correctly: its return value is compared structurally against the
  // previous one and the prior reference is reused when nothing material
  // changed.
  const allResult = useQueries({
    queries:
      isAll && gameId
        ? characters.map((character) =>
            characterMovesQueryOptions(gameId, character),
          )
        : [],
    // Hold `data` back until the whole batch is in, then reveal all at once.
    // Progressive row-by-row reveal made the table grow in a way users read
    // as buggy, while the progress counters still communicate forward motion.
    combine: combineMoveQueryResults,
  });

  if (isAll) return allResult;

  return {
    data: singleQuery.data ?? (EMPTY_MOVES as Move[]),
    isLoading: singleQuery.isLoading,
    isPlaceholderData: singleQuery.isPlaceholderData,
    error: singleQuery.error,
    loaded: singleQuery.data ? 1 : 0,
    total: 1,
  };
}
