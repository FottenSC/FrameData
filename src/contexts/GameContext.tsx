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
  const params = useParams<{ gameId?: string; characterName?: string }>();
  const location = useLocation();
  
  const [selectedGame, setSelectedGame] = useState<Game>(() => {
    const gameFromUrl = params.gameId ? AVAILABLE_GAMES.find(g => g.id === params.gameId) : null;
    const savedGameId = !gameFromUrl ? localStorage.getItem('selectedGameId') : null;
    const gameFromStorage = savedGameId ? AVAILABLE_GAMES.find(g => g.id === savedGameId) : null;
    return gameFromUrl || gameFromStorage || AVAILABLE_GAMES[0];
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);

  useEffect(() => {
    let gameChanged = false;
    if (params.gameId && params.gameId !== selectedGame.id) {
      const gameFromUrl = AVAILABLE_GAMES.find(g => g.id === params.gameId);
      if (gameFromUrl) {
        setSelectedGame(gameFromUrl);
        setCharacters([]);
        setSelectedCharacterId(null);
        gameChanged = true;
      }
    }

    if (!gameChanged && selectedGame.id && characters.length > 0) {
      if (params.characterName) {
        const decodedName = decodeURIComponent(params.characterName);
        const characterFromUrl = characters.find(c => c.name.toLowerCase() === decodedName.toLowerCase());
        const characterIdFromUrl = characterFromUrl?.id ?? null;
        
        if (characterIdFromUrl !== selectedCharacterId) {
           setSelectedCharacterId(characterIdFromUrl);
        }
      } else {
        if (selectedCharacterId !== null) {
          setSelectedCharacterId(null);
        }
      }
    }
  }, [params.gameId, params.characterName, characters, selectedGame.id]);

  useEffect(() => {
    localStorage.setItem('selectedGameId', selectedGame.id);
  }, [selectedGame]);

  const handleSetSelectedGameById = (gameId: string) => {
    setIsLoading(true);
    const game = AVAILABLE_GAMES.find(g => g.id === gameId) || AVAILABLE_GAMES[0];
    if (game.id !== selectedGame.id) {
        setSelectedGame(game);
        setCharacters([]);
        setSelectedCharacterId(null);
        navigate(`/${game.id}`);
    } else {
        setSelectedCharacterId(null); 
        navigate(`/${game.id}`);
    }
    setIsLoading(false);
  };

  const handleSetSelectedCharacterId = (id: number | null) => {
    if (id !== selectedCharacterId) {
      setSelectedCharacterId(id);
      if (id !== null) {
        const character = characters.find(c => c.id === id);
        if (character) {
          navigate(`/${selectedGame.id}/${encodeURIComponent(character.name)}`);
        } else {
          navigate(`/${selectedGame.id}`);
        }
      } else {
        navigate(`/${selectedGame.id}`);
      }
    }
  };

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