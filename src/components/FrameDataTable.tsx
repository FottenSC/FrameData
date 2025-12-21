import React, { useEffect, useState, useDeferredValue, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { useCommand } from "../contexts/CommandContext";
import { useToolbar } from "../contexts/ToolbarContext";
import { Skeleton } from "./ui/skeleton";
import { cn } from "@/lib/utils";
import { FilterBuilder } from "./FilterBuilder";
import { CommandRenderer } from "@/components/renderers/CommandRenderer";
import { NotesRenderer } from "@/components/renderers/NotesRenderer";
import { FrameDataTableContent } from "@/components/table/FrameDataTableContent";
import { Move, FilterCondition, SortableColumn } from "../types/Move";
import { builtinOperators, operatorById } from "../filters/operators";
import { gameFilterConfigs } from "../filters/gameFilterConfigs";
import type { FieldConfig, FieldType, FilterOperator } from "../filters/types";
import { useMoves } from "@/hooks/useMoves";

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
  const {
    setActiveFiltersCount,
    exportHandler,
    setTotalMoves,
    setFilteredMoves,
    setIsUpdating,
  } = useToolbar();
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

  // Get visible columns from table configuration
  const baseColumns = getVisibleColumns();
  // Only show the Character column when viewing "All Characters"
  const visibleColumns =
    selectedCharacterId !== -1
      ? baseColumns.filter((c) => c.id !== "character")
      : baseColumns;

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

  const handleSort = (column: SortableColumn) => {
    if (sortColumn === column) {
      setSortDirection((prevDir) => (prevDir === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const renderCommand = (command: string[] | null) => (
    <CommandRenderer command={command} />
  );
  const renderNotes = (note: string | null) => <NotesRenderer note={note} />;

  const gameFilterConfig = gameFilterConfigs[selectedGame.id] ?? { fields: [] };
  const fieldMap = new Map<string, FieldConfig>(
    gameFilterConfig.fields.map((f) => [f.id, f]),
  );
  const allOperators: FilterOperator[] = (() => {
    const customs = gameFilterConfig.customOperators ?? [];
    const map = new Map<string, FilterOperator>();
    for (const op of builtinOperators) map.set(op.id, op);
    for (const op of customs) map.set(op.id, op);
    return Array.from(map.values());
  })();
  const opsById = operatorById(allOperators);

  const getFieldAs = (
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
        return { string: move.Command ? move.Command.join(" ") : null, number: null, type };
      case "rawCommand":
        return { string: move.stringCommand, number: null, type };
      case "input": {
        // combined stance + command
        const stanceStr = move.Stance ? move.Stance.join(" ") : null;
        const commandStr = move.Command ? move.Command.join(" ") : null;
        const combined =
          [stanceStr, commandStr].filter(Boolean).join(" ") || null;
        return { string: combined, number: null, type };
      }
      case "hitLevel":
        return { string: move.HitLevel ? move.HitLevel.join(" ") : null, number: null, type };
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
      case "properties":
        return {
          string: move.Properties ? move.Properties.join(" ") : null,
          number: null,
          type,
        };
      case "notes":
        return { string: move.Notes, number: null, type };
      default:
        return { string: null, number: null, type };
    }
  };

  type ProcessedFilter = FilterCondition & {
    value1?: string;
    value2?: string;
  };
  const processedFilters: ProcessedFilter[] = useMemo(
    () =>
      activeFilters.map((f) => ({
        ...f,
        value1: f.value,
        value2: f.value2,
      })),
    [activeFilters],
  );

  const applyFilter = (move: Move, filter: ProcessedFilter): boolean => {
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
  };

  const SORT_FIELD_MAP = {
    character: {
      getter: (move: Move) => move.CharacterName,
      type: "string" as const,
    },
    stance: {
      getter: (move: Move) => (move.Stance ? move.Stance.join(", ") : null),
      type: "string" as const,
    },
    command: {
      getter: (move: Move) => move.Command ? move.Command.join(" ") : null,
      type: "string" as const,
    },
    rawCommand: {
      getter: (move: Move) => move.stringCommand ? move.stringCommand : null,
      type: "string" as const,
    },
    input: {
      getter: (move: Move) =>
        [move.Stance ? move.Stance.join(" ") : null, move.Command ? move.Command.join(" ") : null]
          .filter(Boolean)
          .join(" "),
      type: "string" as const,
    },
    hitLevel: {
      getter: (move: Move) => (move.HitLevel ? move.HitLevel.join(" ") : null),
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
    properties: {
      getter: (move: Move) => (move.Properties ? move.Properties.join(" ") : null),
      type: "string" as const,
    },
    notes: {
      getter: (move: Move) => move.Notes,
      type: "string" as const,
    },
  };

  const movesWithSortValues = useMemo(
    () =>
      !sortColumn || originalMoves.length === 0
        ? originalMoves
        : (() => {
            const fieldConfig =
              SORT_FIELD_MAP[sortColumn as keyof typeof SORT_FIELD_MAP];
            if (!fieldConfig) return originalMoves;
            return originalMoves.map((move) => ({
              ...move,
              _sortValue: fieldConfig.getter(move),
            }));
          })(),
    [sortColumn, originalMoves],
  );

  const createOptimizedComparator = (
    direction: "asc" | "desc",
    fieldType: "string" | "number",
  ) => {
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
  };

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
  }, [sortColumn, movesWithSortValues, originalMoves, processedFilters, sortDirection]);

  // Use deferred value to prevent blocking UI during heavy data processing
  const deferredMoves = useDeferredValue(displayedMoves);
  const isStale = deferredMoves !== displayedMoves;

  const handleExport = (format: "csv" | "excel") => {
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
              return m.Command ? m.Command.join(" ") : "";
            case "rawCommand":
              return m.Command ? m.Command.join("::") : "";
            case "input":
              return [m.Stance ? m.Stance.join(" ") : null, m.Command ? m.Command.join(" ") : null]
                .filter(Boolean)
                .join(" ");
            case "hitLevel":
              return m.HitLevel ? m.HitLevel.join(" ") : "";
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
  };

  const handleFiltersChange = (filters: FilterCondition[]) => {
    setActiveFilters(filters);
  };

  // Sync toolbar context with current state
  useEffect(() => {
    setActiveFiltersCount(activeFilters.length);
  }, [activeFilters.length, setActiveFiltersCount]);

  // Keep export handler ref updated
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
    setIsUpdating(isStale);
  }, [isStale, setIsUpdating]);

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
          <div className="pb-2 flex-shrink-0">
            {movesLoading && originalMoves.length === 0 ? (
              <div className="flex flex-wrap gap-2 p-4 border rounded-lg bg-card/50">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-10 w-24" />
              </div>
            ) : (
              <FilterBuilder
                onFiltersChange={handleFiltersChange}
                moves={originalMoves}
              />
            )}
          </div>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div
              className={cn(
                "flex-1 min-h-0 h-full",
                isStale && "opacity-70 transition-opacity",
              )}
            >
              <FrameDataTableContent
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
