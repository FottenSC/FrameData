import { useQuery, useQueries } from "@tanstack/react-query";
import {
  Move,
  MoveOutcome,
  Command,
  CommandButton,
  CommandPress,
} from "@/types/Move";

interface Character {
  id: number;
  name: string;
}

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

export function clearStringCache() {
  stringCache.clear();
}

function intern(s: string | null): string | null {
  if (s === null) return null;
  if (s.length > 40) return s;
  const cached = stringCache.get(s);
  if (cached !== undefined) return cached;
  stringCache.set(s, s);
  return s;
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
  return data.map((m: any) => processMove(m, characterId, internedCharName));
}

// ---------- Normalization ----------
//
// Character JSON is produced solely by the FrameDataFactory pipeline and
// ships in a single canonical shape — there are no legacy on-disk variants
// left to detect. Reading a move is a flat field-by-field copy into the
// in-memory {@link Move}: the only work is renaming the stored PascalCase
// keys, folding Damage/DamageDec into one object, and interning the small
// recurring string vocabulary.

/** Read a stored `string[] | null` field — drops empties, interns, null when empty. */
function toStringArray(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v === "string" && v.length > 0) out.push(intern(v)!);
  }
  return out.length > 0 ? out : null;
}

/**
 * Read one stored outcome object (`Block` / `Hit` / `CounterHit`) into a
 * {@link MoveOutcome}. The pipeline always emits the structured
 * `{ advantage, tags, raw }` form; types are coerced defensively and the
 * tag codes interned (they come from a tiny shared vocabulary).
 */
function readOutcome(stored: unknown): MoveOutcome {
  if (!stored || typeof stored !== "object") {
    return { advantage: null, tags: [], raw: null };
  }
  const s = stored as { advantage?: unknown; tags?: unknown; raw?: unknown };
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

/**
 * Convert a stored button leaf — always the object form `{b}` / `{b,h:true}` —
 * into a {@link CommandButton}. The token is interned so the small alphabet
 * (A / B / 6 / qcf / …) collapses to one heap entry. Returns `null` for a
 * malformed leaf.
 */
function toButton(leaf: unknown): CommandButton | null {
  if (!leaf || typeof leaf !== "object") return null;
  const token = (leaf as { b?: unknown }).b;
  if (typeof token !== "string" || token.length === 0) return null;
  const b = intern(token)!;
  return (leaf as { h?: unknown }).h === true ? { b, h: true } : { b };
}

/**
 * Read the stored `Command` into the in-memory {@link Command}: a three-level
 * steps × alternatives × buttons array of object leaves. Empty alternatives
 * and steps are dropped; `null` (or any non-array) yields `null`. Notation
 * translation is NOT applied here — that happens at presentation time.
 */
function readCommand(raw: unknown): Command | null {
  if (!Array.isArray(raw)) return null;
  const out: Command = [];
  for (const step of raw) {
    if (!Array.isArray(step)) continue;
    const alts: CommandPress[] = [];
    for (const alt of step) {
      if (!Array.isArray(alt)) continue;
      const buttons: CommandButton[] = [];
      for (const leaf of alt) {
        const btn = toButton(leaf);
        if (btn) buttons.push(btn);
      }
      if (buttons.length > 0) alts.push(buttons);
    }
    if (alts.length > 0) out.push(alts);
  }
  return out.length > 0 ? out : null;
}

/**
 * Convert one raw JSON move object into the in-memory {@link Move}. The raw
 * shape uses PascalCase keys and stores damage as two correlated fields
 * (`Damage` per-hit string + `DamageDec` total); both fold into `damage`.
 */
function processMove(raw: any, charId: number, charName: string): Move {
  return {
    id: Number(raw.ID),
    characterId: charId,
    characterName: charName,
    stringCommand:
      raw.stringCommand != null ? String(raw.stringCommand) : null,
    command: readCommand(raw.Command),
    stance: toStringArray(raw.Stance),
    hitLevel: toStringArray(raw.HitLevel),
    impact: raw.Impact != null ? Number(raw.Impact) : null,
    damage: {
      raw: raw.Damage != null ? intern(String(raw.Damage)) : null,
      total: raw.DamageDec != null ? Number(raw.DamageDec) : null,
    },
    block: readOutcome(raw.Block),
    hit: readOutcome(raw.Hit),
    counterHit: readOutcome(raw.CounterHit),
    guardBurst: raw.GuardBurst != null ? Number(raw.GuardBurst) : null,
    properties: toStringArray(raw.Properties) ?? [],
    notes: raw.Notes != null ? String(raw.Notes) : null,
  };
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

interface UseMovesResult {
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
  const singleQuery = useQuery<Move[]>({
    queryKey: ["moves", gameId, characterId],
    queryFn: () => {
      const charName =
        characters.find((c) => c.id === characterId)?.name || "Unknown";
      return fetchCharacterMoves(gameId!, characterId!, charName);
    },
    enabled: !!gameId && characterId !== null && !isAll,
    staleTime: MOVES_STALE_TIME,
    gcTime: MOVES_GC_TIME,
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
        ? characters.map((char) => ({
            queryKey: ["moves", gameId, char.id],
            queryFn: () => fetchCharacterMoves(gameId, char.id, char.name),
            staleTime: MOVES_STALE_TIME,
            gcTime: MOVES_GC_TIME,
          }))
        : [],
    combine: (results): UseMovesResult => {
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
      for (const r of results) {
        if (r.data) {
          out.push(...r.data);
          loaded += 1;
        }
        if (!firstError && r.error) firstError = r.error;
      }
      const fullyLoaded = loaded === results.length;
      return {
        // Hold `data` back until the whole batch is in, then reveal all
        // at once. See comment in earlier iteration for rationale — a
        // progressive row-by-row reveal made the skeleton vanish too
        // early and the table "grew" in a way users read as buggy.
        data: fullyLoaded ? out : (EMPTY_MOVES as Move[]),
        isLoading: !fullyLoaded,
        isPlaceholderData: false,
        error: firstError,
        loaded,
        total: results.length,
      };
    },
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
