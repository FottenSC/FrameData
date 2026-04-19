import React, {
  useEffect,
  useState,
  useDeferredValue,
  useMemo,
  useCallback,
} from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
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
import { useMoves, clearNotationCache } from "@/hooks/useMoves";
import { getAccessor } from "@/lib/moveAccessors";
import { matchesQuickSearch, parseQuickSearch } from "@/lib/quickSearch";

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
  if (fieldType === "number") {
    return (a: Move, b: Move): number => {
      const valA = getter(a) as number | null;
      const valB = getter(b) as number | null;
      if (valA == null && valB == null) return 0;
      if (valA == null) return order;
      if (valB == null) return -order;
      return (valA - valB) * order;
    };
  }
  return (a: Move, b: Move): number => {
    const valA = getter(a);
    const valB = getter(b);
    if (valA == null && valB == null) return 0;
    if (valA == null) return order;
    if (valB == null) return -order;
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
    applyNotation,
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
  const queryClient = useQueryClient();

  const {
    data: originalMoves = [],
    isLoading: movesLoading,
    isPlaceholderData,
    error: movesError,
  } = useMoves({
    gameId: selectedGame?.id,
    characterId: selectedCharacterId,
    applyNotation,
    characters,
  });

  const error = movesError ? (movesError as Error).message : null;

  // --- Sorting state ---
  const [sortColumn, setSortColumn] = useState<SortableColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [activeFilters, setActiveFilters] = useState<FilterItem[]>([]);
  const [quickSearchRaw, setQuickSearchRaw] = useState("");
  // Parse the quick-search once per change and reuse across every row.
  const parsedQuickSearch = useMemo(
    () => parseQuickSearch(quickSearchRaw),
    [quickSearchRaw],
  );

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

  const prevApplyNotationRef = React.useRef(applyNotation);
  useEffect(() => {
    if (prevApplyNotationRef.current !== applyNotation) {
      clearNotationCache();
      queryClient.invalidateQueries({ queryKey: ["moves"] });
      prevApplyNotationRef.current = applyNotation;
    }
  }, [applyNotation, queryClient]);

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
    (command: string[] | null) => <CommandRenderer command={command} />,
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
  // registry defines — for each column id — a `filterString` and (optionally)
  // a `filterNumber` projection. We just look up the bundle and call through.
  const getFieldAs = useCallback(
    (
      move: Move,
      fieldId: string,
    ): {
      string: string | null;
      number: number | null;
      type: FieldType;
    } => {
      const field = fieldMap.get(fieldId);
      const type: FieldType = field?.type ?? "text";
      const acc = getAccessor(fieldId);
      if (!acc) return { string: null, number: null, type };
      return {
        string: acc.filterString(move),
        number: acc.filterNumber ? acc.filterNumber(move) : null,
        type,
      };
    },
    [fieldMap],
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
        value: item.value,
        value2: item.value2,
      });
    },
    [opsById, getFieldAs],
  );

  const displayedMoves = useMemo(() => {
    if (originalMoves.length === 0) return [];
    let result = originalMoves;

    // Quick-search runs BEFORE the advanced-filter pipeline because it's
    // usually the biggest narrowing step (e.g. `char:amy` drops 90%+ of All
    // Characters before any structured filters need to evaluate).
    if (!parsedQuickSearch.isEmpty) {
      result = result.filter((move) =>
        matchesQuickSearch(move, parsedQuickSearch),
      );
    }

    if (activeFilters.length > 0) {
      result = result.filter((move) =>
        activeFilters.every((filter) => applyFilterItem(move, filter)),
      );
    }

    if (sortColumn) {
      const acc = getAccessor(sortColumn);
      if (acc) {
        result = [...result];
        const comparator = createComparator(
          sortDirection,
          acc.sortType,
          acc.sortValue,
        );
        result.sort(comparator);
      }
    }
    return result;
  }, [
    sortColumn,
    originalMoves,
    activeFilters,
    parsedQuickSearch,
    sortDirection,
    applyFilterItem,
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
    const escape = (v: unknown) => {
      if (v == null) return "";
      const s = String(v);
      if (/[,"\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const dataLines: string[] = [];
    dataLines.push(headers.map(escape).join(","));
    for (const m of rows) {
      const line = fieldIds
        .map((fid) => {
          const acc = getAccessor(fid);
          return acc ? acc.exportValue(m) : "";
        })
        .map(escape)
        .join(",");
      dataLines.push(line);
    }
    const csv = dataLines.join("\n");
    const blob = new Blob([csv], {
      type:
        format === "excel"
          ? "application/vnd.ms-excel"
          : "text/csv;charset=utf-8;",
    });
    const ext = format === "excel" ? "xls" : "csv";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedGame.id || "export"}_${
      selectedCharacterId === -1 ? "All" : selectedCharacterId
    }.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFiltersChange = useCallback((filters: FilterItem[]) => {
    setActiveFilters(filters);
  }, []);

  const handleQuickSearchChange = useCallback((q: string) => {
    setQuickSearchRaw(q);
  }, []);

  // The toolbar badge counts everything that's actively narrowing the list —
  // advanced filters and a non-empty quick-search (as one).
  useEffect(() => {
    const quickActive = parsedQuickSearch.isEmpty ? 0 : 1;
    setActiveFiltersCount(activeFilters.length + quickActive);
  }, [activeFilters.length, parsedQuickSearch, setActiveFiltersCount]);

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
    setIsUpdating(isStale || isPlaceholderData);
  }, [isStale, isPlaceholderData, setIsUpdating]);

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
              <FilterBuilder
                onFiltersChange={handleFiltersChange}
                onQuickSearchChange={handleQuickSearchChange}
              />
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
