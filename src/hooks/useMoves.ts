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
 * Each token is passed through `applyNotation` so direction glyphs get
 * translated into the active notation style, then interned.
 */
function normalizeCommand(
  raw: unknown,
  applyNotation: ApplyNotationFn,
): string[][] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) {
    // Single scalar (rare path) — wrap as a one-step, one-alt command.
    const mapped =
      cachedApplyNotation(String(raw), applyNotation) ?? String(raw);
    const t = intern(mapped);
    return t ? [[t]] : null;
  }
  if (raw.length === 0) return null;

  const mapTok = (t: unknown): string | null => {
    if (t == null) return null;
    const s = String(t);
    if (s.length === 0) return null;
    const mapped = cachedApplyNotation(s, applyNotation) ?? s;
    return intern(mapped);
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
function processMove(
  raw: any,
  charId: number,
  charName: string,
  applyNotation: ApplyNotationFn,
): Move {
  const mappedCommand = normalizeCommand(raw.Command, applyNotation);

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
