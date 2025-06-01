import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Button } from './ui/button';
import { initializeDatabase } from '../utils/initializeDatabase';
import { Loader2, Shield, ArrowUp, ArrowDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useGame, AVAILABLE_GAMES, IconConfig } from '../contexts/GameContext';
import { useTableConfig } from '../contexts/TableConfigContext';
import { cn } from "@/lib/utils";
import { FilterBuilder, ActiveFiltersBadge, FilterCondition } from './FilterBuilder';
import { CommandIcon } from '@/components/ui/CommandIcon';

// Using the SQL.js loaded via CDN
declare global {
  interface Window {
    initSqlJs: () => Promise<any>;
  }
}

// Updated Move interface based on schema.sql and component usage
interface Move {
  ID: number;
  Command: string; // Translated command
  Stance: string | null;
  HitLevel: string | null;
  Impact: number;
  Damage: string | null;
  DamageDec: number | null;
  Block: number | null;
  HitString: string | null;
  Hit: number | null;
  CounterHitString: string | null;
  CounterHit: number | null;
  GuardBurst: number | null;
  Notes: string | null;
}

// Define sortable columns (using Move interface keys for type safety)
type SortableColumn = keyof Move | 'Damage' | 'Hit' | 'CounterHit' | 'OriginalCommand';


// --- Helper Functions (Moved outside component) ---
// Helper to get tooltip text for icons (can be expanded for i18n)
const getIconTooltip = (iconCode: string, availableIcons: IconConfig[]): string => {
  const directionTooltips: Record<string, string> = {
    '1': 'Down+Back',
    '2': 'Down',
    '3': 'Down+Forward',
    '4': 'Back',
    '5': 'Neutral',
    '6': 'Forward',
    '7': 'Up+Back',
    '8': 'Up',
    '9': 'Up+Forward',
  };

  const upperCode = iconCode.toUpperCase();

  if (directionTooltips[upperCode]) {
    return directionTooltips[upperCode];
  }

  const iconConfig = availableIcons.find(icon => icon.code.toUpperCase() === upperCode);
  if (iconConfig && iconConfig.title) {
    return iconConfig.title;
  }

  return upperCode;
};

// Combined badge rendering function (Moved outside component)
const renderBadge = (value: number | null, text: string | null, forceNoSign: boolean = false): React.ReactNode => {
  let displayText: string;
  if (text !== null && text !== undefined) {
    displayText = text;
  } else if (value !== null && value !== undefined) {
    displayText = (!forceNoSign && value > 0 ? '+' : '') + value; 
  } else {
    displayText = '—';
  }

  // Special status strings
  if (text === 'KND') {
    return <Badge className="bg-fuchsia-700 text-white w-12 inline-flex items-center justify-center">{displayText}</Badge>;
  }
  if (text === 'STN') {
    return <Badge className="bg-pink-700 text-white w-12 inline-flex items-center justify-center">{displayText}</Badge>;
  }
  if (text === 'LNC') {
    return <Badge className="bg-rose-700 text-white w-12 inline-flex items-center justify-center">{displayText}</Badge>;
  }

  if (value === null || value === undefined) {
    return <Badge className="bg-gray-500 hover:bg-gray-600 text-white w-12 inline-flex items-center justify-center">{displayText}</Badge>; 
  }

  // Frame advantage coloring
  if (value >= 0) {
    return <Badge className="bg-green-700 text-white w-12 inline-flex items-center justify-center">{displayText}</Badge>;
  } else {
    return <Badge className="bg-rose-700 text-white w-12 inline-flex items-center justify-center">{displayText}</Badge>;
  }
};

// --- End Helper Functions ---

// --- Standalone UI Components (Moved outside main component) ---

// Define a self-contained hit level icon component
const HitLevelIcon = React.memo(({ level }: { level: string }) => {
  let bgColor = 'bg-gray-400';
  let textColor = 'text-white';

  switch (level.toUpperCase()) {
    case 'M': bgColor = 'bg-yellow-500'; break;
    case 'L': bgColor = 'bg-cyan-500'; break;
    case 'H': bgColor = 'bg-pink-500'; break;
    case 'SM': bgColor = 'bg-purple-500'; break;
    case 'SL': bgColor = 'bg-cyan-500'; break; 
    case 'SH': bgColor = 'bg-orange-500'; break;
  }

  return (
    <div
      className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center p-px ring-1 ring-black"
      title={level}
    >
      <div className="w-full h-full rounded-full bg-white flex items-center justify-center p-px">
        <div className={`w-full h-full rounded-full flex items-center justify-center text-xs font-bold ${bgColor} ${textColor}`}>
          {level.length > 1 && ['SL', 'SH', 'SM'].includes(level.toUpperCase()) 
            ? level.toUpperCase() 
            : level.charAt(0).toUpperCase()} 
        </div>
      </div>
    </div>
  );
});

// Define a self-contained component for expandable hit levels
const ExpandableHitLevels = React.memo(({ 
  hitLevelString, 
  maxIconsToShow = 3
}: { 
  hitLevelString: string | null, 
  maxIconsToShow?: number 
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  
  const levels = React.useMemo(() => {
    if (!hitLevelString) return [];
    return hitLevelString.split(/:+/).map(level => level.trim()).filter(Boolean);
  }, [hitLevelString]);
  
  const canExpand = levels.length > maxIconsToShow + 1;
  
  const handleToggle = React.useCallback(() => {
    if (!canExpand) return;
    setIsExpanded(prev => !prev);
  }, [canExpand]);
  
  if (levels.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  
  let iconsToShow: number;
  if (levels.length <= maxIconsToShow + 1) {
    iconsToShow = levels.length;
  } else {
    iconsToShow = isExpanded ? levels.length : maxIconsToShow;
  }
  
  const showEllipsis = canExpand && !isExpanded;
  
  return (
    <div 
      className={`flex flex-wrap items-center gap-1 ${canExpand ? 'cursor-pointer' : ''}`}
      onClick={canExpand ? handleToggle : undefined}
    >
      {levels.slice(0, iconsToShow).map((level, index) => (
        <div key={`${level}-${index}`}>
          <HitLevelIcon level={level} />
        </div>
      ))}
      
      {showEllipsis && (
        <ChevronRight size={16} className="text-muted-foreground ml-1" />
      )}
    </div>
  );
});

// --- End Standalone UI Components ---

// --- Memoized Table Content Component ---
interface DataTableContentProps {
  moves: Move[];
  movesLoading: boolean;
  sortColumn: SortableColumn | null;
  sortDirection: 'asc' | 'desc';
  handleSort: (column: SortableColumn) => void;
  renderCommand: (command: string | null) => React.ReactNode;
  renderNotes: (note: string | null) => React.ReactNode;
  ExpandableHitLevelsComponent: typeof ExpandableHitLevels; 
  visibleColumns: any[];
}

const DataTableContent: React.FC<DataTableContentProps> = ({ 
  moves, 
  movesLoading, 
  sortColumn, 
  sortDirection, 
  handleSort, 
  renderCommand, 
  renderNotes,
  ExpandableHitLevelsComponent,
  visibleColumns
}) => {
  const badgeRenderer = renderBadge;

  const getColumnHeader = (columnId: string) => {
    switch (columnId) {
      case 'stance': return 'Stance';
      case 'command': return 'Command';
      case 'rawCommand': return 'Raw Command';
      case 'hitLevel': return 'Hit Level';
      case 'impact': return 'Impact';
      case 'damage': return 'Damage';
      case 'block': return <><Shield size={16} /></>;
      case 'hit': return 'Hit';
      case 'counterHit': return 'CH';
      case 'guardBurst': return 'GB';
      case 'notes': return 'Notes';
      default: return columnId;
    }
  };

  const getSortKey = (columnId: string): SortableColumn => {
    switch (columnId) {
      case 'stance': return 'Stance';
      case 'command': return 'Command';
      case 'rawCommand': return 'OriginalCommand';
      case 'hitLevel': return 'HitLevel';
      case 'impact': return 'Impact';
      case 'damage': return 'Damage';
      case 'block': return 'Block';
      case 'hit': return 'Hit';
      case 'counterHit': return 'CounterHit';
      case 'guardBurst': return 'GuardBurst';
      case 'notes': return 'Notes';
      default: return columnId as SortableColumn;
    }
  };

  const renderCellContent = (move: Move, columnId: string) => {
    switch (columnId) {
      case 'stance':
        return move.Stance || '—';
      case 'command':
        return renderCommand(move.Command);
      case 'rawCommand':
        return move.Command || '—';
      case 'hitLevel':
        return (
          <ExpandableHitLevelsComponent 
            hitLevelString={move.HitLevel} 
            maxIconsToShow={3}
          />
        );
      case 'impact':
        return move.Impact ?? '—';
      case 'damage':
        return move.DamageDec ?? '—';
      case 'block':
        return badgeRenderer(move.Block, null);
      case 'hit':
        return badgeRenderer(move.Hit, move.HitString);
      case 'counterHit':
        return badgeRenderer(move.CounterHit, move.CounterHitString);
      case 'guardBurst':
        return badgeRenderer(move.GuardBurst, null, true);
      case 'notes':
        return (
          <div className="max-w-full truncate overflow-x-hidden overflow-y-visible">
            {renderNotes(move.Notes)}
          </div>
        );
      default:
        return '—';
    }
  };

  return (
    <Table className="table-layout-fixed">
      <TableHeader className="sticky top-0 bg-card z-10">
        <TableRow className="border-b-card-border">
          {visibleColumns.map((column) => {
            const sortKey = getSortKey(column.id);

            return (
              <TableHead 
                key={column.id}
                className={column.colClasses}
                onClick={() => handleSort(sortKey)}
                title={column.friendlyLabel ? column.friendlyLabel : column.label}
              >
                <div className="flex items-center justify-between gap-1">
                  <span>{column.label}</span>
                  {sortColumn === sortKey && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                </div>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {(() => {
          if (movesLoading) {
            return (
              <TableRow>
                <TableCell colSpan={visibleColumns.length} className="text-center h-24 p-2">
                  <div className="flex justify-center items-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
                    Loading moves...
                  </div>
                </TableCell>
              </TableRow>
            );
          }
          
          else if (moves.length === 0) {
            return (
              <TableRow>
                <TableCell colSpan={visibleColumns.length} className="text-center h-24 p-2">
                  No moves found for this character or filter criteria.
                </TableCell>
              </TableRow>
            );
          }
          
          return moves.map((move) => (
            <TableRow 
              key={move.ID}
              className="border-b-card-border"
            >
              {visibleColumns.map((column) => (
                <TableCell 
                  key={`${move.ID}-${column.id}`}
                  className={column.colClasses}
                >
                  {renderCellContent(move, column.id)}
                </TableCell>
              ))}
            </TableRow>
          ));
        })()}
      </TableBody>
    </Table>
  );
};

const MemoizedDataTableContent = React.memo(DataTableContent);

// --- End Memoized Table Content Component ---

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
    translateText
  } = useGame();
  
  // Add table configuration context
  const { getVisibleColumns } = useTableConfig();
  
  const [db, setDb] = useState<any | null>(null);
  const [originalMoves, setOriginalMoves] = useState<Move[]>([]); // Store the original, unsorted moves
  const [loading, setLoading] = useState(true);
  const [movesLoading, setMovesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deployTimestamp, setDeployTimestamp] = useState<string>("Loading...");

  // --- Sorting State ---
  const [sortColumn, setSortColumn] = useState<SortableColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Add state for filters
  const [activeFilters, setActiveFilters] = useState<FilterCondition[]>([]);

  // Add state for filters visibility
  const [filtersVisible, setFiltersVisible] = useState<boolean>(true);
  
  // Get visible columns from table configuration
  const visibleColumns = getVisibleColumns();
  
  // Toggle filters visibility (Memoized)
  const toggleFiltersVisibility = useCallback(() => {
    setFiltersVisible(prev => !prev);
  }, []);

  // Sync URL with selected character
  useEffect(() => {
    if (selectedCharacterId !== null && characters.length > 0 && selectedGame.id) {
      const selectedChar = characters.find(c => c.id === selectedCharacterId);
      if (selectedChar) {
        const expectedUrlName = encodeURIComponent(selectedChar.name);
        const currentUrlName = characterName ? encodeURIComponent(decodeURIComponent(characterName)) : undefined;
        
        if (expectedUrlName !== currentUrlName) {
           navigate(`/${selectedGame.id}/${expectedUrlName}`, { replace: true }); 
        }
      }
    }
  }, [selectedCharacterId, characters, selectedGame.id, navigate, characterName]);

  // Handle URL parameters and initial character selection
  useEffect(() => {
    if (!selectedGame.id) return;

    if (gameId && gameId !== selectedGame.id) {
      const game = AVAILABLE_GAMES.find(g => g.id === gameId);
      if (game) {
        setSelectedGameById(gameId);
        return;
      }
    }

    if (characterName && characters.length > 0 && (selectedCharacterId === null || !characters.some(c => c.id === selectedCharacterId))) {
      const decodedName = decodeURIComponent(characterName);
      const characterFromName = characters.find(c => c.name.toLowerCase() === decodedName.toLowerCase());

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
    } else if (!characterName && characters.length > 0 && (selectedCharacterId === null || !characters.some(c => c.id === selectedCharacterId))) {
        const firstCharacter = characters[0];
        if (firstCharacter) {
          setSelectedCharacterId(firstCharacter.id);
        }
    }
  }, [gameId, characterName, selectedGame.id, characters, selectedCharacterId, setSelectedGameById, setSelectedCharacterId]); 

  // Load database when game changes
  useEffect(() => {
    setOriginalMoves([]);
    setDb(null);
    setLoading(true);
    setError(null);

    const loadDatabase = async () => {
      if (!selectedGame.dbPath) {
        setError("No database path configured for the selected game.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true); 
        const SQL = await window.initSqlJs();
        const response = await fetch(selectedGame.dbPath);
        if (!response.ok) throw new Error(`Failed to fetch database: ${response.statusText}`);
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const database = new SQL.Database(uint8Array);
        setDb(database);
      } catch (error) {
        setError(error instanceof Error ? error.message : `Error loading database for ${selectedGame.name}`);
        setDb(null);
      } finally {
        setLoading(false);
      }
    };

    loadDatabase();
  }, [selectedGame.dbPath]);
  
  // Load moves when character or database changes
  useEffect(() => {
    setOriginalMoves([]);
    if (db && selectedCharacterId !== null) {
      setMovesLoading(true);
      setError(null);

      // Use setTimeout to avoid race conditions with state updates
      const timer = setTimeout(() => {
        try {
          const movesQuery = `
            SELECT
              ID, Command, Stance, HitLevel, Impact, Damage,
              Hit, CounterHit, BlockDec, HitDec, CounterHitDec,
              GuardBurst, Notes, DamageDec
            FROM Moves
            WHERE CharacterID = ?
          `;
          const movesResult = db.exec(movesQuery, [selectedCharacterId]);

          if (movesResult.length > 0 && movesResult[0].values.length > 0) {
            const columns = movesResult[0].columns;
            const values = movesResult[0].values;

            const movesData: Move[] = values.map((row: unknown[]) => {
              const moveObject: Record<string, unknown> = {};
              columns.forEach((colName: string, index: number) => {
                moveObject[colName] = row[index];
              });

              const originalCommand = String(moveObject.Command);
              const translatedCommand = translateText(originalCommand);

              return {
                ID: Number(moveObject.ID),
                Command: translatedCommand,
                Stance: moveObject.Stance ? String(moveObject.Stance) : null,
                HitLevel: moveObject.HitLevel ? String(moveObject.HitLevel) : null,
                Impact: Number(moveObject.Impact),
                Damage: moveObject.Damage ? String(moveObject.Damage) : null,
                DamageDec: moveObject.DamageDec !== null && moveObject.DamageDec !== undefined ? Number(moveObject.DamageDec) : null,
                Block: moveObject.BlockDec !== null && moveObject.BlockDec !== undefined ? Number(moveObject.BlockDec) : null,
                HitString: moveObject.Hit ? String(moveObject.Hit) : null,
                Hit: moveObject.HitDec !== null && moveObject.HitDec !== undefined ? Number(moveObject.HitDec) : null,
                CounterHitString: moveObject.CounterHit ? String(moveObject.CounterHit) : null,
                CounterHit: moveObject.CounterHitDec !== null && moveObject.CounterHitDec !== undefined ? Number(moveObject.CounterHitDec) : null,
                GuardBurst: moveObject.GuardBurst !== null && moveObject.GuardBurst !== undefined ? Number(moveObject.GuardBurst) : null,
                Notes: moveObject.Notes ? String(moveObject.Notes) : null
              };
            });
            setOriginalMoves(movesData);
          } else {
            setOriginalMoves([]);
          }
        } catch (error) {
          setError(error instanceof Error ? error.message : `Unknown error loading moves for character ID ${selectedCharacterId}`);
          setOriginalMoves([]);
        } finally {
          setMovesLoading(false);
        }
      }, 0);

      return () => clearTimeout(timer);
    } else {
       setOriginalMoves([]);
       setMovesLoading(false);
    }
  }, [db, selectedCharacterId, translateText]);

  const handleSort = useCallback((column: SortableColumn) => {
    if (sortColumn === column) {
      setSortDirection(prevDir => (prevDir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }, [sortColumn]);

  // Helper to render Command text with inline icons (Memoized)
  const renderCommand = useCallback((command: string | null) => {
    if (!command) { return '—'; }

    const parts: React.ReactNode[] = [];
    const commandArray = command.match(/(?<=:)[^:]+(?=:)/g) || [];
    for (let i = 0; i < commandArray.length; i++) {
        let isSlide = false;
        let isHeld = false;
        const buttons = commandArray[i];
        let buttonIndex = 0;
        for (let button of buttons.split("+")) {
            if (buttonIndex > 0) {
                parts.push(
                    <div key={`plus-${i}-${buttonIndex}`} className="inline-flex items-center justify-center w-3 h-3 text-sm border border-black bg-white text-black rounded-full mx-[-5px] z-20" >
                        <img src={"/Icons/+.svg"} alt="+" className="inline object-contain align-text-bottom h-4 w-4" />
                    </div>
                );
            }
            
            if(button[0] === "(") {
                isHeld = true;
                button = button.replace(/[()]/g, '');
            }

            if(button === "_") {
                parts.push(<span key={`separator-${i}-${buttonIndex}`} className="inline-flex items-center flex-wrap ml-[-1px] mr-[-1px]">|</span>);
            }
            else if(!isNaN(button[0] as any)) {
                let icon: string; // is direction
                icon = `/Icons/${isHeld ? "Held" : ""}${button}.svg`
                parts.push(<img key={`direction-${i}-${buttonIndex}-${button}`} src={icon} alt={button} className="inline object-contain align-text-bottom h-4 w-4" />);
            } else {
                if(button[0] === button[0].toLowerCase()) {
                    isSlide = true;
                }
                parts.push(<CommandIcon key={`command-${i}-${buttonIndex}-${button}`} input={button} isHeld={isHeld} isSlide={isSlide} />);
            }
            buttonIndex++;
        }
    }

    return <span className="inline-flex items-center flex-wrap">{parts}</span>;
  }, []);

  // Helper to render Notes text with inline icons (Memoized)
  const renderNotes = useCallback((note: string | null) => {
    if (!note) { return '—'; }

    const parts: React.ReactNode[] = [];
    const codes = availableIcons.map(ic => ic.code).join('|');
    const regex = new RegExp(`:(${codes}):`, 'g');
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let partIndex = 0;
    while ((match = regex.exec(note))) {
      const [full, iconName] = match;
      const start = match.index;
      if (start > lastIndex) {
        parts.push(<span key={`text-${partIndex}`}>{note.slice(lastIndex, start)}</span>);
        partIndex++;
      }
      const iconConfig = availableIcons.find(ic => ic.code === iconName);
      if (iconConfig) {
        const titleText = getIconTooltip(iconName, availableIcons);
        const classes = cn(
          "inline object-contain align-text-bottom h-4 w-4",
          iconConfig.iconClasses
        );
        parts.push(
          <img
            key={`${iconName}-${start}`}
            src={getIconUrl(iconName)}
            alt={iconName}
            title={titleText}
            className={cn(classes, 'mx-0.5')}
          />
        );
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < note.length) {
      parts.push(<span key={`text-${partIndex}`}>{note.slice(lastIndex)}</span>);
    }
    return parts;
  }, [availableIcons, getIconUrl]);

  // Helper function to get field value based on field name
  const getFieldValue = (move: Move, fieldName: string): any => {
    switch (fieldName) {
      case 'Damage':
        return move.DamageDec;
      case 'Hit':
        return move.Hit;
      case 'CounterHit':
        return move.CounterHit;
      default:
        return move[fieldName as keyof Move];
    }
  };

  // compute displayedMoves via memoization instead of state
  const displayedMoves = React.useMemo(() => {
    let filteredMoves = [...originalMoves];
    
    if (activeFilters.length > 0) {
      filteredMoves = filteredMoves.filter(move => {
        return activeFilters.every(filter => {
          const fieldValue = getFieldValue(move, filter.field);
          if (fieldValue === null || fieldValue === undefined) return false;
          
          const fieldValueStr = String(fieldValue).toLowerCase();
          const filterValueLower = filter.value.toLowerCase();
          
          switch (filter.condition) {
            case 'equals':
              return fieldValueStr === filterValueLower;
            case 'notEquals':
              return fieldValueStr !== filterValueLower;
            case 'greaterThan':
              return !isNaN(Number(fieldValue)) && !isNaN(Number(filter.value)) && 
                     Number(fieldValue) > Number(filter.value);
            case 'lessThan':
              return !isNaN(Number(fieldValue)) && !isNaN(Number(filter.value)) && 
                     Number(fieldValue) < Number(filter.value);
            case 'between':
              if (!filter.value2) return false;
              const min = Number(filter.value);
              const max = Number(filter.value2);
              const val = Number(fieldValue);
              return !isNaN(min) && !isNaN(max) && !isNaN(val) && 
                     val >= min && val <= max;
            case 'notBetween':
              if (!filter.value2) return false;
              const notMin = Number(filter.value);
              const notMax = Number(filter.value2);
              const notVal = Number(fieldValue);
              return !isNaN(notMin) && !isNaN(notMax) && !isNaN(notVal) && 
                     (notVal < notMin || notVal > notMax);
            case 'contains':
              return fieldValueStr.includes(filterValueLower);
            case 'startsWith':
              return fieldValueStr.startsWith(filterValueLower);
            default:
              return true;
          }
        });
      });
    }
    
    if (!sortColumn) return filteredMoves;
    
    const sorted = [...filteredMoves].sort((a, b) => {
      let valA: any;
      let valB: any;
      switch (sortColumn) {
        case 'Damage':
          valA = a.DamageDec; valB = b.DamageDec; break;
        case 'Block':
          valA = a.Block; valB = b.Block; break;
        case 'Hit':
          valA = a.Hit; valB = b.Hit; break;
        case 'CounterHit':
          valA = a.CounterHit; valB = b.CounterHit; break;
        default:
          valA = getFieldValue(a, sortColumn);
          valB = getFieldValue(b, sortColumn);
      }
      
      const aNull = valA == null;
      const bNull = valB == null;
      if (aNull && !bNull) return 1;
      if (!aNull && bNull) return -1;
      if (aNull && bNull) return 0;
      const order = sortDirection === 'asc' ? 1 : -1;
      if (typeof valA === 'number' && typeof valB === 'number') return (valA - valB) * order;
      if (typeof valA === 'string' && typeof valB === 'string') return valA.localeCompare(valB) * order;
      return 0;
    });
    return sorted;
  }, [originalMoves, sortColumn, sortDirection, activeFilters]);

  // Handle filter changes (Memoized)
  const handleFiltersChange = useCallback((filters: FilterCondition[]) => {
    setActiveFilters(filters);
  }, []);

  // New useEffect to fetch the timestamp
  useEffect(() => {
    fetch('/timestamp.json')
      .then(res => res.json())
      .then(data => {
        setDeployTimestamp(data.timestamp);
      })
      .catch(err => {setDeployTimestamp("Unknown");});
  }, []);

  // Inject CSS styles for transitions
  useEffect(() => {
    const styleEl = document.createElement('style');
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
    const selectionStyleId = 'custom-icon-selection-styles';
    let styleEl = document.getElementById(selectionStyleId) as HTMLStyleElement | null;
    
    if (!styleEl) {
      styleEl = document.createElement('style');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        {/* Keep Initialize button for potential manual schema creation */}
        {db && (
          <CardContent>
            <Button 
              onClick={async () => {
                try {
                  const success = await initializeDatabase(db);
                  if (success) {
                    alert("Database initialized successfully! Reloading data...");
                    // Re-trigger data loading instead of full page reload
                    setError(null); // Clear error
                    window.location.reload(); // Simple reload for now
                  } else {
                    alert("Failed to initialize database.");
                  }
                } catch (err) {
                  alert(`Error initializing database: ${err}`);
                }
              }}
            >
              Attempt Database Initialization
            </Button>
          </CardContent>
        )}
      </Card>
    );
  }

  // Get selected character name based on the ID stored in context
  const selectedCharacterNameFromContext = selectedCharacterId
    ? characters.find(c => c.id === selectedCharacterId)?.name
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
                title={filtersVisible ? "Click to hide filters" : "Click to show filters"}
              >
                <CardTitle className="flex items-center">
                  {selectedCharacterNameFromContext || 'Character'} Frame Data
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
                Total Moves: {displayedMoves.length} {originalMoves.length !== displayedMoves.length ? 
                  `(filtered from ${originalMoves.length})` : ''}
              </CardDescription>
            </div>
            
            <div className={`filter-container ${filtersVisible ? 'visible' : 'hidden'} ${activeFilters.length === 0 ? 'empty' : ''}`}>
              <FilterBuilder 
                onFiltersChange={handleFiltersChange} 
                moves={originalMoves}
              />
            </div>
          </CardHeader>
          <CardContent className="flex-grow p-0 flex flex-col overflow-visible">
            <div className="overflow-y-auto flex-grow">
              {/* Render the memoized table content */}
              <MemoizedDataTableContent 
                moves={displayedMoves} 
                movesLoading={movesLoading}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                handleSort={handleSort}
                renderCommand={renderCommand}
                renderNotes={renderNotes}
                ExpandableHitLevelsComponent={ExpandableHitLevels}
                visibleColumns={visibleColumns}
              />
            </div>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground flex-shrink-0">
            Website last deployed: {deployTimestamp}
          </CardFooter>
        </Card>
      ) : (
        <div className="flex items-center justify-center h-48 border rounded-lg bg-muted/40">
          <p className="text-muted-foreground">
            {characters.length > 0 ? "Select a character to view frame data" : "No characters loaded."}
          </p>
        </div>
      )}
    </div>
  );
}; 