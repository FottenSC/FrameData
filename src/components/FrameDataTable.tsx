import React, { useEffect, useState, useDeferredValue, useMemo, useCallback } from "react";
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
import { useCommand } from "../contexts/CommandContext";
import { useToolbar } from "../contexts/ToolbarContext";
import { Skeleton } from "./ui/skeleton";
import { cn } from "@/lib/utils";
import { FilterBuilder } from "./FilterBuilder";
import { CommandRenderer } from "@/components/renderers/CommandRenderer";
import { NotesRenderer } from "@/components/renderers/NotesRenderer";
import { FrameDataTableContent } from "@/components/table/FrameDataTableContent";
import { Move, FilterCondition, FilterItem, SortableColumn } from "../types/Move";
import { builtinOperators, operatorById } from "../filters/operators";
import { getGameFilterConfig } from "../filters/gameFilterConfigs";
import type { FieldConfig, FieldType, FilterOperator } from "../filters/types";
import { useMoves, clearNotationCache } from "@/hooks/useMoves";

const SORT_FIELD_MAP = {
  character: {
    getter: (move: Move) => move.characterName,
    type: "string" as const,
  },
  stance: {
    getter: (move: Move) => (move.stance ? move.stance.join(", ") : null),
    type: "string" as const,
  },
  command: {
    getter: (move: Move) => (move.command ? move.command.join(" ") : null),
    type: "string" as const,
  },
  rawCommand: {
    getter: (move: Move) => (move.stringCommand ? move.stringCommand : null),
    type: "string" as const,
  },
  input: {
    getter: (move: Move) =>
      [
        move.stance ? move.stance.join(" ") : null,
        move.command ? move.command.join(" ") : null,
      ]
        .filter(Boolean)
        .join(" "),
    type: "string" as const,
  },
  hitLevel: {
    getter: (move: Move) => (move.hitLevel ? move.hitLevel.join(" ") : null),
    type: "string" as const,
  },
  impact: {
    getter: (move: Move) => move.impact,
    type: "number" as const,
  },
  damage: {
    getter: (move: Move) => move.damageDec,
    type: "number" as const,
  },
  block: {
    getter: (move: Move) => move.blockDec,
    type: "number" as const,
  },
  hit: {
    getter: (move: Move) => move.hitDec,
    type: "number" as const,
  },
  counterHit: {
    getter: (move: Move) => move.counterHitDec,
    type: "number" as const,
  },
  guardBurst: {
    getter: (move: Move) => move.guardBurst,
    type: "number" as const,
  },
  properties: {
    getter: (move: Move) => (move.properties ? move.properties.join(" ") : null),
    type: "string" as const,
  },
  notes: {
    getter: (move: Move) => move.notes,
    type: "string" as const,
  },
};

const createOptimizedComparator = (
  direction: "asc" | "desc",
  fieldType: "string" | "number",
  getter: (move: Move) => any,
) => {
  const order = direction === "asc" ? 1 : -1;
  if (fieldType === "number") {
    return (a: Move, b: Move): number => {
      const valA = getter(a);
      const valB = getter(b);
      if (valA == null && valB == null) return 0;
      if (valA == null) return order;
      if (valB == null) return -order;
      return (valA - valB) * order;
    };
  } else {
    return (a: Move, b: Move): number => {
      const valA = getter(a);
      const valB = getter(b);
      if (valA == null && valB == null) return 0;
      if (valA == null) return order;
      if (valB == null) return -order;
      return String(valA).localeCompare(String(valB)) * order;
    };
  }
};

export const FrameDataTable: React.FC = () => {
  const params = useParams({ strict: false }) as { gameId?: string; characterName?: string };
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
    hitLevels,
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
    isPlaceholderData,
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
  const [activeFilters, setActiveFilters] = useState<FilterItem[]>([]);

  // Get visible columns from table configuration
  const baseColumns = getVisibleColumns();
  // Only show the Character column when viewing "All Characters"
  const visibleColumns = useMemo(() => 
    selectedCharacterId !== -1
      ? baseColumns.filter((c) => c.id !== "character")
      : baseColumns,
    [selectedCharacterId, baseColumns]
  );

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
          navigate({ to: `/${selectedGame.id}/${expectedUrlName}`, replace: true });
        }
      } else if (selectedChar) {
        const expectedUrlName = encodeURIComponent(selectedChar.name);
        const currentUrlName = characterName
          ? encodeURIComponent(decodeURIComponent(characterName))
          : undefined;

        if (expectedUrlName !== currentUrlName) {
          navigate({ to: `/${selectedGame.id}/${expectedUrlName}`, replace: true });
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
    if (!selectedGame) return;

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
      clearNotationCache();
      queryClient.invalidateQueries({ queryKey: ["moves"] });
      prevApplyNotationRef.current = applyNotation;
    }
  }, [applyNotation, queryClient]);

  const handleSort = useCallback((column: SortableColumn) => {
    if (sortColumn === column) {
      setSortDirection((prevDir) => (prevDir === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  }, [sortColumn]);

  const renderCommand = useCallback((command: string[] | null) => (
    <CommandRenderer command={command} />
  ), []);
  
  const renderNotes = useCallback((note: string | null) => (
    <NotesRenderer note={note} />
  ), []);

  const gameFilterConfig = useMemo(() => getGameFilterConfig(selectedGame.id, hitLevels), [selectedGame.id, hitLevels]);
  
  const fieldMap = useMemo(() => new Map<string, FieldConfig>(
    gameFilterConfig.fields.map((f) => [f.id, f]),
  ), [gameFilterConfig]);

  const allOperators: FilterOperator[] = useMemo(() => {
    const customs = gameFilterConfig.customOperators ?? [];
    const map = new Map<string, FilterOperator>();
    for (const op of builtinOperators) map.set(op.id, op);
    for (const op of customs) map.set(op.id, op);
    return Array.from(map.values());
  }, [gameFilterConfig]);

  const opsById = useMemo(() => operatorById(allOperators), [allOperators]);

  const getFieldAs = useCallback((
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
          string: move.characterName || null,
          number: null,
          type,
        };
      case "stance":
        return {
          string: move.stance ? move.stance.join(", ") : null,
          number: null,
          type,
        };
      case "command":
        return { string: move.command ? move.command.join(" ") : null, number: null, type };
      case "rawCommand":
        return { string: move.stringCommand, number: null, type };
      case "input": {
        const val = [
          move.stance ? move.stance.join(" ") : null,
          move.command ? move.command.join(" ") : null,
        ].filter(Boolean).join(" ");
        return { string: val, number: null, type };
      }
      case "hitLevel":
        return { string: move.hitLevel ? move.hitLevel.join(" ") : null, number: null, type };
      case "impact":
        return {
          string: move.impact != null ? String(move.impact) : null,
          number: move.impact ?? null,
          type,
        };
      case "damage":
        return {
          string:
            move.damageDec != null ? String(move.damageDec) : move.damage,
          number: move.damageDec ?? null,
          type,
        };
      case "block":
        return {
          string: move.blockDec != null ? String(move.blockDec) : move.block,
          number: move.blockDec ?? null,
          type,
        };
      case "hit":
        return {
          string: move.hitDec != null ? String(move.hitDec) : move.hit,
          number: move.hitDec ?? null,
          type,
        };
      case "counterHit":
        return {
          string:
            move.counterHitDec != null
              ? String(move.counterHitDec)
              : move.counterHit,
          number: move.counterHitDec ?? null,
          type,
        };
      case "guardBurst":
        return {
          string: move.guardBurst != null ? String(move.guardBurst) : null,
          number: move.guardBurst ?? null,
          type,
        };
      case "properties":
        return {
          string: move.properties ? move.properties.join(" ") : null,
          number: null,
          type,
        };
      case "notes":
        return { string: move.notes, number: null, type };
      default:
        return { string: null, number: null, type };
    }
  }, [fieldMap]);

  const applyFilterItem = useCallback((move: Move, item: FilterItem): boolean => {
    if (item.type === "group") {
      if (item.operator === "and") {
        return item.filters.every((f) => applyFilterItem(move, f));
      } else {
        return item.filters.some((f) => applyFilterItem(move, f));
      }
    } else {
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
    }
  }, [opsById, getFieldAs]);

  const displayedMoves = useMemo(() => {
    if (originalMoves.length === 0) return [];
    let result = originalMoves;

    if (activeFilters.length > 0) {
      result = result.filter((move) =>
        activeFilters.every((filter) => applyFilterItem(move, filter)),
      );
    }

    if (sortColumn) {
      const fieldConfig =
        SORT_FIELD_MAP[sortColumn as keyof typeof SORT_FIELD_MAP];
      if (fieldConfig) {
        // Create a copy before sorting to avoid mutating originalMoves or cached data
        result = [...result];
        const comparator = createOptimizedComparator(
          sortDirection,
          fieldConfig.type,
          fieldConfig.getter,
        );
        result.sort(comparator);
      }
    }
    return result;
  }, [sortColumn, originalMoves, activeFilters, sortDirection, applyFilterItem]);

  // Use deferred value to prevent blocking UI during heavy data processing
  const deferredMoves = useDeferredValue(displayedMoves);
  const deferredSelectedCharacterId = useDeferredValue(selectedCharacterId);
  const deferredVisibleColumns = useDeferredValue(visibleColumns);
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
              return m.characterName;
            case "stance":
              return m.stance ? m.stance.join(", ") : "";
            case "command":
              return m.command ? m.command.join(" ") : "";
            case "rawCommand":
              return m.stringCommand;
            case "input":
              return [m.stance ? m.stance.join(" ") : null, m.command ? m.command.join(" ") : null]
                .filter(Boolean)
                .join(" ");
            case "hitLevel":
              return m.hitLevel ? m.hitLevel.join(" ") : "";
            case "impact":
              return m.impact;
            case "damage":
              return m.damageDec ?? m.damage;
            case "block":
              return m.blockDec ?? m.block;
            case "hit":
              return m.hitDec ?? m.hit;
            case "counterHit":
              return m.counterHitDec ?? m.counterHit;
            case "guardBurst":
              return m.guardBurst;
            case "properties":
              return m.properties ? m.properties.join(", ") : "";
            case "notes":
              return m.notes;
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

  const handleFiltersChange = useCallback((filters: FilterItem[]) => {
    setActiveFilters(filters);
  }, []);

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
              />
            )}
          </div>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div
              className={cn(
                "flex-1 min-h-0 h-full",
                (isStale || isPlaceholderData) && "opacity-70 transition-opacity",
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
