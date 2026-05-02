import {
  useQuery,
  useQueries,
  keepPreviousData,
} from "@tanstack/react-query";
import { Move, MoveOutcome } from "@/types/Move";
import { DEFAULT_OUTCOME_TAGS, parseOutcome } from "@/lib/parseOutcome";

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
 * Normalize the raw `Command` field into the in-memory nested shape
 * `string[][]` (one array per step, inner array listing alternatives).
 *
 * Accepts BOTH on-disk shapes:
 *
 *  - **Nested** (current): `[["(3)", "(6)", "(9)"], ["A"]]` — emitted by the
 *    Python factory.
 *  - **Flat + "_" sentinel** (legacy): `["(3)", "_", "(6)", "_", "(9)", "A"]`
 *    — older JSON where alternatives were separated by a literal `"_"` token.
 *
 * Tokens are interned so the vocabulary (A / B / 6 / A+G / etc.) collapses
 * to a single heap entry each. Notation translation is NOT applied here —
 * that happens at presentation time.
 */
function normalizeCommand(raw: unknown): string[][] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) {
    // Single scalar (rare path) — wrap as a one-step, one-alt command.
    const s = String(raw);
    if (!s) return null;
    const t = intern(s);
    return t ? [[t]] : null;
  }
  if (raw.length === 0) return null;

  const mapTok = (t: unknown): string | null => {
    if (t == null) return null;
    const s = String(t);
    if (s.length === 0) return null;
    return intern(s);
  };

  // Nested shape: first element is itself an array.
  if (Array.isArray(raw[0])) {
    const out: string[][] = [];
    for (const step of raw) {
      if (!Array.isArray(step)) continue;
      const alts: string[] = [];
      for (const tok of step) {
        const m = mapTok(tok);
        if (m) alts.push(m);
      }
      if (alts.length > 0) out.push(alts);
    }
    return out.length > 0 ? out : null;
  }

  // Legacy flat shape: collapse "_"-separated runs into multi-alt steps.
  const out: string[][] = [];
  let i = 0;
  while (i < raw.length) {
    const tok = mapTok(raw[i]);
    if (tok == null) {
      i += 1;
      continue;
    }
    // Peek: if the next token is "_", walk the alternation run.
    if (i + 1 < raw.length && raw[i + 1] === "_") {
      const alts: string[] = [tok];
      i += 2;
      while (i < raw.length) {
        const nxt = mapTok(raw[i]);
        if (nxt) alts.push(nxt);
        i += 1;
        if (raw[i] !== "_") break;
        i += 1;
      }
      out.push(alts);
    } else {
      out.push([tok]);
      i += 1;
    }
  }
  return out.length > 0 ? out : null;
}

/**
 * Convert a single raw JSON move object into the rich in-memory {@link Move}.
 *
 * The raw shape uses SC6-era field names ("HitDec", "CounterHit", etc.) and
 * represents an outcome as either a string or number. We parse these into
 * structured {@link MoveOutcome} values.
 */
function processMove(raw: any, charId: number, charName: string): Move {
  const mappedCommand = normalizeCommand(raw.Command);

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
    placeholderData: keepPreviousData,
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
