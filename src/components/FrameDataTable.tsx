import React, {
  useEffect,
  useState,
  useDeferredValue,
  useMemo,
  useCallback,
} from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useParams, useNavigate } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { useGame, avaliableGames } from "../contexts/GameContext";
import { useTableConfig } from "../contexts/UserSettingsContext";
import { useToolbar } from "../contexts/ToolbarContext";
import { Skeleton } from "./ui/skeleton";
import { cn } from "@/lib/utils";
import { FilterBuilder } from "./FilterBuilder";
import { CommandRenderer } from "@/components/renderers/CommandRenderer";
import { NotesRenderer } from "@/components/renderers/NotesRenderer";
import { FrameDataTableContent } from "@/components/table/FrameDataTableContent";
import { Move, FilterItem, SortableColumn } from "../types/Move";
import { builtinOperators, operatorById } from "../filters/operators";
import { getGameFilterConfig } from "../filters/gameFilterConfigs";
import type { FieldConfig, FieldType, FilterOperator } from "../filters/types";
import { useMoves } from "@/hooks/useMoves";
import { buildFieldAccessors } from "@/lib/moveAccessors";
import { exportCsv, exportExcel, type ExportCell } from "@/lib/export";

/**
 * Generic comparator factory. Accepts a primitive-valued getter and produces
 * a `(a, b) => number` suitable for `Array.prototype.sort`. null values always
 * sort to the end regardless of direction.
 */
const createComparator = (
  direction: "asc" | "desc",
  fieldType: "string" | "number",
  getter: (move: Move) => number | string | null,
) => {
  const order = direction === "asc" ? 1 : -1;
  // Null handling is intentionally direction-INDEPENDENT: nulls always
  // sort to the bottom. Returning a positive number from the comparator
  // means "A comes after B"; multiplying by `order` would flip nulls to
  // the top in descending mode, which read as the worst row appearing
  // first — confusing for users who expect "no value" to mean "no
  // ranking". So we bypass `order` for the null branches.
  if (fieldType === "number") {
    return (a: Move, b: Move): number => {
      const valA = getter(a) as number | null;
      const valB = getter(b) as number | null;
      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;
      return (valA - valB) * order;
    };
  }
  return (a: Move, b: Move): number => {
    const valA = getter(a);
    const valB = getter(b);
    if (valA == null && valB == null) return 0;
    if (valA == null) return 1;
    if (valB == null) return -1;
    return String(valA).localeCompare(String(valB)) * order;
  };
};

export const FrameDataTable: React.FC = () => {
  const params = useParams({ strict: false }) as {
    gameId?: string;
    characterName?: string;
  };
  const { gameId, characterName } = params;

  const navigate = useNavigate();
  const {
    selectedGame,
    setSelectedGameById,
    characters,
    selectedCharacterId,
    setSelectedCharacterId,
    notationStyle,
    hitLevels,
  } = useGame();

  const { getVisibleColumns, updateColumnVisibility } = useTableConfig();
  const {
    setActiveFiltersCount,
    exportHandler,
    setTotalMoves,
    setFilteredMoves,
    setIsUpdating,
  } = useToolbar();

  const {
    data: originalMoves = [],
    isLoading: movesLoading,
    isPlaceholderData,
    error: movesError,
  } = useMoves({
    gameId: selectedGame?.id,
    characterId: selectedCharacterId,
    characters,
  });

  /**
   * Column-accessor bundle for the currently active notation style. Rebuilt
   * whenever the user switches styles — translation of command tokens is
   * memoised inside `translateCommand`, so swapping this bundle is nearly
   * free and doesn't touch react-query's cache.
   */
  const accessors = useMemo(
    () => buildFieldAccessors(notationStyle),
    [notationStyle],
  );

  const error = movesError ? (movesError as Error).message : null;

  // --- Sorting state ---
  const [sortColumn, setSortColumn] = useState<SortableColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [activeFilters, setActiveFilters] = useState<FilterItem[]>([]);
  // Debounce filter changes before feeding them into the (potentially
  // expensive) `displayedMoves` memo. FilterBuilder already wraps updates
  // in `startTransition`, so React can interrupt re-renders, but the
  // filter-evaluation pass itself still runs per keystroke. 120ms is
  // short enough to feel instant but long enough to coalesce typing
  // bursts across thousands of rows.
  const debouncedActiveFilters = useDebouncedValue(activeFilters, 120);

  const baseColumns = getVisibleColumns();
  const visibleColumns = useMemo(
    () =>
      selectedCharacterId !== -1
        ? baseColumns.filter((c) => c.id !== "character")
        : baseColumns,
    [selectedCharacterId, baseColumns],
  );

  useEffect(() => {
    if (selectedCharacterId === -1) {
      updateColumnVisibility("character", true);
    } else if (selectedCharacterId !== null) {
      updateColumnVisibility("character", false);
    }
  }, [selectedCharacterId, updateColumnVisibility]);

  useEffect(() => {
    if (selectedCharacterId !== -1 && sortColumn === "character") {
      setSortColumn(null);
    }
  }, [selectedCharacterId, sortColumn]);

  // Sync URL with selected character (including "All")
  useEffect(() => {
    if (
      selectedCharacterId !== null &&
      characters.length > 0 &&
      selectedGame.id
    ) {
      const selectedChar = characters.find((c) => c.id === selectedCharacterId);
      if (selectedCharacterId === -1) {
        const expectedUrlName = encodeURIComponent("All");
        const currentUrlName = characterName
          ? encodeURIComponent(decodeURIComponent(characterName))
          : undefined;
        if (expectedUrlName !== currentUrlName) {
          navigate({
            to: `/${selectedGame.id}/${expectedUrlName}`,
            replace: true,
          });
        }
      } else if (selectedChar) {
        const expectedUrlName = encodeURIComponent(selectedChar.name);
        const currentUrlName = characterName
          ? encodeURIComponent(decodeURIComponent(characterName))
          : undefined;
        if (expectedUrlName !== currentUrlName) {
          navigate({
            to: `/${selectedGame.id}/${expectedUrlName}`,
            replace: true,
          });
        }
      }
    }
  }, [
    selectedCharacterId,
    characters,
    selectedGame.id,
    navigate,
    characterName,
  ]);

  const initialGameSyncDoneRef = React.useRef(false);

  useEffect(() => {
    if (!selectedGame) return;

    if (
      gameId &&
      gameId !== selectedGame.id &&
      !initialGameSyncDoneRef.current
    ) {
      const game = avaliableGames.find((g) => g.id === gameId);
      if (game) {
        setSelectedGameById(gameId);
        initialGameSyncDoneRef.current = true;
        return;
      }
    }

    if (!initialGameSyncDoneRef.current) {
      initialGameSyncDoneRef.current = true;
    }

    if (
      characterName &&
      characters.length > 0 &&
      (selectedCharacterId === null ||
        (!characters.some((c) => c.id === selectedCharacterId) &&
          selectedCharacterId !== -1))
    ) {
      const decodedName = decodeURIComponent(characterName);
      if (decodedName.toLowerCase() === "all") {
        setSelectedCharacterId(-1);
      } else {
        const characterFromName = characters.find(
          (c) => c.name.toLowerCase() === decodedName.toLowerCase(),
        );
        if (characterFromName) {
          setSelectedCharacterId(characterFromName.id);
        } else {
          const firstCharacter = characters[0];
          if (firstCharacter) {
            setSelectedCharacterId(firstCharacter.id);
          } else {
            setSelectedCharacterId(null);
          }
        }
      }
    } else if (
      !characterName &&
      characters.length > 0 &&
      (selectedCharacterId === null ||
        (!characters.some((c) => c.id === selectedCharacterId) &&
          selectedCharacterId !== -1))
    ) {
      const firstCharacter = characters[0];
      if (firstCharacter) {
        setSelectedCharacterId(firstCharacter.id);
      }
    }
  }, [
    gameId,
    characterName,
    selectedGame.id,
    characters,
    selectedCharacterId,
    setSelectedGameById,
    setSelectedCharacterId,
  ]);

  // Notation translation is now a pure presentation concern — flipping the
  // style just swaps the memoised accessor bundle and re-renders. Nothing
  // in the data layer needs to be invalidated, re-fetched, or re-processed.

  const handleSort = useCallback(
    (column: SortableColumn) => {
      if (sortColumn === column) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortColumn(column);
        setSortDirection("asc");
      }
    },
    [sortColumn],
  );

  const renderCommand = useCallback(
    (command: string[][] | null) => <CommandRenderer command={command} />,
    [],
  );
  const renderNotes = useCallback(
    (note: string | null) => <NotesRenderer note={note} />,
    [],
  );

  const gameFilterConfig = useMemo(
    () => getGameFilterConfig(selectedGame.id, hitLevels),
    [selectedGame.id, hitLevels],
  );

  const fieldMap = useMemo(
    () =>
      new Map<string, FieldConfig>(
        gameFilterConfig.fields.map((f) => [f.id, f]),
      ),
    [gameFilterConfig],
  );

  const allOperators: FilterOperator[] = useMemo(() => {
    const customs = gameFilterConfig.customOperators ?? [];
    const map = new Map<string, FilterOperator>();
    for (const op of builtinOperators) map.set(op.id, op);
    for (const op of customs) map.set(op.id, op);
    return Array.from(map.values());
  }, [gameFilterConfig]);

  const opsById = useMemo(() => operatorById(allOperators), [allOperators]);

  // ---------- Field extraction for filter evaluation ----------
  //
  // Backed by the central column registry in `lib/moveAccessors.ts`. The
  // registry defines — for each column id — filterString / filterNumber /
  // (optionally) filterTokens projections. We just look up the bundle and
  // call through.
  const getFieldAs = useCallback(
    (
      move: Move,
      fieldId: string,
    ): {
      string: string | null;
      number: number | null;
      tokens: string[] | null;
      type: FieldType;
    } => {
      const field = fieldMap.get(fieldId);
      const type: FieldType = field?.type ?? "text";
      const acc = accessors[fieldId];
      if (!acc) return { string: null, number: null, tokens: null, type };
      return {
        string: acc.filterString(move),
        number: acc.filterNumber ? acc.filterNumber(move) : null,
        tokens: acc.filterTokens ? acc.filterTokens(move) : null,
        type,
      };
    },
    [fieldMap, accessors],
  );

  const applyFilterItem = useCallback(
    (move: Move, item: FilterItem): boolean => {
      if (item.type === "group") {
        if (item.operator === "and") {
          return item.filters.every((f) => applyFilterItem(move, f));
        }
        return item.filters.some((f) => applyFilterItem(move, f));
      }
      const op = opsById.get(item.condition);
      if (!op) return true;
      const f = getFieldAs(move, item.field);
      return op.test({
        fieldType: f.type,
        fieldString: f.string,
        fieldNumber: f.number,
        fieldTokens: f.tokens,
        value: item.value,
        value2: item.value2,
      });
    },
    [opsById, getFieldAs],
  );

  const displayedMoves = useMemo(() => {
    if (originalMoves.length === 0) return [];
    let result = originalMoves;

    if (debouncedActiveFilters.length > 0) {
      result = result.filter((move) =>
        debouncedActiveFilters.every((filter) => applyFilterItem(move, filter)),
      );
    }

    if (sortColumn) {
      const acc = accessors[sortColumn];
      if (acc) {
        const comparator = createComparator(
          sortDirection,
          acc.sortType,
          acc.sortValue,
        );
        // toSorted is the immutable ES2023 variant — returns a new
        // sorted array in one step, no copy-then-mutate ceremony.
        result = result.toSorted(comparator);
      }
    }
    return result;
  }, [
    sortColumn,
    originalMoves,
    debouncedActiveFilters,
    sortDirection,
    applyFilterItem,
    accessors,
  ]);

  const deferredMoves = useDeferredValue(displayedMoves);
  const deferredSelectedCharacterId = useDeferredValue(selectedCharacterId);
  const deferredVisibleColumns = useDeferredValue(visibleColumns);
  const isStale = deferredMoves !== displayedMoves;

  const handleExport = (format: "csv" | "excel") => {
    const rows = displayedMoves;
    if (!rows || rows.length === 0) return;
    const headers = visibleColumns.map((c) => c.label);
    const fieldIds = visibleColumns.map((c) => c.id);

    // Build typed row data (numbers stay numbers so the Excel exporter can
    // tag numeric cells with x:num and Excel won't coerce them to text).
    const tableRows: ExportCell[][] = rows.map((m) =>
      fieldIds.map<ExportCell>((fid) => {
        const acc = accessors[fid];
        if (!acc) return "";
        const v = acc.exportValue(m);
        return (v as ExportCell) ?? "";
      }),
    );

    // Friendly filename: "SoulCalibur6_Astaroth" beats "SoulCalibur6_3".
    const characterLabel =
      selectedCharacterId === -1
        ? "All"
        : (characters.find((c) => c.id === selectedCharacterId)?.name ??
          String(selectedCharacterId));
    const basename = `${selectedGame.id || "export"}_${characterLabel}`;

    if (format === "excel") {
      exportExcel(headers, tableRows, basename);
    } else {
      exportCsv(headers, tableRows, basename);
    }
  };

  const handleFiltersChange = useCallback((filters: FilterItem[]) => {
    setActiveFilters(filters);
  }, []);

  useEffect(() => {
    setActiveFiltersCount(activeFilters.length);
  }, [activeFilters.length, setActiveFiltersCount]);

  useEffect(() => {
    exportHandler.current = handleExport;
    return () => {
      exportHandler.current = null;
    };
  }, [handleExport, exportHandler]);

  useEffect(() => {
    setTotalMoves(originalMoves.length);
  }, [originalMoves.length, setTotalMoves]);

  useEffect(() => {
    setFilteredMoves(deferredMoves.length);
  }, [deferredMoves.length, setFilteredMoves]);

  useEffect(() => {
    // `isUpdating` drives the navbar's "loading" affordances (skeleton
    // on the move-count badge, "…" suffix). We flip it true for any
    // in-flight state — cold initial load, background refetch, or a
    // stale deferred-value transition — so the navbar can show a
    // skeleton instead of a stale "0 / 0 moves" readout.
    setIsUpdating(movesLoading || isStale || isPlaceholderData);
  }, [movesLoading, isStale, isPlaceholderData, setIsUpdating]);

  if (error) {
    return (
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Try another character or game, or refresh the page.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full flex flex-col pl-4 pr-4 flex-grow">
      {selectedCharacterId ? (
        <div className="h-full flex flex-col overflow-hidden">
          <div className="pb-0 flex-shrink-0">
            {movesLoading && originalMoves.length === 0 ? (
              <div className="flex flex-wrap gap-2 p-4 border rounded-lg bg-card/50">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-10 w-24" />
              </div>
            ) : (
              <FilterBuilder onFiltersChange={handleFiltersChange} />
            )}
          </div>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div
              className={cn(
                "flex-1 min-h-0 h-full",
                (isStale || isPlaceholderData) &&
                  "opacity-70 transition-opacity",
              )}
            >
              <FrameDataTableContent
                moves={deferredMoves}
                movesLoading={movesLoading || isStale || isPlaceholderData}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                handleSort={handleSort}
                renderCommand={renderCommand}
                renderNotes={renderNotes}
                visibleColumns={deferredVisibleColumns}
                badges={selectedGame.badges}
                isAllCharacters={deferredSelectedCharacterId === -1}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="h-full flex flex-col pt-2">
          <div className="p-4 border rounded-lg bg-card/50 mb-4">
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
          <div className="flex-1 border rounded-lg overflow-hidden">
            <div className="p-4 space-y-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 flex-1" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
