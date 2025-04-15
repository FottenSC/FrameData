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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Button } from './ui/button';
import { initializeDatabase } from '../utils/initializeDatabase';
import { Download, Loader2, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { ThemeToggle } from './theme-toggle';
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
  HitLevel: string; // From schema (TEXT)
  Impact: number; // From schema (REAL)
  Damage: string | null; // Original string representation
  DamageDec: number | null; // Decimal representation for display
  Block: number | null; // For badge rendering, mapped from BlockDec
  Hit: number | null; // For badge rendering, mapped from HitDec
  CounterHit: number | null; // For badge rendering, mapped from CounterHitDeci
  GuardBurst: number | null; // From schema (INTEGER)
  Notes: string | null; // From schema
}

export const FrameDataTable: React.FC = () => {
  const params = useParams<{ gameId?: string; characterName?: string }>();
  const { gameId, characterName } = params;
  
  const navigate = useNavigate();
  const {
    selectedGame,
    setSelectedGameById,
    isLoading: gameLoading,
    characters,
    setCharacters,
    selectedCharacterId,
    setSelectedCharacterId
  } = useGame();
  
  const [db, setDb] = useState<any | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);
  const [loading, setLoading] = useState(true);
  const [movesLoading, setMovesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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


  // --- Effect 3: Load Database and Characters (based on selectedGame) --- 
  useEffect(() => {
    // Reset state when game changes
    setMoves([]);
    setDb(null);
    setLoading(true);
    setError(null);
    // Don't reset characters here if we want Effect 1 to potentially use them briefly
    // setCharacters([]); 

    const loadDatabaseAndCharacters = async () => {
      if (!selectedGame.dbPath) {
        setError("No database path configured for the selected game.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true); // Set loading true here
        const SQL = await window.initSqlJs();
        const response = await fetch(selectedGame.dbPath);
        if (!response.ok) throw new Error(`Failed to fetch database: ${response.statusText}`);
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const database = new SQL.Database(uint8Array);
        setDb(database); // Set DB state

        // --- Fetch Characters --- 
        try {
          // Optional: Check schema initialization if needed
          // const tableCheck = database.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='Characters'");
          // ...
          
          const charactersResult = database.exec('SELECT ID, Name FROM Characters');
          if (charactersResult.length > 0 && charactersResult[0].values.length > 0) {
            const charactersData: Character[] = charactersResult[0].values.map((row: unknown[]) => ({
              id: Number(row[0]), // Map ID from schema
              name: String(row[1]) // Map Name from schema
            }));
            setCharacters(charactersData); // Set Characters state
          } else {
            setCharacters([]); // No characters found
          }
        } catch (charError) {
           setCharacters([]);
           // Consider setting a specific error state for characters if needed
        }
        // --- End Fetch Characters ---

      } catch (error) {
        setError(error instanceof Error ? error.message : `Error loading data for ${selectedGame.name}`);
        setDb(null); // Clear DB on error
        setCharacters([]); // Clear characters on error
      } finally {
        setLoading(false); // Set loading false after all attempts
      }
    };

    loadDatabaseAndCharacters();
    
    // Cleanup function is good practice but omitted for brevity here

  // This effect should run ONLY when the selected game's dbPath changes.
  // setCharacters is included because it's used, but it's stable.
  }, [selectedGame.dbPath, setCharacters]);
  
  // --- Effect 4: Load Moves (based on selectedCharacterId and db) --- 
  useEffect(() => {
    // Clear moves and set loading state when character changes or DB becomes available
    setMoves([]); 
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
              BlockDec, HitDec, CounterHitDeci, GuardBurst, Notes, DamageDec 
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
                HitLevel: String(moveObject.HitLevel),
                Impact: Number(moveObject.Impact),
                Damage: moveObject.Damage ? String(moveObject.Damage) : null,
                DamageDec: moveObject.DamageDec !== null && moveObject.DamageDec !== undefined ? Number(moveObject.DamageDec) : null,
                Block: moveObject.BlockDec !== null && moveObject.BlockDec !== undefined ? Number(moveObject.BlockDec) : null,
                Hit: moveObject.HitDec !== null && moveObject.HitDec !== undefined ? Number(moveObject.HitDec) : null,
                CounterHit: moveObject.CounterHitDeci !== null && moveObject.CounterHitDeci !== undefined ? Number(moveObject.CounterHitDeci) : null,
                GuardBurst: moveObject.GuardBurst !== null && moveObject.GuardBurst !== undefined ? Number(moveObject.GuardBurst) : null,
                Notes: moveObject.Notes ? String(moveObject.Notes) : null
              };
            });
            setMoves(movesData);
          } else {
            setMoves([]); 
          }
        } catch (error) {
          setError(error instanceof Error ? error.message : `Unknown error loading moves for character ID ${selectedCharacterId}`);
          setMoves([]); 
        } finally {
          setMovesLoading(false); // Finish loading moves
        }
      }, 0); // Execute async query shortly after state update

      // Cleanup timeout if effect re-runs before timeout completes
      return () => clearTimeout(timer);

    } else {
       // If no DB or character selected, ensure moves are empty and not loading
       setMoves([]);
       setMovesLoading(false);
    }
  }, [db, selectedCharacterId]); // Removed setError from dependencies

  const renderFrameAdvantageBadge = (value: number | null) => {
    if (value === null || value === undefined) return '—'; // Handle undefined as well
    
    const formatted = (value > 0 ? '+' : '') + value;
    
    if (value >= 0) {
      return <Badge variant="success">{formatted}</Badge>;
    } else if (value < 0) {
      return <Badge variant="destructive">{formatted}</Badge>;
    } else {
      return <Badge variant="secondary">{formatted}</Badge>;
    }
  };

  if (gameLoading || loading) {
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
    <div className="space-y-6 h-full flex flex-col p-4">
      {selectedCharacterId ? (
        <Card className="h-full flex flex-col overflow-hidden border border-card-border">
          <CardHeader className="pb-2 flex-shrink-0">
            <CardTitle>
              {/* Use name derived from context ID */}
              {selectedCharacterNameFromContext || 'Character'} Frame Data 
            </CardTitle>
            <CardDescription>
              Total Moves: {moves.length}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow p-0 overflow-hidden">
            <div className="h-full overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow  className="border-b-card-border">
                    <TableHead>Stance</TableHead>
                    <TableHead className="w-[200px]">Command</TableHead>
                    <TableHead>Hit Level</TableHead>
                    <TableHead>Impact</TableHead>
                    <TableHead>Damage</TableHead>
                    <TableHead>Block</TableHead>
                    <TableHead>Hit</TableHead>
                    <TableHead>Counter Hit</TableHead>
                    <TableHead>Guard Burst</TableHead>
                    <TableHead className="w-[200px]">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movesLoading ? (
                     <TableRow>
                       <TableCell colSpan={10} className="text-center h-24">
                         <div className="flex justify-center items-center">
                           <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
                           Loading moves...
                         </div>
                       </TableCell>
                     </TableRow>
                  ) : moves.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center h-24">
                        {!loading ? "No moves found for this character." : "Character data loaded, select moves."} 
                      </TableCell>
                    </TableRow>
                  ) : (
                    moves.map((move) => (
                      <TableRow key={move.ID} className="border-b-card-border">
                        <TableCell>{move.Stance || '—'}</TableCell>
                        <TableCell className="font-mono">{move.Command}</TableCell>
                        <TableCell>{move.HitLevel || '—'}</TableCell>
                        <TableCell>{move.Impact ?? '—'}</TableCell>
                        <TableCell>{move.DamageDec ?? '—'}</TableCell>
                        <TableCell>{renderFrameAdvantageBadge(move.Block)}</TableCell>
                        <TableCell>{renderFrameAdvantageBadge(move.Hit)}</TableCell>
                        <TableCell>{renderFrameAdvantageBadge(move.CounterHit)}</TableCell>
                        <TableCell>{renderFrameAdvantageBadge(move.GuardBurst)}</TableCell>
                        <TableCell className="max-w-[300px] truncate">
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
            Data last updated: April 2024 
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