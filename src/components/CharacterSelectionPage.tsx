import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame, Character } from '../contexts/GameContext';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Loader2 } from 'lucide-react';

// Declare initSqlJs globally if not already done elsewhere
declare global {
  interface Window {
    initSqlJs: () => Promise<any>;
  }
}

export const CharacterSelectionPage: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const { selectedGame, characters, setCharacters, setSelectedCharacterId } = useGame();
  const navigate = useNavigate();

  // Add local state for loading and errors
  const [isLoadingChars, setIsLoadingChars] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Effect to load characters when the game changes
  useEffect(() => {
    // Function to load database and fetch characters
    const loadCharacters = async () => {
      if (!selectedGame?.dbPath) {
        // Don't set an error here, might just be initial state
        // setError("No database path configured for the selected game.");
        setCharacters([]); // Ensure characters are clear if no path
        return;
      }

      // Only load if characters are not already loaded for this game
      // (Simple check, might need refinement if context updates differently)
      // Let's always reload for now to ensure freshness, context clears it anyway
      // if (characters.length > 0) return; 

      setIsLoadingChars(true);
      setError(null);
      setCharacters([]); // Clear existing characters before loading new ones

      try {
        const SQL = await window.initSqlJs();
        const response = await fetch(selectedGame.dbPath);
        if (!response.ok) throw new Error(`Failed to fetch database: ${response.statusText}`);
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const database = new SQL.Database(uint8Array);
        // Note: DB instance is local to this effect and discarded after use

        // Fetch Characters
        const charactersResult = database.exec('SELECT ID, Name FROM Characters ORDER BY Name ASC');
        if (charactersResult.length > 0 && charactersResult[0].values.length > 0) {
          const charactersData: Character[] = charactersResult[0].values.map((row: unknown[]) => ({
            id: Number(row[0]),
            name: String(row[1])
          }));
          setCharacters(charactersData); // Update context state
        } else {
          setCharacters([]); // No characters found
        }
        database.close(); // Close the database connection
      } catch (err) {
        console.error("Error loading characters:", err);
        setError(err instanceof Error ? err.message : `Error loading characters for ${selectedGame.name}`);
        setCharacters([]); // Clear characters on error
      } finally {
        setIsLoadingChars(false);
      }
    };

    loadCharacters();

    // Cleanup function to potentially cancel fetches if component unmounts or game changes quickly
    // (omitted for brevity, but consider AbortController)

  }, [selectedGame?.dbPath, setCharacters]); // Dependency: run when dbPath changes

  const handleCharacterSelect = (characterId: number) => {
    const character = characters.find(c => c.id === characterId);
    if (character && selectedGame) {
      setSelectedCharacterId(characterId);
      navigate(`/${selectedGame.id}/${encodeURIComponent(character.name)}`);
    } else {
      console.error("Selected character or game not found during navigation");
      navigate('/games');
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Select Character for {selectedGame?.name || 'Game'}</h1>
      
      {/* Loading State */}
      {isLoadingChars && (
        <div className="flex items-center justify-center h-[40vh]">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading characters...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoadingChars && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Characters</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive/90">{error}</p>
            <Button variant="outline" size="sm" onClick={() => navigate('/games')} className="mt-4">
              Back to Game Selection
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Character List - Only show if not loading and no error */}
      {!isLoadingChars && !error && selectedGame && characters.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-fadeIn">
          {characters.map((character) => (
            <Card
              key={character.id}
              className="hover:shadow-lg transition-shadow duration-200 cursor-pointer flex flex-col items-center p-4 text-center"
              onClick={() => handleCharacterSelect(character.id)}
            >
              <CardHeader className="p-0 mb-2 flex-grow flex items-center justify-center">
                <CardTitle className="text-lg">{character.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-0 mt-auto">
                <Button variant="outline" size="sm">Select</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* No Characters Found State */}
      {!isLoadingChars && !error && selectedGame && characters.length === 0 && (
         <div className="text-center text-muted-foreground mt-8">
            <p>No characters found for {selectedGame.name}.</p>
             <Button variant="link" onClick={() => navigate('/games')} className="mt-2">
              Back to Game Selection
            </Button>
          </div>
      )}

      {/* Initial state before game is fully selected (should be brief) */}
      {!selectedGame && !isLoadingChars && !error && (
         <div className="text-center text-muted-foreground mt-8">Select a game first.</div>
      )}
    </div>
  );
}; 