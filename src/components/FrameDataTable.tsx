import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
// Table rendering moved into FrameDataTableContent
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
// Badge usage moved into ValueBadge
import { useGame, avaliableGames } from "../contexts/GameContext";
import { useTableConfig } from "../contexts/TableConfigContext";
import { cn } from "@/lib/utils";
import { FilterBuilder, ActiveFiltersBadge } from "./FilterBuilder";
import { CommandRenderer } from "@/components/renderers/CommandRenderer";
import { NotesRenderer } from "@/components/renderers/NotesRenderer";
import { FrameDataTableContent } from "@/components/table/FrameDataTableContent";
import { Move, FilterCondition, SortableColumn } from "../types/Move";
import { builtinOperators, operatorById } from "../filters/operators";
import { gameFilterConfigs } from "../filters/gameFilterConfigs";
import type { FieldConfig, FieldType, FilterOperator } from "../filters/types";




import { FrameDataTableContent as MemoizedDataTableContent } from "@/components/table/FrameDataTableContent";
export const FrameDataTable: React.FC = () => {
    const params = useParams<{ gameId?: string; characterName?: string }>();
    const { gameId, characterName } = params;

    const navigate = useNavigate();
    const { selectedGame, setSelectedGameById, characters, setCharacters, selectedCharacterId, setSelectedCharacterId, availableIcons, getIconUrl, translateText } = useGame();

    // Add table configuration context
    const { getVisibleColumns, updateColumnVisibility } = useTableConfig();
    const [originalMoves, setOriginalMoves] = useState<Move[]>([]);
    const [movesLoading, setMovesLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [deployTimestamp, setDeployTimestamp] = useState<string>("Loading...");

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
        if (selectedCharacterId !== null && characters.length > 0 && selectedGame.id) {
            const selectedChar = characters.find((c) => c.id === selectedCharacterId);
            if (selectedCharacterId === -1) {
                const expectedUrlName = encodeURIComponent("All");
                const currentUrlName = characterName ? encodeURIComponent(decodeURIComponent(characterName)) : undefined;

                if (expectedUrlName !== currentUrlName) {
                    navigate(`/${selectedGame.id}/${expectedUrlName}`, {
                        replace: true,
                    });
                }
            } else if (selectedChar) {
                const expectedUrlName = encodeURIComponent(selectedChar.name);
                const currentUrlName = characterName ? encodeURIComponent(decodeURIComponent(characterName)) : undefined;

                if (expectedUrlName !== currentUrlName) {
                    navigate(`/${selectedGame.id}/${expectedUrlName}`, {
                        replace: true,
                    });
                }
            }
        }
    }, [selectedCharacterId, characters, selectedGame.id, navigate, characterName]);

    // Handle URL parameters and initial character selection
    useEffect(() => {
        if (!selectedGame.id) return;

        if (gameId && gameId !== selectedGame.id) {
            const game = avaliableGames.find((g) => g.id === gameId);
            if (game) {
                setSelectedGameById(gameId);
                return;
            }
        }

        if (characterName && characters.length > 0 && (selectedCharacterId === null || (!characters.some((c) => c.id === selectedCharacterId) && selectedCharacterId !== -1))) {
            const decodedName = decodeURIComponent(characterName);
            if (decodedName.toLowerCase() === 'all') {
                setSelectedCharacterId(-1);
            } else {
                const characterFromName = characters.find((c) => c.name.toLowerCase() === decodedName.toLowerCase());

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
        } else if (!characterName && characters.length > 0 && (selectedCharacterId === null || (!characters.some((c) => c.id === selectedCharacterId) && selectedCharacterId !== -1))) {
            const firstCharacter = characters[0];
            if (firstCharacter) {
                setSelectedCharacterId(firstCharacter.id);
            }
        }
    }, [gameId, characterName, selectedGame.id, characters, selectedCharacterId, setSelectedGameById, setSelectedCharacterId]);

    // Simple in-memory cache for fetched/processed moves keyed by game+character
    const movesCacheRef = React.useRef<Map<string, Move[]>>(new Map());
    useEffect(() => {
        setOriginalMoves([]);
    if (selectedGame?.id && selectedCharacterId !== null) {
            setMovesLoading(true);
            setError(null);
            const abort = new AbortController();
            const fetchMoves = async () => {
                try {
                    const cacheKey = `${selectedGame.id}::${selectedCharacterId}`;
                    if (movesCacheRef.current.has(cacheKey)) {
                        setOriginalMoves(movesCacheRef.current.get(cacheKey)!);
                        return;
                    }
                    let aggregated: Move[] = [];
                    if (selectedCharacterId === -1) {
                        // Aggregate by fetching Characters.json then each character file
                        const listUrl = `/Games/${encodeURIComponent(selectedGame.id)}/Characters.json`;
                        const listRes = await fetch(listUrl, { signal: abort.signal });
                        if (!listRes.ok) throw new Error(`Failed to fetch characters list: ${listRes.status} ${listRes.statusText}`);
                        const listData = await listRes.json();
                        const chars = (Array.isArray(listData) ? listData : []).map((c: any) => ({ id: Number(c.id), name: String(c.name) }));
                        const ids: number[] = chars.map((c) => c.id).filter((n: any) => !isNaN(n));

                        const fetches = ids.map(async (id: number) => {
                            const url = `/Games/${encodeURIComponent(selectedGame.id)}/Characters/${encodeURIComponent(String(id))}.json`;
                            const res = await fetch(url, { signal: abort.signal });
                            if (!res.ok) return [] as any[];
                            const data = await res.json();
                            const name = chars.find(c => c.id === id)?.name || null;
                            const arr = Array.isArray(data) ? data : [];
                            return arr.map((m: any) => ({ ...m, CharacterId: id, CharacterName: name }));
                        });
                        const allDataArrays = await Promise.all(fetches);
                        const flatData = allDataArrays.flat();

                        aggregated = (flatData || []).map((moveObject: any) => {
                            const originalCommand = moveObject.Command != null ? String(moveObject.Command) : null;
                            const translatedCommand = originalCommand ? translateText(originalCommand) : null;
                            return {
                                ID: Number(moveObject.ID),
                                Command: translatedCommand,
                                CharacterId: moveObject.CharacterId != null ? Number(moveObject.CharacterId) : null,
                                CharacterName: moveObject.CharacterName != null ? String(moveObject.CharacterName) : null,
                                Stance: moveObject.Stance ? String(moveObject.Stance) : null,
                                HitLevel: moveObject.HitLevel ? String(moveObject.HitLevel) : null,
                                Impact: moveObject.Impact != null ? Number(moveObject.Impact) : 0,
                                Damage: moveObject.Damage != null ? String(moveObject.Damage) : null,
                                DamageDec: moveObject.DamageDec != null ? Number(moveObject.DamageDec) : null,
                                Block: moveObject.Block != null ? String(moveObject.Block) : null,
                                BlockDec: moveObject.BlockDec != null ? Number(moveObject.BlockDec) : null,
                                Hit: moveObject.Hit != null ? String(moveObject.Hit) : null,
                                HitDec: moveObject.HitDec != null ? Number(moveObject.HitDec) : null,
                                HitString: moveObject.Hit != null ? String(moveObject.Hit) : null,
                                CounterHit: moveObject.CounterHit != null ? String(moveObject.CounterHit) : null,
                                CounterHitDec: moveObject.CounterHitDec != null ? Number(moveObject.CounterHitDec) : null,
                                CounterHitString: moveObject.CounterHit != null ? String(moveObject.CounterHit) : null,
                                GuardBurst: moveObject.GuardBurst != null ? Number(moveObject.GuardBurst) : null,
                                Notes: moveObject.Notes != null ? String(moveObject.Notes) : null,
                            } as Move;
                        });
                        movesCacheRef.current.set(cacheKey, aggregated);
                        setOriginalMoves(aggregated);
                    } else {
                        const url = `/Games/${encodeURIComponent(selectedGame.id)}/Characters/${encodeURIComponent(String(selectedCharacterId))}.json`;
                        const res = await fetch(url, { signal: abort.signal });
                        if (!res.ok) throw new Error(`Failed to fetch moves: ${res.status} ${res.statusText}`);
                        const data = await res.json();
                        const movesData: Move[] = (Array.isArray(data) ? data : []).map((moveObject: any) => {
                            const originalCommand = moveObject.Command != null ? String(moveObject.Command) : null;
                            const translatedCommand = originalCommand ? translateText(originalCommand) : null;
                            return {
                                ID: Number(moveObject.ID),
                                Command: translatedCommand,
                                CharacterId: selectedCharacterId,
                                CharacterName: characters.find(c => c.id === selectedCharacterId)?.name || null,
                                Stance: moveObject.Stance ? String(moveObject.Stance) : null,
                                HitLevel: moveObject.HitLevel ? String(moveObject.HitLevel) : null,
                                Impact: moveObject.Impact != null ? Number(moveObject.Impact) : 0,
                                Damage: moveObject.Damage != null ? String(moveObject.Damage) : null,
                                DamageDec: moveObject.DamageDec != null ? Number(moveObject.DamageDec) : null,
                                Block: moveObject.Block != null ? String(moveObject.Block) : null,
                                BlockDec: moveObject.BlockDec != null ? Number(moveObject.BlockDec) : null,
                                Hit: moveObject.Hit != null ? String(moveObject.Hit) : null,
                                HitDec: moveObject.HitDec != null ? Number(moveObject.HitDec) : null,
                                HitString: moveObject.Hit != null ? String(moveObject.Hit) : null,
                                CounterHit: moveObject.CounterHit != null ? String(moveObject.CounterHit) : null,
                                CounterHitDec: moveObject.CounterHitDec != null ? Number(moveObject.CounterHitDec) : null,
                                CounterHitString: moveObject.CounterHit != null ? String(moveObject.CounterHit) : null,
                                GuardBurst: moveObject.GuardBurst != null ? Number(moveObject.GuardBurst) : null,
                                Notes: moveObject.Notes != null ? String(moveObject.Notes) : null,
                            } as Move;
                        });
                        movesCacheRef.current.set(cacheKey, movesData);
                        setOriginalMoves(movesData);
                    }
                } catch (error: any) {
                    if (error?.name === "AbortError") return;
                    setError(error instanceof Error ? error.message : `Unknown error loading moves for character ID ${selectedCharacterId}`);
                    setOriginalMoves([]);
                } finally {
                    setMovesLoading(false);
                }
            };

            fetchMoves();
            return () => abort.abort();
        } else {
            setOriginalMoves([]);
            setMovesLoading(false);
        }
    }, [selectedGame?.id, selectedCharacterId, translateText]);

    const handleSort = useCallback(
        (column: SortableColumn) => {
            if (sortColumn === column) {
                setSortDirection((prevDir) => (prevDir === "asc" ? "desc" : "asc"));
            } else {
                setSortColumn(column);
                setSortDirection("asc");
            }
        },
        [sortColumn]
    );

    // Wrapper to keep existing prop shape while using extracted component
    const renderCommand = useCallback((command: string | null) => <CommandRenderer command={command} />, []);

    // Helper to render Notes text with inline icons (Memoized)
    const renderNotes = useCallback((note: string | null) => <NotesRenderer note={note} />, []);

    // Build game-specific field configs and operator registry
    const gameFilterConfig = useMemo(() => gameFilterConfigs[selectedGame.id] ?? { fields: [] }, [selectedGame.id]);
    const fieldMap = useMemo(() => new Map<string, FieldConfig>(gameFilterConfig.fields.map(f => [f.id, f])), [gameFilterConfig.fields]);
    const allOperators: FilterOperator[] = useMemo(() => {
        const customs = gameFilterConfig.customOperators ?? [];
        const map = new Map<string, FilterOperator>();
        for (const op of builtinOperators) map.set(op.id, op);
        for (const op of customs) map.set(op.id, op);
        return Array.from(map.values());
    }, [gameFilterConfig]);
    const opsById = useMemo(() => operatorById(allOperators), [allOperators]);

    // Helper to read field value as string or number consistently
    const getFieldAs = useCallback((move: Move, fieldId: string): { string: string | null; number: number | null; type: FieldType } => {
        const field = fieldMap.get(fieldId);
        const type: FieldType = field?.type ?? "text";
        switch (fieldId) {
            case "character":
                return { string: move.CharacterName || null, number: null, type };
            case "stance":
                return { string: move.Stance, number: null, type };
            case "command":
            case "rawCommand":
                return { string: move.Command, number: null, type };
            case "hitLevel":
                return { string: move.HitLevel, number: null, type };
            case "impact":
                return { string: move.Impact != null ? String(move.Impact) : null, number: move.Impact ?? null, type };
            case "damage":
                return { string: move.DamageDec != null ? String(move.DamageDec) : move.Damage, number: move.DamageDec ?? null, type };
            case "block":
                return { string: move.BlockDec != null ? String(move.BlockDec) : move.Block, number: move.BlockDec ?? null, type };
            case "hit":
                return { string: move.HitDec != null ? String(move.HitDec) : move.Hit, number: move.HitDec ?? null, type };
            case "counterHit":
                return { string: move.CounterHitDec != null ? String(move.CounterHitDec) : move.CounterHit, number: move.CounterHitDec ?? null, type };
            case "guardBurst":
                return { string: move.GuardBurst != null ? String(move.GuardBurst) : null, number: move.GuardBurst ?? null, type };
            case "notes":
                return { string: move.Notes, number: null, type };
            default:
                return { string: null, number: null, type };
        }
    }, [fieldMap]);

    // Type for processed filters
    type ProcessedFilter = FilterCondition & {
        value1?: string;
        value2?: string;
    };

    // Pre-process filters for better performance
    const processedFilters = useMemo((): ProcessedFilter[] => {
        return activeFilters.map((f) => ({ ...f, value1: f.value, value2: f.value2 }));
    }, [activeFilters]);

    const applyFilter = useCallback((move: Move, filter: ProcessedFilter): boolean => {
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
    }, [opsById, getFieldAs]);

    // Optimized field value extraction with type information
    const SORT_FIELD_MAP = useMemo(() => ({
    character: { getter: (move: Move) => move.CharacterName, type: 'string' as const },
        stance: { getter: (move: Move) => move.Stance, type: 'string' as const },
        command: { getter: (move: Move) => move.Command, type: 'string' as const },
        rawCommand: { getter: (move: Move) => move.Command, type: 'string' as const },
        hitLevel: { getter: (move: Move) => move.HitLevel, type: 'string' as const },
        impact: { getter: (move: Move) => move.Impact, type: 'number' as const },
        damage: { getter: (move: Move) => move.DamageDec, type: 'number' as const },
        block: { getter: (move: Move) => move.BlockDec, type: 'number' as const },
        hit: { getter: (move: Move) => move.HitDec, type: 'number' as const },
        counterHit: { getter: (move: Move) => move.CounterHitDec, type: 'number' as const },
        guardBurst: { getter: (move: Move) => move.GuardBurst, type: 'number' as const },
        notes: { getter: (move: Move) => move.Notes, type: 'string' as const },
    }), []);

    // Pre-compute sort values for the current sort column
    const movesWithSortValues = useMemo(() => {
        if (!sortColumn || originalMoves.length === 0) return originalMoves;
        
        const fieldConfig = SORT_FIELD_MAP[sortColumn as keyof typeof SORT_FIELD_MAP];
        if (!fieldConfig) return originalMoves;
        
        return originalMoves.map(move => ({
            ...move,
            _sortValue: fieldConfig.getter(move)
        }));
    }, [originalMoves, sortColumn, SORT_FIELD_MAP]);

    // Optimized comparator functions
    const createOptimizedComparator = useCallback((direction: "asc" | "desc", fieldType: 'string' | 'number') => {
        const order = direction === "asc" ? 1 : -1;
        
        if (fieldType === 'number') {
            return (a: Move & { _sortValue?: any }, b: Move & { _sortValue?: any }): number => {
                const valA = a._sortValue;
                const valB = b._sortValue;
                
                if (valA == null && valB == null) return 0;
                if (valA == null) return order;
                if (valB == null) return -order;
                
                return (valA - valB) * order;
            };
        } else {
            return (a: Move & { _sortValue?: any }, b: Move & { _sortValue?: any }): number => {
                const valA = a._sortValue;
                const valB = b._sortValue;
                
                if (valA == null && valB == null) return 0;
                if (valA == null) return order;
                if (valB == null) return -order;
                
                return String(valA).localeCompare(String(valB)) * order;
            };
        }
    }, []);

    // compute displayedMoves via memoization with optimized filtering and sorting
    const displayedMoves = useMemo(() => {
        const sourceMoves = sortColumn ? movesWithSortValues : originalMoves;
        if (sourceMoves.length === 0) return [];

        let result = sourceMoves;
        if (processedFilters.length > 0) {
            result = result.filter((move) => {
                return processedFilters.every((filter) => applyFilter(move, filter));
            });
        }

        // Apply sorting if column is specified
        if (sortColumn) {
            if (result === sourceMoves) {
                result = [...result];
            }

            const fieldConfig = SORT_FIELD_MAP[sortColumn as keyof typeof SORT_FIELD_MAP];
            if (fieldConfig) {
                const comparator = createOptimizedComparator(sortDirection, fieldConfig.type);
                result.sort(comparator);
            }
        }

        return result;
    }, [movesWithSortValues, originalMoves, processedFilters, sortColumn, sortDirection, applyFilter, createOptimizedComparator, SORT_FIELD_MAP]);

    // Handle filter changes (Memoized)
    const handleFiltersChange = useCallback((filters: FilterCondition[]) => {
        setActiveFilters(filters);
    }, []);

    // New useEffect to fetch the timestamp
    useEffect(() => {
        fetch("/timestamp.json")
            .then((res) => res.json())
            .then((data) => {
                setDeployTimestamp(data.timestamp);
            })
            .catch((err) => {
                setDeployTimestamp("Unknown");
            });
    }, []);

    // Inject CSS styles for transitions
    useEffect(() => {
        const styleEl = document.createElement("style");
        styleEl.innerHTML = `
      .filter-container {
        transition: all 0.25s ease-in-out;
        transform-origin: top center;
      }
      
      .filter-container.visible {
        opacity: 1;
        transform: scaleY(1);
        margin-top: 12px;
        pointer-events: all;
      }
      
      .filter-container.hidden {
        opacity: 0;
        transform: scaleY(0);
        margin-top: 0;
        max-height: 0;
        pointer-events: none;
      }
      
      /* Special case for empty filters */
      .filter-container.empty.visible {
        transition: all 0.1s ease-out;
      }
      
      .filter-container.empty.hidden {
        transition: all 0.1s ease-in;
      }
      
      .title-interactive {
        position: relative;
        padding: 6px 10px;
        margin: -6px -10px;
        border-radius: 4px;
        transition: background-color 0.2s ease;
      }
      
      .title-interactive:hover {
        background-color: rgba(255, 255, 255, 0.05);
      }
      
      .title-interactive:active {
        background-color: rgba(255, 255, 255, 0.1);
      }
    `;

        document.head.appendChild(styleEl);

        // Return cleanup function
        return () => {
            if (styleEl && document.head.contains(styleEl)) {
                document.head.removeChild(styleEl);
            }
        };
    }, []);

    // Inject ::selection styles for custom icons
    useEffect(() => {
        const selectionStyleId = "custom-icon-selection-styles";
        let styleEl = document.getElementById(selectionStyleId) as HTMLStyleElement | null;

        if (!styleEl) {
            styleEl = document.createElement("style");
            styleEl.id = selectionStyleId;
            styleEl.innerHTML = `
        /* Style the text inside ButtonIcon when selected */
        .button-icon::selection {
          background-color: #3390FF; /* Standard selection blue */
          color: white;
        }
        /* Style the text inside the plus separator when selected */
        .plus-separator::selection {
          background-color: #3390FF;
          color: white;
        }
      `;
            document.head.appendChild(styleEl);
        }

        return () => {};
    }, []);

    if (error) {
        return (
            <Card className="border-destructive/20">
                <CardHeader>
                    <CardTitle className="text-destructive">Error</CardTitle>
                    <CardDescription>{error}</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">Try another character or game, or refresh the page.</p>
                </CardContent>
            </Card>
        );
    }

    // Get selected character name based on the ID stored in context
    const selectedCharacterNameFromContext = selectedCharacterId === -1 ? "All Characters" : (selectedCharacterId ? characters.find((c) => c.id === selectedCharacterId)?.name : null);

    const scrollContainerRef = useRef<HTMLDivElement | null>(null);

    return (
        <div className="space-y-6 h-full flex flex-col pl-4 pr-4 flex-grow">
            {selectedCharacterId ? (
                <Card className="h-full flex flex-col overflow-hidden border border-card-border">
                    <CardHeader className="pb-2 flex-shrink-0">
                        <div className="flex justify-between items-center">
                            <div
                                className="flex items-center cursor-pointer group title-interactive"
                                onClick={toggleFiltersVisibility}
                                title={filtersVisible ? "Click to hide filters" : "Click to show filters"}
                            >
                                <CardTitle className="flex items-center">
                                    {selectedCharacterNameFromContext || "Character"} Frame Data
                                    <ChevronRight
                                        className={cn(
                                            "ml-2 h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:text-foreground",
                                            filtersVisible ? "transform rotate-90" : ""
                                        )}
                                    />
                                </CardTitle>
                                <ActiveFiltersBadge count={activeFilters.length} />
                            </div>
                            <CardDescription className="m-0">
                                Total Moves: {displayedMoves.length} {originalMoves.length !== displayedMoves.length ? `(filtered from ${originalMoves.length})` : ""}
                            </CardDescription>
                        </div>

                        <div className={`filter-container ${filtersVisible ? "visible" : "hidden"} ${activeFilters.length === 0 ? "empty" : ""}`}>
                            <FilterBuilder onFiltersChange={handleFiltersChange} moves={originalMoves} />
                        </div>
                    </CardHeader>
                    <CardContent className="flex-grow p-0 flex flex-col overflow-visible">
                        <div className="overflow-y-auto flex-grow max-h-[70vh]" ref={scrollContainerRef}>
                            {/* Render the memoized table content */}
                            <MemoizedDataTableContent
                                moves={displayedMoves}
                                movesLoading={movesLoading}
                                sortColumn={sortColumn}
                                sortDirection={sortDirection}
                                handleSort={handleSort}
                                renderCommand={renderCommand}
                                renderNotes={renderNotes}
                                visibleColumns={visibleColumns}
                                badges={selectedGame.badges}
                getScrollElement={() => scrollContainerRef.current}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="text-xs text-muted-foreground flex-shrink-0">Website last deployed: {deployTimestamp}</CardFooter>
                </Card>
            ) : (
                <div className="flex items-center justify-center h-48 border rounded-lg bg-muted/40">
                    <p className="text-muted-foreground">{characters.length > 0 ? "Select a character to view frame data" : "No characters loaded."}</p>
                </div>
            )}
        </div>
    );
};
