import React, { useEffect, useState } from 'react';
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
import { Download, Loader2, Search, Shield, ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useGame, Character, AVAILABLE_GAMES } from '../contexts/GameContext';

// Using the SQL.js loaded via CDN
declare global {
  interface Window {
    initSqlJs: () => Promise<any>;
  }
}

// Updated Move interface based on schema.sql and component usage
interface Move {
  ID: number;
  Command: string;
  Stance: string | null;
  HitLevel: string | null; // From schema (TEXT)
  Impact: number; // From schema (REAL)
  Damage: string | null; // Original string representation
  DamageDec: number | null; // Decimal representation for display
  Block: number | null; // For badge rendering, mapped from BlockDec
  HitString: string | null; // Original Hit text
  Hit: number | null; // For badge rendering, mapped from HitDec
  CounterHitString: string | null; // Original Counter Hit text
  CounterHit: number | null; // For badge rendering, mapped from CounterHitDeci
  GuardBurst: number | null; // From schema (INTEGER)
  Notes: string | null; // From schema
}

// Define sortable columns (using Move interface keys for type safety)
type SortableColumn = keyof Move | 'Damage' | 'Hit' | 'CounterHit'; // Allow specific strings if needed for clarity/mapping

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
    setSelectedCharacterId
  } = useGame();
  
  const [db, setDb] = useState<any | null>(null);
  const [originalMoves, setOriginalMoves] = useState<Move[]>([]); // Store the original, unsorted moves
  const [displayedMoves, setDisplayedMoves] = useState<Move[]>([]); // Moves to display (sorted)
  const [loading, setLoading] = useState(true);
  const [movesLoading, setMovesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Sorting State ---
  const [sortColumn, setSortColumn] = useState<SortableColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // --- State for Expanded Hit Levels ---
  const [expandedHitLevels, setExpandedHitLevels] = useState<Set<number>>(new Set());
  // Track previous expanded state to detect animation direction
  const [previouslyExpanded, setPreviouslyExpanded] = useState<Map<number, boolean>>(new Map());

  // --- Effect 1: Sync URL with selectedCharacterId from Context --- 
  useEffect(() => {
    if (selectedCharacterId !== null && characters.length > 0 && selectedGame.id) {
      const selectedChar = characters.find(c => c.id === selectedCharacterId);
      if (selectedChar) {
        const expectedUrlName = encodeURIComponent(selectedChar.name);
        const currentUrlName = characterName ? encodeURIComponent(decodeURIComponent(characterName)) : undefined;
        
        // If URL doesn't match the selected character, update it - removed /character/
        if (expectedUrlName !== currentUrlName) {
           navigate(`/${selectedGame.id}/${expectedUrlName}`, { replace: true }); 
        }
      }
      // Optional: Handle case where selectedCharacterId is not in the current characters list (maybe clear it?)
    }
  }, [selectedCharacterId, characters, selectedGame.id, navigate, characterName]); // Include characterName to re-check after potential navigation

  // --- Effect 2: Handle Initial Load / URL Parameters -> State --- 
  useEffect(() => {
    if (!selectedGame.id) return; // Wait for game context

    // Handle Game ID change from URL
    if (gameId && gameId !== selectedGame.id) {
      const game = AVAILABLE_GAMES.find(g => g.id === gameId);
      if (game) {
        setSelectedGameById(gameId);
        return; // Let game change propagate
      }
    }

    // Handle Character from URL *only if* characters are loaded and context doesn't have a valid selection yet
    if (characterName && characters.length > 0 && (selectedCharacterId === null || !characters.some(c => c.id === selectedCharacterId))) {
      const decodedName = decodeURIComponent(characterName);
      const characterFromName = characters.find(c => c.name.toLowerCase() === decodedName.toLowerCase());

      if (characterFromName) {
        setSelectedCharacterId(characterFromName.id);
      } else {
        // Invalid name in URL, and no valid selection in context -> default to first
        const firstCharacter = characters[0];
        if (firstCharacter) {
          setSelectedCharacterId(firstCharacter.id);
          // Let Effect 1 handle correcting the URL
        } else {
          setSelectedCharacterId(null);
        }
      }
    } else if (!characterName && characters.length > 0 && (selectedCharacterId === null || !characters.some(c => c.id === selectedCharacterId))) {
        // No character name in URL, no valid selection in context -> default to first
        const firstCharacter = characters[0];
        if (firstCharacter) {
          setSelectedCharacterId(firstCharacter.id);
          // Let Effect 1 handle correcting the URL
        }
    }

  // Dependencies focused on initial load conditions
  }, [gameId, characterName, selectedGame.id, characters, selectedCharacterId, setSelectedGameById, setSelectedCharacterId]); 


  // --- Effect 3: Load Database (based on selectedGame) --- 
  useEffect(() => {
    // Reset state when game changes
    setOriginalMoves([]); // Keep resetting moves
    setDb(null); // Reset DB
    setLoading(true); // Use loading state for DB loading
    setError(null); // Reset errors
    // setCharacters([]); // REMOVE: Characters are handled by CharacterSelectionPage now

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
        setDb(database); // Set DB state for move loading

        // --- REMOVE Character Fetching --- 
        // try {
        //   const charactersResult = database.exec('SELECT ID, Name FROM Characters');
        //   ...
        //   setCharacters(charactersData); 
        // } catch (charError) {
        //    setCharacters([]);
        // }
        // --- End REMOVE Character Fetching ---

      } catch (error) {
        setError(error instanceof Error ? error.message : `Error loading database for ${selectedGame.name}`);
        setDb(null); // Clear DB on error
        // setCharacters([]); // REMOVE
      } finally {
        setLoading(false); // DB loading finished (or failed)
      }
    };

    loadDatabase();
    
    // Cleanup function could close DB if needed, but FrameDataTable might still use it
    // return () => { db?.close(); }; // Consider cleanup implications

  // Dependency only on dbPath. setCharacters removed.
  }, [selectedGame.dbPath]); // REMOVE setCharacters dependency
  
  // --- Effect 4: Load Moves (based on selectedCharacterId and db) --- 
  useEffect(() => {
    // Clear moves and set loading state when character changes or DB becomes available
    setOriginalMoves([]);
    if (db && selectedCharacterId !== null) { // Check for non-null ID
      setMovesLoading(true); // Start loading moves
      setError(null); // Clear previous move errors

      // Use setTimeout to ensure state update happens before query
      // This helps avoid race conditions with state updates
      const timer = setTimeout(() => {
        try {
          const movesQuery = `
            SELECT
              ID, Command, Stance, HitLevel, Impact, Damage,
              Hit, -- Select the original Hit text column
              CounterHit, -- Select the original Counter Hit text column
              BlockDec, HitDec, CounterHitDec, -- Use CounterHitDec instead of CounterHitDeci
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

              return {
                ID: Number(moveObject.ID),
                Command: String(moveObject.Command),
                Stance: moveObject.Stance ? String(moveObject.Stance) : null,
                HitLevel: moveObject.HitLevel ? String(moveObject.HitLevel) : null,
                Impact: Number(moveObject.Impact),
                Damage: moveObject.Damage ? String(moveObject.Damage) : null,
                DamageDec: moveObject.DamageDec !== null && moveObject.DamageDec !== undefined ? Number(moveObject.DamageDec) : null,
                Block: moveObject.BlockDec !== null && moveObject.BlockDec !== undefined ? Number(moveObject.BlockDec) : null,
                HitString: moveObject.Hit ? String(moveObject.Hit) : null, // Map original Hit text
                Hit: moveObject.HitDec !== null && moveObject.HitDec !== undefined ? Number(moveObject.HitDec) : null, // Numeric value for badge
                CounterHitString: moveObject.CounterHit ? String(moveObject.CounterHit) : null, // Map original Counter Hit text
                CounterHit: moveObject.CounterHitDec !== null && moveObject.CounterHitDec !== undefined ? Number(moveObject.CounterHitDec) : null, // Numeric value for badge (from CounterHitDec)
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
          setMovesLoading(false); // Finish loading moves
        }
      }, 0); // Execute async query shortly after state update

      // Cleanup timeout if effect re-runs before timeout completes
      return () => clearTimeout(timer);

    } else {
       // If no DB or character selected, ensure moves are empty and not loading
       setOriginalMoves([]); // Clear original moves
       setMovesLoading(false);
    }
  }, [db, selectedCharacterId]); // Removed setError from dependencies

  // --- Effect 5: Apply Sorting whenever originalMoves, sortColumn, or sortDirection changes ---
  useEffect(() => {
    if (!sortColumn) {
      setDisplayedMoves(originalMoves); // No sorting, display original order
      return;
    }

    const sorted = [...originalMoves].sort((a, b) => {
      let valA: any;
      let valB: any;

      // Get values based on the sort column
      // Handle special cases like Damage, Hit, CounterHit which sort by numeric value
      switch (sortColumn) {
        case 'Damage':
          valA = a.DamageDec;
          valB = b.DamageDec;
          break;
        case 'Block':
          valA = a.Block;
          valB = b.Block;
          break;
        case 'Hit':
          valA = a.Hit; // Sort by numeric Hit
          valB = b.Hit;
          break;
        case 'CounterHit':
          valA = a.CounterHit; // Sort by numeric CounterHit
          valB = b.CounterHit;
          break;
        case 'GuardBurst':
            valA = a.GuardBurst;
            valB = b.GuardBurst;
            break;
        // Ensure Impact is treated as a number if it exists
        case 'Impact':
            valA = a.Impact;
            valB = b.Impact;
            break;
        // Default case for other keys directly on the Move object
        default:
          // Check if the key exists on the Move type before accessing
          if (sortColumn in a && sortColumn in b) {
            valA = a[sortColumn as keyof Move];
            valB = b[sortColumn as keyof Move];
          } else {
            // Handle cases where the column might not be a direct key (shouldn't happen with SortableColumn type)
            valA = undefined;
            valB = undefined;
          }
          break;
      }

      // --- Revised Null/Undefined Handling: Always push to bottom --- 
      const aIsNull = valA === null || valA === undefined;
      const bIsNull = valB === null || valB === undefined;

      if (aIsNull && !bIsNull) {
        return 1; // a (null) goes after b (non-null)
      }
      if (!aIsNull && bIsNull) {
        return -1; // b (null) goes after a (non-null)
      }
      if (aIsNull && bIsNull) {
        return 0; // Both null, order doesn't matter
      }
      // --- End Revised Null Handling ---

      // Now both valA and valB are non-null, proceed with comparison
      const order = sortDirection === 'asc' ? 1 : -1;

      // Comparison logic for non-null values
      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * order;
      } else if (typeof valA === 'string' && typeof valB === 'string') {
        // Optional: Add case-insensitive string sort if desired
        // return valA.toLowerCase().localeCompare(valB.toLowerCase()) * order;
        return valA.localeCompare(valB) * order;
      } else {
        // Fallback for mixed types or other types (treat as equal)
        return 0;
      }
    });

    setDisplayedMoves(sorted);

  }, [originalMoves, sortColumn, sortDirection]);

  // --- Define a self-contained hit level icon component ---
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
      default:
        console.error(`Unknown hit level encountered: ${level}`);
        break;
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

  // --- Self-contained component for expandable hit levels ---
  const ExpandableHitLevels = React.memo(({ 
    hitLevelString, 
    maxIconsToShow = 3 // Default remains 3 for the 5+ case
  }: { 
    hitLevelString: string | null, 
    maxIconsToShow?: number 
  }) => {
    // Local state for this specific instance
    const [isExpanded, setIsExpanded] = React.useState(false);
    
    // Parse hit levels
    const levels = React.useMemo(() => {
      if (!hitLevelString) return [];
      return hitLevelString.split(/:+/).map(level => level.trim()).filter(Boolean);
    }, [hitLevelString]);
    
    // --- Updated Expansion Logic ---
    // Expand only if there are more levels than maxIconsToShow + 1
    const canExpand = levels.length > maxIconsToShow + 1;
    
    // Handle toggle expansion
    const handleToggle = React.useCallback(() => {
      if (!canExpand) return;
      setIsExpanded(prev => !prev);
    }, [canExpand]);
    
    // If no levels, show placeholder
    if (levels.length === 0) {
      return <span className="text-muted-foreground">—</span>;
    }
    
    // Determine how many icons to show based on expanded state and total count
    let iconsToShow: number;
    if (levels.length <= maxIconsToShow + 1) {
      // Show all icons if the count is within the threshold (maxIconsToShow + 1)
      iconsToShow = levels.length;
    } else {
      // If more than the threshold, show maxIconsToShow initially, or all if expanded
      iconsToShow = isExpanded ? levels.length : maxIconsToShow;
    }
    
    // Show ellipsis only when it can expand and is not expanded
    const showEllipsis = canExpand && !isExpanded;
    // --- End Updated Expansion Logic ---
    
    return (
      <div 
        className={`flex flex-wrap items-center gap-1 ${canExpand ? 'cursor-pointer' : ''}`}
        onClick={canExpand ? handleToggle : undefined}
      >
        {levels.slice(0, iconsToShow).map((level, index) => (
          <div key={`level-${index}`}>
            <HitLevelIcon level={level} />
          </div>
        ))}
        
        {showEllipsis && (
          <ChevronDown size={16} className="text-muted-foreground ml-1" />
        )}
      </div>
    );
  });

  // --- Handler for Sort Click ---
  const handleSort = (column: SortableColumn) => {
    if (sortColumn === column) {
      // If clicking the same column, toggle direction
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      // If clicking a new column, set it and default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Combined badge rendering function
  const renderBadge = (value: number | null, text: string | null, forceNoSign: boolean = false) => {
    // Determine display text: Use text if available, otherwise format value, fallback to '—'
    let displayText: string;
    if (text !== null && text !== undefined) {
      displayText = text;
    } else if (value !== null && value !== undefined) {
      // Only add '+' if value > 0 AND forceNoSign is false
      displayText = (!forceNoSign && value > 0 ? '+' : '') + value; 
    } else {
      displayText = '—';
    }

    // Check for special strings first
    if (text === 'KND') {
      return <Badge className="bg-fuchsia-700 text-white w-12 inline-flex items-center justify-center">{displayText}</Badge>;
    }
    if (text === 'STN') {
      return <Badge className="bg-pink-700 text-white w-12 inline-flex items-center justify-center">{displayText}</Badge>;
    }
    if (text === 'LNC') {
      return <Badge className="bg-rose-700 text-white w-12 inline-flex items-center justify-center">{displayText}</Badge>;
    }

    // Fallback to frame advantage logic based on the numeric value
    if (value === null || value === undefined) {
      // Use neutral Tailwind classes for unknown/null state
      return <Badge className="bg-gray-500 hover:bg-gray-600 text-white w-12 inline-flex items-center justify-center">{displayText}</Badge>; 
    }

    // Use Tailwind classes based on numeric value
    if (value >= 0) { // Includes 0
      return <Badge className="bg-green-700 text-white w-12 inline-flex items-center justify-center">{displayText}</Badge>;
    } else { // value < 0
      return <Badge className="bg-rose-700 text-white w-12 inline-flex items-center justify-center">{displayText}</Badge>;
    }
  };

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
                    // Re-fetch characters and potentially moves depending on logic
                    // This might need a more robust state refresh mechanism
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
    <div className="space-y-6 h-full flex flex-col p-4 flex-grow">
      {selectedCharacterId ? (
        <Card className="h-full flex flex-col overflow-hidden border border-card-border">
          <CardHeader className="pb-2 flex-shrink-0">
            <CardTitle>
              {selectedCharacterNameFromContext || 'Character'} Frame Data 
            </CardTitle>
            <CardDescription>
              Total Moves: {displayedMoves.length}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow p-0 flex flex-col overflow-hidden">
            <div className="overflow-y-auto flex-grow">
              <Table className="table-layout-fixed">
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow  className="border-b-card-border">
                    <TableHead className="w-[100px] p-2 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('Stance')}>
                      <div className="flex items-center justify-between gap-1">
                        <span>Stance</span>
                        {sortColumn === 'Stance' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                      </div>
                    </TableHead>
                    <TableHead className="w-[200px] max-w-[300px] p-2 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('Command')}>
                       <div className="flex items-center justify-between gap-1">
                        <span>Command</span>
                        {sortColumn === 'Command' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                      </div>
                    </TableHead>
                    <TableHead className="w-[135px] min-w-[135px] max-w-[150px] p-2 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('HitLevel')}>
                       <div className="flex items-center justify-between gap-1">
                        <span>Hit Level</span>
                        {sortColumn === 'HitLevel' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                      </div>
                    </TableHead>
                    <TableHead className="w-[50px] p-2 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('Impact')}>
                       <div className="flex items-center justify-between gap-1">
                        <span>Impact</span>
                        {sortColumn === 'Impact' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                      </div>
                    </TableHead>
                    <TableHead className="w-[50px] p-2 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('Damage')}>
                       <div className="flex items-center justify-between gap-1">
                        <span>Damage</span>
                        {sortColumn === 'Damage' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                      </div>
                    </TableHead>
                    <TableHead className="w-[70px] p-2 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('Block')}>
                      <div className="flex items-center justify-between gap-1" title="Block">
                        <Shield size={16} />
                        {sortColumn === 'Block' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                      </div>
                    </TableHead>
                    <TableHead className="w-[60px] p-2 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('Hit')}>
                       <div className="flex items-center justify-between gap-1">
                        <span>Hit</span>
                        {sortColumn === 'Hit' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                      </div>
                    </TableHead>
                    <TableHead title="Counter Hit" className="w-[50px] p-2 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('CounterHit')}>
                       <div className="flex items-center justify-between gap-1">
                        <span>CH</span>
                        {sortColumn === 'CounterHit' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                      </div>
                    </TableHead>
                    <TableHead title="Guard Burst" className="w-[50px] p-2 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('GuardBurst')}>
                       <div className="flex items-center justify-between gap-1">
                        <span>GB</span>
                        {sortColumn === 'GuardBurst' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                      </div>
                    </TableHead>
                    <TableHead className="p-2 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('Notes')}>
                      <div className="flex items-center justify-between gap-1">
                        <span>Notes</span>
                        {sortColumn === 'Notes' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="w-[50px]">
                  {movesLoading ? (
                     <TableRow>
                       <TableCell colSpan={10} className="text-center h-24 p-2">
                         <div className="flex justify-center items-center">
                           <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
                           Loading moves...
                         </div>
                       </TableCell>
                     </TableRow>
                  ) : displayedMoves.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center h-24 p-2">
                        {!loading ? "No moves found for this character." : "Character data loaded, select moves."} 
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayedMoves.map((move) => (
                      <TableRow 
                        key={move.ID} 
                        className="border-b-card-border"
                      >
                        <TableCell className="text-right p-2">{move.Stance || '—'}</TableCell>
                        <TableCell className="font-mono p-2 max-w-[300px] break-words">{move.Command}</TableCell>
                        <TableCell className="p-2 min-w-[135px] max-w-[150px] align-top">
                          <ExpandableHitLevels 
                            hitLevelString={move.HitLevel} 
                            maxIconsToShow={3}
                          />
                        </TableCell>
                        <TableCell className="p-2">{move.Impact ?? '—'}</TableCell>
                        <TableCell className="p-2">{move.DamageDec ?? '—'}</TableCell>
                        <TableCell className="p-2">{renderBadge(move.Block, null)}</TableCell>
                        <TableCell className="p-2">
                          {/* Use combined renderBadge function */}
                          {renderBadge(move.Hit, move.HitString)}
                        </TableCell>
                        <TableCell className="p-2">
                          {/* Use combined renderBadge function */}
                          {renderBadge(move.CounterHit, move.CounterHitString)}
                        </TableCell>
                        <TableCell className="p-2">{renderBadge(move.GuardBurst, null, true)}</TableCell>
                        <TableCell className="max-w-[300px] truncate p-2">
                          {move.Notes || '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground flex-shrink-0">
            Website last deployed: 19 April 2025 at 14:48 CEST
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