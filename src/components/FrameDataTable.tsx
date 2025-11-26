import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  useDeferredValue,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
// Table rendering moved into FrameDataTableContent
import { ChevronRight, Download, Settings2, Languages, MoreVertical } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
// Badge usage moved into ValueBadge
import { useGame, avaliableGames } from "../contexts/GameContext";
import { useTableConfig } from "../contexts/UserSettingsContext";
import { useCommand } from "../contexts/CommandContext";
import { cn } from "@/lib/utils";
import { FilterBuilder, ActiveFiltersBadge } from "./FilterBuilder";
import { CommandRenderer } from "@/components/renderers/CommandRenderer";
import { NotesRenderer } from "@/components/renderers/NotesRenderer";
import { FrameDataTableContent } from "@/components/table/FrameDataTableContent";
import { Move, FilterCondition, SortableColumn } from "../types/Move";
import { builtinOperators, operatorById } from "../filters/operators";
import { gameFilterConfigs } from "../filters/gameFilterConfigs";
import type { FieldConfig, FieldType, FilterOperator } from "../filters/types";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./ui/dropdown-menu";
import { useMoves } from "@/hooks/useMoves";

import { FrameDataTableContent as MemoizedDataTableContent } from "@/components/table/FrameDataTableContent";

export const FrameDataTable: React.FC = () => {
  const params = useParams<{ gameId?: string; characterName?: string }>();
  const { gameId, characterName } = params;

  const navigate = useNavigate();
  const {
    selectedGame,
    setSelectedGameById,
    characters,
    setCharacters,
    selectedCharacterId,
    setSelectedCharacterId,
    availableIcons,
    getIconUrl,
    applyNotation,
  } = useGame();

  // Add table configuration context
  const { getVisibleColumns, updateColumnVisibility } = useTableConfig();
  const { openView } = useCommand();
  const queryClient = useQueryClient();

  // Use TanStack Query for data fetching with automatic caching
  const {
    data: originalMoves = [],
    isLoading: movesLoading,
    error: movesError,
  } = useMoves({
    gameId: selectedGame?.id,
    characterId: selectedCharacterId,
    applyNotation,
    characters,
  });

  const error = movesError ? (movesError as Error).message : null;

  // --- Sorting State ---
  const [sortColumn, setSortColumn] = useState<SortableColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Add state for filters
  const [activeFilters, setActiveFilters] = useState<FilterCondition[]>([]);

  // Add state for filters visibility
  const [filtersVisible, setFiltersVisible] = useState<boolean>(true);

  // Get visible columns from table configuration
  const baseColumns = getVisibleColumns();
  // Only show the Character column when viewing "All Characters"
  const visibleColumns = useMemo(() => {
    if (selectedCharacterId !== -1) {
      return baseColumns.filter((c) => c.id !== "character");
    }
    return baseColumns;
  }, [baseColumns, selectedCharacterId]);

  // Persist column visibility preference so it auto-toggles with page mode
  useEffect(() => {
    if (selectedCharacterId === -1) {
      updateColumnVisibility("character", true);
    } else if (selectedCharacterId !== null) {
      updateColumnVisibility("character", false);
    }
  }, [selectedCharacterId, updateColumnVisibility]);

  // If leaving All Characters view, clear sorting on the hidden 'character' column
  useEffect(() => {
    if (selectedCharacterId !== -1 && sortColumn === "character") {
      setSortColumn(null);
    }
  }, [selectedCharacterId, sortColumn]);

  // Toggle filters visibility (Memoized)
  const toggleFiltersVisibility = useCallback(() => {
    setFiltersVisible((prev) => !prev);
  }, []);

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
          navigate(`/${selectedGame.id}/${expectedUrlName}`, {
            replace: true,
          });
        }
      } else if (selectedChar) {
        const expectedUrlName = encodeURIComponent(selectedChar.name);
        const currentUrlName = characterName
          ? encodeURIComponent(decodeURIComponent(characterName))
          : undefined;

        if (expectedUrlName !== currentUrlName) {
          navigate(`/${selectedGame.id}/${expectedUrlName}`, {
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

  // Track if we've done initial URL sync for game
  const initialGameSyncDoneRef = React.useRef(false);
  
  // Handle URL parameters and initial character selection
  useEffect(() => {
    if (!selectedGame.id) return;

    // Only sync game from URL on initial load when the component mounts
    // After that, trust the selectedGame state (which is updated by command palette etc.)
    if (gameId && gameId !== selectedGame.id && !initialGameSyncDoneRef.current) {
      const game = avaliableGames.find((g) => g.id === gameId);
      if (game) {
        setSelectedGameById(gameId);
        initialGameSyncDoneRef.current = true;
        return;
      }
    }
    
    // Mark initial sync as done even if games matched
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

  // Invalidate query cache when notation changes
  const prevApplyNotationRef = React.useRef(applyNotation);
  useEffect(() => {
    if (prevApplyNotationRef.current !== applyNotation) {
      queryClient.invalidateQueries({ queryKey: ["moves"] });
      prevApplyNotationRef.current = applyNotation;
    }
  }, [applyNotation, queryClient]);

  const handleSort = useCallback(
    (column: SortableColumn) => {
      if (sortColumn === column) {
        setSortDirection((prevDir) => (prevDir === "asc" ? "desc" : "asc"));
      } else {
        setSortColumn(column);
        setSortDirection("asc");
      }
    },
    [sortColumn],
  );

  const renderCommand = useCallback(
    (command: string | null) => <CommandRenderer command={command} />,
    [],
  );
  const renderNotes = useCallback(
    (note: string | null) => <NotesRenderer note={note} />,
    [],
  );

  const gameFilterConfig = useMemo(
    () => gameFilterConfigs[selectedGame.id] ?? { fields: [] },
    [selectedGame.id],
  );
  const fieldMap = useMemo(
    () =>
      new Map<string, FieldConfig>(
        gameFilterConfig.fields.map((f) => [f.id, f]),
      ),
    [gameFilterConfig.fields],
  );
  const allOperators: FilterOperator[] = useMemo(() => {
    const customs = gameFilterConfig.customOperators ?? [];
    const map = new Map<string, FilterOperator>();
    for (const op of builtinOperators) map.set(op.id, op);
    for (const op of customs) map.set(op.id, op);
    return Array.from(map.values());
  }, [gameFilterConfig]);
  const opsById = useMemo(() => operatorById(allOperators), [allOperators]);

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
      switch (fieldId) {
        case "character":
          return {
            string: move.CharacterName || null,
            number: null,
            type,
          };
        case "stance":
          return {
            string: move.Stance ? move.Stance.join(", ") : null,
            number: null,
            type,
          };
        case "command":
        case "rawCommand":
          return { string: move.Command, number: null, type };
        case "input": {
          // combined stance + command
          const stanceStr = move.Stance ? move.Stance.join(" ") : null;
          const combined =
            [stanceStr, move.Command].filter(Boolean).join(" ") || null;
          return { string: combined, number: null, type };
        }
        case "hitLevel":
          return { string: move.HitLevel, number: null, type };
        case "impact":
          return {
            string: move.Impact != null ? String(move.Impact) : null,
            number: move.Impact ?? null,
            type,
          };
        case "damage":
          return {
            string:
              move.DamageDec != null ? String(move.DamageDec) : move.Damage,
            number: move.DamageDec ?? null,
            type,
          };
        case "block":
          return {
            string: move.BlockDec != null ? String(move.BlockDec) : move.Block,
            number: move.BlockDec ?? null,
            type,
          };
        case "hit":
          return {
            string: move.HitDec != null ? String(move.HitDec) : move.Hit,
            number: move.HitDec ?? null,
            type,
          };
        case "counterHit":
          return {
            string:
              move.CounterHitDec != null
                ? String(move.CounterHitDec)
                : move.CounterHit,
            number: move.CounterHitDec ?? null,
            type,
          };
        case "guardBurst":
          return {
            string: move.GuardBurst != null ? String(move.GuardBurst) : null,
            number: move.GuardBurst ?? null,
            type,
          };
        case "notes":
          return { string: move.Notes, number: null, type };
        default:
          return { string: null, number: null, type };
      }
    },
    [fieldMap],
  );

  type ProcessedFilter = FilterCondition & {
    value1?: string;
    value2?: string;
  };
  const processedFilters = useMemo((): ProcessedFilter[] => {
    return activeFilters.map((f) => ({
      ...f,
      value1: f.value,
      value2: f.value2,
    }));
  }, [activeFilters]);

  const applyFilter = useCallback(
    (move: Move, filter: ProcessedFilter): boolean => {
      const op = opsById.get(filter.condition);
      if (!op) return true;
      const f = getFieldAs(move, filter.field);
      return op.test({
        fieldType: f.type,
        fieldString: f.string,
        fieldNumber: f.number,
        value: filter.value1,
        value2: filter.value2,
      });
    },
    [opsById, getFieldAs],
  );

  const SORT_FIELD_MAP = useMemo(
    () => ({
      character: {
        getter: (move: Move) => move.CharacterName,
        type: "string" as const,
      },
      stance: {
        getter: (move: Move) => (move.Stance ? move.Stance.join(", ") : null),
        type: "string" as const,
      },
      command: {
        getter: (move: Move) => move.Command,
        type: "string" as const,
      },
      rawCommand: {
        getter: (move: Move) => move.Command,
        type: "string" as const,
      },
      input: {
        getter: (move: Move) =>
          [move.Stance ? move.Stance.join(" ") : null, move.Command]
            .filter(Boolean)
            .join(" "),
        type: "string" as const,
      },
      hitLevel: {
        getter: (move: Move) => move.HitLevel,
        type: "string" as const,
      },
      impact: {
        getter: (move: Move) => move.Impact,
        type: "number" as const,
      },
      damage: {
        getter: (move: Move) => move.DamageDec,
        type: "number" as const,
      },
      block: {
        getter: (move: Move) => move.BlockDec,
        type: "number" as const,
      },
      hit: {
        getter: (move: Move) => move.HitDec,
        type: "number" as const,
      },
      counterHit: {
        getter: (move: Move) => move.CounterHitDec,
        type: "number" as const,
      },
      guardBurst: {
        getter: (move: Move) => move.GuardBurst,
        type: "number" as const,
      },
      notes: {
        getter: (move: Move) => move.Notes,
        type: "string" as const,
      },
    }),
    [],
  );

  const movesWithSortValues = useMemo(() => {
    if (!sortColumn || originalMoves.length === 0) return originalMoves;
    const fieldConfig =
      SORT_FIELD_MAP[sortColumn as keyof typeof SORT_FIELD_MAP];
    if (!fieldConfig) return originalMoves;
    return originalMoves.map((move) => ({
      ...move,
      _sortValue: fieldConfig.getter(move),
    }));
  }, [originalMoves, sortColumn, SORT_FIELD_MAP]);

  const createOptimizedComparator = useCallback(
    (direction: "asc" | "desc", fieldType: "string" | "number") => {
      const order = direction === "asc" ? 1 : -1;
      if (fieldType === "number") {
        return (
          a: Move & { _sortValue?: any },
          b: Move & { _sortValue?: any },
        ): number => {
          const valA = a._sortValue;
          const valB = b._sortValue;
          if (valA == null && valB == null) return 0;
          if (valA == null) return order;
          if (valB == null) return -order;
          return (valA - valB) * order;
        };
      } else {
        return (
          a: Move & { _sortValue?: any },
          b: Move & { _sortValue?: any },
        ): number => {
          const valA = a._sortValue;
          const valB = b._sortValue;
          if (valA == null && valB == null) return 0;
          if (valA == null) return order;
          if (valB == null) return -order;
          return String(valA).localeCompare(String(valB)) * order;
        };
      }
    },
    [],
  );

  const displayedMoves = useMemo(() => {
    const sourceMoves = sortColumn ? movesWithSortValues : originalMoves;
    if (sourceMoves.length === 0) return [];
    let result = sourceMoves;
    if (processedFilters.length > 0) {
      result = result.filter((move) =>
        processedFilters.every((filter) => applyFilter(move, filter)),
      );
    }
    if (sortColumn) {
      if (result === sourceMoves) {
        result = [...result];
      }
      const fieldConfig =
        SORT_FIELD_MAP[sortColumn as keyof typeof SORT_FIELD_MAP];
      if (fieldConfig) {
        const comparator = createOptimizedComparator(
          sortDirection,
          fieldConfig.type,
        );
        result.sort(comparator);
      }
    }
    return result;
  }, [
    movesWithSortValues,
    originalMoves,
    processedFilters,
    sortColumn,
    sortDirection,
    applyFilter,
    createOptimizedComparator,
    SORT_FIELD_MAP,
  ]);

  // Use deferred value to prevent blocking UI during heavy data processing
  const deferredMoves = useDeferredValue(displayedMoves);
  const isStale = deferredMoves !== displayedMoves;

  // Export handlers
  const handleExport = useCallback(
    (format: "csv" | "excel") => {
      // Use currently visible (filtered + sorted) moves
      const rows = displayedMoves;
      if (!rows || rows.length === 0) return;
      // Build headers from visible columns (skip non-data if any)
      const headers = visibleColumns.map((c) => c.label);
      const fieldIds = visibleColumns.map((c) => c.id);
      const escape = (v: any) => {
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
            switch (fid) {
              case "character":
                return m.CharacterName;
              case "stance":
                return m.Stance ? m.Stance.join(", ") : "";
              case "command":
              case "rawCommand":
                return m.Command;
              case "input":
                return [m.Stance ? m.Stance.join(" ") : null, m.Command]
                  .filter(Boolean)
                  .join(" ");
              case "hitLevel":
                return m.HitLevel;
              case "impact":
                return m.Impact;
              case "damage":
                return m.DamageDec ?? m.Damage;
              case "block":
                return m.BlockDec ?? m.Block;
              case "hit":
                return m.HitDec ?? m.Hit;
              case "counterHit":
                return m.CounterHitDec ?? m.CounterHit;
              case "guardBurst":
                return m.GuardBurst;
              case "notes":
                return m.Notes;
              default:
                return "";
            }
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
      a.download = `${selectedGame.id || "export"}_${selectedCharacterId === -1 ? "All" : selectedCharacterId}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [displayedMoves, visibleColumns, selectedGame.id, selectedCharacterId],
  );

  const handleFiltersChange = useCallback((filters: FilterCondition[]) => {
    setActiveFilters(filters);
  }, []);

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

  const selectedCharacterNameFromContext =
    selectedCharacterId === -1
      ? "All Characters"
      : selectedCharacterId
        ? characters.find((c) => c.id === selectedCharacterId)?.name
        : null;

  return (
    <div className="space-y-6 h-full flex flex-col pl-4 pr-4 flex-grow">
      {selectedCharacterId ? (
        <Card className="h-full flex flex-col overflow-hidden border border-card-border">
          <CardHeader className="pb-2 flex-shrink-0">
            <div className="flex justify-between items-center">
              <div
                className="flex items-center cursor-pointer group title-interactive"
                onClick={toggleFiltersVisibility}
                title={
                  filtersVisible
                    ? "Click to hide filters"
                    : "Click to show filters"
                }
              >
                <CardTitle className="flex items-center">
                  {selectedCharacterNameFromContext || "Character"} Frame Data
                  <ChevronRight
                    className={cn(
                      "ml-2 h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:text-foreground",
                      filtersVisible ? "transform rotate-90" : "",
                    )}
                  />
                </CardTitle>
                <ActiveFiltersBadge count={activeFilters.length} />
              </div>
              <CardDescription className="m-0 flex items-center gap-2">
                {/* Desktop view - visible on md and up */}
                <span className="hidden md:inline">
                  Total Moves: {deferredMoves.length}{" "}
                  {originalMoves.length !== deferredMoves.length
                    ? `(filtered from ${originalMoves.length})`
                    : ""}
                  {isStale && " (updating...)"}
                </span>
                <button
                  onClick={() => openView("tableConfig")}
                  className="hidden md:inline-flex items-center justify-center p-1.5 text-muted-foreground hover:text-foreground rounded-md border border-border bg-secondary/30 hover:bg-secondary/50 active:scale-95 active:bg-secondary/70 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                  title="Table Configuration"
                >
                  <Settings2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => openView("notationMappings")}
                  className="hidden md:inline-flex items-center justify-center p-1.5 text-muted-foreground hover:text-foreground rounded-md border border-border bg-secondary/30 hover:bg-secondary/50 active:scale-95 active:bg-secondary/70 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                  title="Notation Mappings"
                >
                  <Languages className="h-4 w-4" />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="hidden md:inline-flex items-center justify-center p-1.5 text-muted-foreground hover:text-foreground rounded-md border border-border bg-secondary/30 hover:bg-secondary/50 active:scale-95 active:bg-secondary/70 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                      title="Export"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="bg-card/95 backdrop-blur-sm border-border shadow-lg"
                  >
                    <DropdownMenuItem onClick={() => handleExport("csv")}>
                      Export to CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport("excel")}>
                      Export to Excel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Mobile view - visible below md */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="md:hidden inline-flex items-center justify-center p-1.5 text-muted-foreground hover:text-foreground rounded-md border border-border bg-secondary/30 hover:bg-secondary/50 active:scale-95 active:bg-secondary/70 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                      title="Options"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="bg-card/95 backdrop-blur-sm border-border shadow-lg min-w-[180px]"
                  >
                    <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                      Total Moves: {deferredMoves.length}{" "}
                      {originalMoves.length !== deferredMoves.length
                        ? `(filtered from ${originalMoves.length})`
                        : ""}
                      {isStale && " (updating...)"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openView("tableConfig")}>
                      <Settings2 className="h-4 w-4 mr-2" />
                      Table Configuration
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openView("notationMappings")}>
                      <Languages className="h-4 w-4 mr-2" />
                      Notation Mappings
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport("csv")}>
                      <Download className="h-4 w-4 mr-2" />
                      Export to CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport("excel")}>
                      <Download className="h-4 w-4 mr-2" />
                      Export to Excel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardDescription>
            </div>

            <div
              className={cn(
                "filter-container",
                filtersVisible ? "visible" : "hidden",
                activeFilters.length === 0 ? "empty" : "",
              )}
            >
              <FilterBuilder
                onFiltersChange={handleFiltersChange}
                moves={originalMoves}
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 p-0 flex flex-col overflow-hidden">
            <div className={cn("flex-1 min-h-0 h-full", isStale && "opacity-70 transition-opacity")}>
              <MemoizedDataTableContent
                moves={deferredMoves}
                movesLoading={movesLoading || isStale}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                handleSort={handleSort}
                renderCommand={renderCommand}
                renderNotes={renderNotes}
                visibleColumns={visibleColumns}
                badges={selectedGame.badges}
                isAllCharacters={selectedCharacterId === -1}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-center justify-center h-48 border rounded-lg bg-muted/40">
          <p className="text-muted-foreground">
            {characters.length > 0
              ? "Select a character to view frame data"
              : "No characters loaded."}
          </p>
        </div>
      )}
    </div>
  );
};
