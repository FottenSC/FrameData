import React, {
  useEffect,
  useState,
  useDeferredValue,
  useMemo,
  useCallback,
} from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { useGame } from "../contexts/GameContext";
import { useTableConfig } from "../contexts/UserSettingsContext";
import { useToolbar } from "../contexts/ToolbarContext";
import { Skeleton } from "./ui/skeleton";
import { cn } from "@/lib/utils";
import { FilterBuilder } from "./FilterBuilder";
import { CommandRenderer } from "@/components/renderers/CommandRenderer";
import { NotesRenderer } from "@/components/renderers/NotesRenderer";
import { FrameDataTableContent } from "@/components/table/FrameDataTableContent";
import { Move, FilterItem, SortableColumn, type Command } from "../types/Move";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { builtinOperators, operatorById } from "../filters/operators";
import { getGameFilterConfig } from "../filters/gameFilterConfigs";
import type { FieldConfig, FieldType, FilterOperator } from "../filters/types";
import { useMoves } from "@/hooks/useMoves";
import { buildFieldAccessors } from "@/lib/moveAccessors";
import { exportCsv, exportExcel, type ExportCell } from "@/lib/export";

export const FrameDataTable: React.FC = () => {
  // Navigation state is read straight off the route — `selectedGame` and
  // `selectedCharacterId` are derived from the URL inside GameContext, so
  // this component never has to sync the two.
  const {
    selectedGame,
    characters,
    selectedCharacterId,
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

  // `getVisibleColumns()` allocates a fresh array on every call, so it must
  // NOT be invoked bare in the render body — doing so would hand `useMemo` a
  // new `baseColumns` identity each render, defeating the memo and cascading
  // a fresh `visibleColumns` (and `deferredVisibleColumns`) through to every
  // memoised `TableRow`. Depending on the `useCallback`-stable
  // `getVisibleColumns` instead means this only recomputes when the column
  // config or the selected character actually changes.
  const visibleColumns = useMemo(() => {
    const cols = getVisibleColumns();
    return selectedCharacterId !== -1
      ? cols.filter((c) => c.id !== "character")
      : cols;
  }, [selectedCharacterId, getVisibleColumns]);

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

  // URL ↔ selection sync used to live here as two effects. It's gone:
  // GameContext derives `selectedGame` / `selectedCharacterId` from the
  // route, and the route loaders (router.tsx) redirect away invalid game
  // or character segments before this component ever renders.

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
    (command: Command | null) => <CommandRenderer command={command} />,
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

  const filteredMovesForTable = useMemo(() => {
    if (originalMoves.length === 0) return [];
    let result = originalMoves;

    if (debouncedActiveFilters.length > 0) {
      result = result.filter((move) =>
        debouncedActiveFilters.every((filter) => applyFilterItem(move, filter)),
      );
    }
    return result;
  }, [originalMoves, debouncedActiveFilters, applyFilterItem]);

  const sorting = useMemo<SortingState>(
    () =>
      sortColumn ? [{ id: sortColumn, desc: sortDirection === "desc" }] : [],
    [sortColumn, sortDirection],
  );

  const tableColumns = useMemo<ColumnDef<Move>[]>(() => {
    const ids = new Set<string>(visibleColumns.map((c) => c.id));
    if (sortColumn) ids.add(sortColumn);
    return Array.from(ids).map((id) => {
      const acc = accessors[id];
      return {
        id,
        accessorFn: (move) => {
          const value = acc?.sortValue(move);
          return value == null ? undefined : value;
        },
        sortingFn: acc?.sortType === "number" ? "basic" : "alphanumeric",
        sortUndefined: "last",
      };
    });
  }, [accessors, sortColumn, visibleColumns]);

  const table = useReactTable({
    data: filteredMovesForTable,
    columns: tableColumns,
    state: { sorting },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const displayedMoves = useMemo(
    () => table.getRowModel().rows.map((row) => row.original),
    [table, filteredMovesForTable, sorting],
  );

  const deferredMoves = useDeferredValue(displayedMoves);
  const deferredSelectedCharacterId = useDeferredValue(selectedCharacterId);
  const deferredVisibleColumns = useDeferredValue(visibleColumns);
  const isStale = deferredMoves !== displayedMoves;

  const handleExport = useCallback(
    (format: "csv" | "excel") => {
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
    },
    [
      displayedMoves,
      visibleColumns,
      accessors,
      selectedCharacterId,
      characters,
      selectedGame.id,
    ],
  );

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
    <div className="h-full flex flex-col pl-4 pr-4 grow">
      {selectedCharacterId ? (
        <div className="h-full flex flex-col overflow-hidden">
          <div className="pb-0 shrink-0">
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
