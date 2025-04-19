import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
// Remove the old import
// import { AVAILABLE_GAMES, Game } from '../components/GameSelector';

// Define Game interface here
export interface Game {
  id: string;
  name: string;
  dbPath: string;
}

// Define Character interface here
export interface Character {
  id: number;
  name: string;
}

// Define AVAILABLE_GAMES here
export const AVAILABLE_GAMES: Game[] = [
  {
    id: 'SoulCalibur6',
    name: 'SoulCalibur VI',
    dbPath: '/SoulCalibur6/FrameData.db'
  },
  {
    id: 'Tekken8',
    name: 'Tekken 8',
    dbPath: '/Tekken8/FrameData.db'
  }
];

// Declare initSqlJs globally
declare global {
  interface Window {
    initSqlJs: () => Promise<any>;
  }
}

interface GameContextType {
  selectedGame: Game;
  setSelectedGameById: (gameId: string) => void;
  isCharactersLoading: boolean;
  characterError: string | null;
  characters: Character[];
  setCharacters: (chars: Character[]) => void;
  selectedCharacterId: number | null;
  setSelectedCharacterId: (id: number | null) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

interface GameProviderProps {
  children: ReactNode;
}

export const GameProvider: React.FC<GameProviderProps> = ({ children }) => {
  const navigate = useNavigate();
  const params = useParams<{ gameId?: string; characterName?: string }>();
  const location = useLocation();
  
  const [selectedGame, setSelectedGame] = useState<Game>(() => {
    const gameFromUrl = params.gameId ? AVAILABLE_GAMES.find(g => g.id === params.gameId) : null;
    const savedGameId = !gameFromUrl ? localStorage.getItem('selectedGameId') : null;
    const gameFromStorage = savedGameId ? AVAILABLE_GAMES.find(g => g.id === savedGameId) : null;
    return gameFromUrl || gameFromStorage || AVAILABLE_GAMES[0];
  });
  
  const [isCharactersLoading, setIsCharactersLoading] = useState(true);
  const [characterError, setCharacterError] = useState<string | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);

  useEffect(() => {
    const loadCharacters = async () => {
      if (!selectedGame || !selectedGame.dbPath) {
        setCharacters([]);
        setIsCharactersLoading(false);
        setCharacterError("Selected game or database path is invalid.");
        return;
      }

      console.log(`Context: Loading characters for ${selectedGame.id}`);
      setIsCharactersLoading(true);
      setCharacterError(null);
      setCharacters([]);

      let database: any = null;
      try {
        const SQL = await window.initSqlJs();
        const response = await fetch(selectedGame.dbPath);
        if (!response.ok) throw new Error(`Failed to fetch database (${response.status}): ${response.statusText}`);
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        database = new SQL.Database(uint8Array);

        const charactersResult = database.exec('SELECT ID, Name FROM Characters ORDER BY Name ASC');
        if (charactersResult.length > 0 && charactersResult[0].values.length > 0) {
          const charactersData: Character[] = charactersResult[0].values.map((row: unknown[]) => ({
            id: Number(row[0]),
            name: String(row[1])
          }));
          setCharacters(charactersData);
          console.log(`Context: Loaded ${charactersData.length} characters for ${selectedGame.id}`);
        } else {
          console.log(`Context: No characters found in DB for ${selectedGame.id}`);
          setCharacters([]);
        }
      } catch (err) {
        console.error(`Context: Error loading characters for ${selectedGame.id}:`, err);
        setCharacterError(err instanceof Error ? err.message : `Unknown error loading characters.`);
        setCharacters([]);
      } finally {
        database?.close();
        setIsCharactersLoading(false);
        console.log(`Context: Finished loading characters for ${selectedGame.id}`);
      }
    };

    loadCharacters();
  }, [selectedGame?.id]);

  useEffect(() => {
    let gameChanged = false;
    if (params.gameId && params.gameId !== selectedGame.id) {
      const gameFromUrl = AVAILABLE_GAMES.find(g => g.id === params.gameId);
      if (gameFromUrl) {
        console.log(`Context: Game changed via URL to ${gameFromUrl.id}`);
        setSelectedGame(gameFromUrl);
        setSelectedCharacterId(null);
        gameChanged = true;
      } else {
        console.warn(`Context: Invalid game ID in URL: ${params.gameId}`);
      }
    }

    if (!gameChanged && !isCharactersLoading && characters.length > 0) {
      const currentUrlName = params.characterName ? decodeURIComponent(params.characterName).toLowerCase() : null;
      const characterFromUrl = currentUrlName ? characters.find(c => c.name.toLowerCase() === currentUrlName) : null;
      const characterIdFromUrl = characterFromUrl?.id ?? null;

      if (characterIdFromUrl !== selectedCharacterId) {
          console.log(`Context: Setting character ID from URL: ${characterIdFromUrl} (Name: ${params.characterName})`);
          setSelectedCharacterId(characterIdFromUrl);
      }
    } else if (!gameChanged && !isCharactersLoading && !params.characterName && selectedCharacterId !== null) {
       console.log(`Context: Clearing character ID because URL has no character name.`);
       setSelectedCharacterId(null);
    }
  }, [params.gameId, params.characterName, isCharactersLoading, characters, selectedGame.id]);

  useEffect(() => {
    if (selectedGame) {
      localStorage.setItem('selectedGameId', selectedGame.id);
    }
  }, [selectedGame?.id]);

  const handleSetSelectedGameById = (gameId: string) => {
    const game = AVAILABLE_GAMES.find(g => g.id === gameId);
    if (game && game.id !== selectedGame?.id) {
      console.log(`Context: Setting game via handler to ${game.id}`);
      setSelectedGame(game);
      setSelectedCharacterId(null);
      navigate(`/${game.id}`);
    } else if (game && game.id === selectedGame?.id) {
      console.log(`Context: Re-selecting same game ${game.id}, navigating to char select`);
      setSelectedCharacterId(null);
      navigate(`/${game.id}`);
    }
  };

  const handleSetSelectedCharacterId = (id: number | null) => {
    if (id !== selectedCharacterId) {
      setSelectedCharacterId(id);
      if (id !== null) {
        const character = characters.find(c => c.id === id);
        if (character) {
          console.log(`Context: Navigating to character ${character.name}`);
          navigate(`/${selectedGame.id}/${encodeURIComponent(character.name)}`);
        } else {
          console.warn(`Context: Selected character ID ${id} not found in list, navigating to game root.`);
          navigate(`/${selectedGame.id}`); 
        }
      } else {
        console.log(`Context: Navigating to character select page for ${selectedGame.id}`);
        navigate(`/${selectedGame.id}`);
      }
    }
  };

  const contextValue: GameContextType = {
    selectedGame,
    setSelectedGameById: handleSetSelectedGameById,
    isCharactersLoading,
    characterError,
    characters,
    setCharacters,
    selectedCharacterId,
    setSelectedCharacterId: handleSetSelectedCharacterId
  };

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = (): GameContextType => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}; 