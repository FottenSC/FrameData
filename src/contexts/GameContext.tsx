import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Gamepad2, Sword } from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
// Remove the old import
// import { AVAILABLE_GAMES, Game } from '../components/GameSelector';

// Define configuration for a game-specific icon with its alt text
export interface IconConfig {
  /** icon code used in Notes strings, e.g. 'UA' */
  code: string;
  /** descriptive title/tooltip text for accessibility */
  title: string;
  /** optional Tailwind classes for icon sizing/aspect ratio */
  iconClasses?: string;
}

// --- Translation Layer ---
export type TranslationMap = Record<string, string>;

// Define reusable translation mappings
export const TRANSLATION_MAPPINGS: Record<string, TranslationMap> = {
  soulCaliburButtons: {
    ':(B+C):': ':(B+K):',
    ':(B+D):': ':(B+G):',
    ':(C+D):': ':(K+G):',
    ':A+B+C:': ':A+B+K:',
    ':A+D:': ':A+G:',
    ':A+C:': ':A+K:',
    ':B+C:': ':B+K:',
    ':B+D:': ':B+G:',
    ':C+D:': ':K+G:',
    '(C)': '(K)',
    ':C:': ':K:',
    ':c:': ':k:',
    '(D)': '(G)',
    ':D:': ':G:',
    ':d:': ':g:',
  },
  weirdTekken: {
    ':2::3::6:': ':qcf:',     // Quarter Circle Forward
    ':2::1::4:': ':qcb:',     // Quarter Circle Back
    ':6::2::3:': ':dp:',      // Dragon Punch motion
    ':4::1::2::3::6:': ':hcf:',   // Half Circle Forward
    ':6::3::2::1::4:': ':hcb:',   // Half Circle Back

    ':A:': ':LP:',
    ':B:': ':RP:', 
    ':C:': ':LK:', 
    ':D:': ':RK:', 
  },
};

// Define translation configuration for games
export type GameTranslationConfig = {
  extends?: string[]; // List of mapping names to inherit from
  specific?: TranslationMap; // Game-unique mappings
};

// Helper function to build the final translation map for a game
export const buildTranslationMap = (config: GameTranslationConfig): TranslationMap => {
  let effectiveMap: TranslationMap = {};

  // Add mappings from extended modules
  if (config.extends) {
    config.extends.forEach(mappingName => {
      const mapping = TRANSLATION_MAPPINGS[mappingName];
      if (mapping) {
        effectiveMap = { ...effectiveMap, ...mapping };
      }
    });
  }

  // Add/override with game-specific mappings
  if (config.specific) {
    effectiveMap = { ...effectiveMap, ...config.specific };
  }

  return effectiveMap;
};

// Helper function to apply translations
export const translateString = (text: string | null, map: TranslationMap): string | null => {
  if (text === null) {
    return null;
  }
  let translatedText = text;
  // Sort keys by length descending to replace longer sequences first
  const sortedKeys = Object.keys(map).sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(escapedKey, 'g');
    translatedText = translatedText.replace(regex, map[key]);
  }

  return translatedText;
};

// Define Game interface here
export interface Game {
  id: string;
  name: string;
  dbPath: string;
  /** List of available icon configurations for this game */
  icons: IconConfig[];
  /** Translation configuration for command and note text */
  translations: GameTranslationConfig;
  icon: ReactNode;
}

// Define Character interface here
export interface Character {
  id: number;
  name: string;
}

// Define avaliableGames here
export const avaliableGames: Game[] = [
  {
    id: 'SoulCalibur6',
    name: 'SoulCalibur VI',
    dbPath: '/SoulCalibur6/FrameData.db',
    icon: <Sword className="h-5 w-5 mr-2" />,
    translations: {
      extends: ['soulCaliburButtons'],
      specific: {}
    },
    icons: [
      // 2x1 icons
      { code: 'UA', title: 'Unblockable', iconClasses: 'h-4 w-8' },
      { code: 'UC', title: 'Universal Cancel', iconClasses: 'h-4 w-8' },
      { code: 'SS', title: 'Stance Switch', iconClasses: 'h-4 w-8' },
      { code: 'GC', title: 'Guard Crush', iconClasses: 'h-4 w-8' },
      { code: 'TH', title: 'Throw', iconClasses: 'h-4 w-8' },
      { code: 'CE', title: 'Critical Edge', iconClasses: 'h-4 w-8' },
      { code: 'BA', title: 'Break Attack', iconClasses: 'h-4 w-8' },
      { code: 'GI', title: 'Guard impact', iconClasses: 'h-4 w-8' },
      { code: 'LH', title: 'Lethal hit', iconClasses: 'h-4 w-8' },
      { code: 'SC', title: 'Costs Soulcharge', iconClasses: 'h-4 w-8' },
      { code: 'RE', title: 'Reversal edge', iconClasses: 'h-4 w-8' },

      // 1x1 icons
      { code: 'H', title: 'H' },
      { code: 'M', title: 'M' },
      { code: 'L', title: 'L' },
      { code: 'SM', title: 'SM' },

      // Icons im unsure about
      { code: 'AT', title: 'Attack Throw???', iconClasses: 'h-4 w-8' },
      
      // Game Buttons (assuming 1x1 size, adjust className if needed)
      { code: 'A', title: 'A' },
      { code: 'B', title: 'B' },
      { code: 'K', title: 'K' }, 
      { code: 'G', title: 'G' },
    ],
  },

  {
    id: 'Tekken8',
    name: 'Tekken 8',
    dbPath: '/Tekken8/FrameData.db',
  icon: <Gamepad2 className="h-5 w-5 mr-2" />,
    translations: {
      extends: ['weirdTekken'],
      specific: {}
    },
    icons: [
      { code: 'LP', title: 'Light Punch' },
      { code: 'RP', title: 'Right Punch' },
      { code: 'LK', title: 'Light Kick' },
      { code: 'RK', title: 'Right Kick' },
    ],
  },
];

// Define universally available directional icons (without titles)
const DIRECTIONAL_ICONS: Pick<IconConfig, 'code' | 'iconClasses'>[] = [
  { code: '1' }, { code: '2' }, { code: '3' }, 
  { code: '4' }, { code: '5' }, { code: '6' }, 
  { code: '7' }, { code: '8' }, { code: '9' },
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
  availableIcons: IconConfig[];
  getIconUrl: (iconName: string, isHeld?: boolean) => string;
  getTranslationMap: () => TranslationMap;
  translateText: (text: string | null) => string | null;
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
    const gameFromUrl = params.gameId ? avaliableGames.find(g => g.id === params.gameId) : null;
    const savedGameId = !gameFromUrl ? localStorage.getItem('selectedGameId') : null;
    const gameFromStorage = savedGameId ? avaliableGames.find(g => g.id === savedGameId) : null;
    return gameFromUrl || gameFromStorage || avaliableGames[0];
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
        } else {
          setCharacters([]);
        }
      } catch (err) {
        setCharacterError(err instanceof Error ? err.message : `Unknown error loading characters.`);
        setCharacters([]);
      } finally {
        database?.close();
        setIsCharactersLoading(false);
      }
    };

    loadCharacters();
  }, [selectedGame?.id]);

  useEffect(() => {
    if (selectedGame) {
      localStorage.setItem('selectedGameId', selectedGame.id);
    }
  }, [selectedGame?.id]);

  const handleSetSelectedGameById = (gameId: string) => {
    const game = avaliableGames.find(g => g.id === gameId);
    if (game && game.id !== selectedGame?.id) {
      setSelectedGame(game);
      setSelectedCharacterId(null);
      navigate(`/${game.id}`);
    } else if (game && game.id === selectedGame?.id) {
      setSelectedCharacterId(null);
      navigate(`/${game.id}`);
    }
  };

  const handleSetSelectedCharacterId = (id: number | null) => {
    if (id !== selectedCharacterId) {
      setSelectedCharacterId(id);
    }
  };

  // Combine game-specific icons with universal directional icons
  // Use a Map to handle potential duplicates, giving priority to game-specific icons
  const combinedIconsMap = new Map<string, IconConfig>();
  DIRECTIONAL_ICONS.forEach(icon => combinedIconsMap.set(icon.code, icon as IconConfig)); // Add directionals first
  (selectedGame.icons || []).forEach(icon => combinedIconsMap.set(icon.code, icon)); // Game-specific override/add
  
  const combinedIcons = Array.from(combinedIconsMap.values());

  const getIconUrl = (iconName: string, isHeld: boolean = false): string => {
    const upperIconName = iconName.toUpperCase();
    return `/${selectedGame.id}/Icons/${upperIconName}.svg`;
  };

  const getTranslationMap = (): TranslationMap => {
    return buildTranslationMap(selectedGame.translations);
  };

  const translateText = (text: string | null): string | null => {
    const translationMap = getTranslationMap();
    return translateString(text, translationMap);
  };

  const contextValue: GameContextType = {
    selectedGame,
    setSelectedGameById: handleSetSelectedGameById,
    isCharactersLoading,
    characterError,
    characters,
    setCharacters,
    selectedCharacterId,
    setSelectedCharacterId: handleSetSelectedCharacterId,
    availableIcons: combinedIcons, // Use the combined list
    getIconUrl: getIconUrl, // Use the updated function
    getTranslationMap,
    translateText,
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