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
    id: 'soulcalibur6',
    name: 'Soul Calibur VI',
    dbPath: '/SoulCalibur6/framedata.db'
  },
  {
    id: 'tekken8',
    name: 'Tekken 8',
    dbPath: '/Tekken8/framedata.db'
  }
];

interface GameContextType {
  selectedGame: Game;
  setSelectedGameById: (gameId: string) => void;
  isLoading: boolean;
  characters: Character[];             // Add characters state
  setCharacters: (chars: Character[]) => void; // Add setter for characters
  selectedCharacterId: number | null;  // Add selected character ID state
  setSelectedCharacterId: (id: number | null) => void; // Add setter for selected character ID
}

const GameContext = createContext<GameContextType | undefined>(undefined);

interface GameProviderProps {
  children: ReactNode;
}

export const GameProvider: React.FC<GameProviderProps> = ({ children }) => {
  const navigate = useNavigate();
  const params = useParams<{ gameId?: string; characterId?: string }>();
  const location = useLocation();
  
  const [selectedGame, setSelectedGame] = useState<Game>(() => {
    const gameFromUrl = params.gameId ? AVAILABLE_GAMES.find(g => g.id === params.gameId) : null;
    return gameFromUrl || AVAILABLE_GAMES[0];
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(() => {
    return params.characterId ? parseInt(params.characterId, 10) : null;
  });

  // Effect to update state when URL params change
  useEffect(() => {
    if (params.gameId) {
      const game = AVAILABLE_GAMES.find(g => g.id === params.gameId);
      if (game && game.id !== selectedGame.id) {
        setSelectedGame(game);
      }
    }
    
    if (params.characterId) {
      const characterId = parseInt(params.characterId, 10);
      if (characterId !== selectedCharacterId) {
        setSelectedCharacterId(characterId);
      }
    } else if (location.pathname.includes('/game/') && !location.pathname.includes('/character/')) {
      // If we're on a game route without a character, reset character selection
      setSelectedCharacterId(null);
    }
  }, [params, location.pathname]);

  const handleSetSelectedGameById = (gameId: string) => {
    setIsLoading(true);
    const game = AVAILABLE_GAMES.find(g => g.id === gameId) || AVAILABLE_GAMES[0];
    setSelectedGame(game);
    
    // Reset character state when game changes
    setCharacters([]);
    setSelectedCharacterId(null);
    
    // Update URL to reflect game selection
    navigate(`/game/${game.id}`);
    
    // Simulate a short loading period when changing games
    setTimeout(() => setIsLoading(false), 300);
  };

  // Handler for setting selected character with URL update
  const handleSetSelectedCharacterId = (id: number | null) => {
    setSelectedCharacterId(id);
    
    // Update URL to reflect character selection
    if (id !== null) {
      navigate(`/game/${selectedGame.id}/character/${id}`);
    } else {
      navigate(`/game/${selectedGame.id}`);
    }
  };

  // Use local storage to remember the last selected game (if URL doesn't have a game)
  useEffect(() => {
    if (!params.gameId) {
      const savedGameId = localStorage.getItem('selectedGameId');
      if (savedGameId) {
        // Use the internal handler to avoid double loading state
        handleSetSelectedGameById(savedGameId);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('selectedGameId', selectedGame.id);
  }, [selectedGame]);

  return (
    <GameContext.Provider value={{
      selectedGame,
      setSelectedGameById: handleSetSelectedGameById,
      isLoading,
      characters,
      setCharacters,
      selectedCharacterId,
      setSelectedCharacterId: handleSetSelectedCharacterId
    }}>
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