import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { Gamepad2, Sword } from "lucide-react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { sharedTranslation, TranslationMap } from "@/lib/translations";
import { useUserSettings } from "./UserSettingsContext";

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
// TranslationMap imported from lib

// Define reusable translation mappings
// Define reusable translation mappings
// Moved to src/lib/translations.ts

// Define translation configuration for games
// Define translation configuration for games
export type GameTranslationConfig = {
  // extends?: string[]; // Removed: managed by user settings
  specific?: TranslationMap; // Game-unique mappings
  defaultEnabled?: string[]; // Default enabled translations for this game
};

// Helper function to build the final translation map for a game
export const buildTranslationMap = (
  config: GameTranslationConfig,
  enabledTranslations: string[]
): TranslationMap => {
  let effectiveMap: TranslationMap = {};

  // Add mappings from enabled translations (User Settings)
  enabledTranslations.forEach((mappingName) => {
    const mapping = sharedTranslation[mappingName];
    if (mapping) {
      effectiveMap = { ...effectiveMap, ...mapping };
    }
  });

  // Add/override with game-specific mappings
  if (config.specific) {
    effectiveMap = { ...effectiveMap, ...config.specific };
  }

  return effectiveMap;
};

// Helper function to apply translations
export const translateString = (
  text: string | null,
  map: TranslationMap,
): string | null => {
  if (text === null) {
    return null;
  }
  let translatedText = text;
  // Sort keys by length descending to replace longer sequences first
  const sortedKeys = Object.keys(map).sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(escapedKey, "g");
    translatedText = translatedText.replace(regex, map[key]);
  }

  return translatedText;
};

// Define Game interface here
export interface Game {
  id: string;
  name: string;
  icons: IconConfig[];
  translations: GameTranslationConfig;
  icon: ReactNode;
  badges?: Record<string, { className: string }>;
}

// Define Character interface here
export interface Character {
  id: number;
  name: string;
}

// Define avaliableGames here
export const avaliableGames: Game[] = [
  {
    id: "SoulCalibur6",
    name: "SoulCalibur VI",
    icon: <Sword className="h-5 w-5 mr-2" />,
    badges: {
      KND: { className: "bg-fuchsia-700 text-white" },
      STN: { className: "bg-pink-700 text-white" },
      LNC: { className: "bg-rose-700 text-white" },
    },
    translations: {
      specific: {},
      defaultEnabled: ["soulCaliburButtons"],
    },
    icons: [
      // 2x1 icons
      { code: "UA", title: "Unblockable", iconClasses: "h-4 w-8" },
      { code: "UC", title: "Universal Cancel", iconClasses: "h-4 w-8" },
      { code: "SS", title: "Stance Switch", iconClasses: "h-4 w-8" },
      { code: "GC", title: "Guard Crush", iconClasses: "h-4 w-8" },
      { code: "TH", title: "Throw", iconClasses: "h-4 w-8" },
      { code: "CE", title: "Critical Edge", iconClasses: "h-4 w-8" },
      { code: "BA", title: "Break Attack", iconClasses: "h-4 w-8" },
      { code: "GI", title: "Guard impact", iconClasses: "h-4 w-8" },
      { code: "LH", title: "Lethal hit", iconClasses: "h-4 w-8" },
      { code: "SC", title: "Costs Soulcharge", iconClasses: "h-4 w-8" },
      { code: "RE", title: "Reversal edge", iconClasses: "h-4 w-8" },

      // 1x1 icons
      { code: "H", title: "H" },
      { code: "M", title: "M" },
      { code: "L", title: "L" },
      { code: "SM", title: "SM" },

      // Game Buttons
      { code: "A", title: "A" },
      { code: "B", title: "B" },
      { code: "K", title: "K" },
      { code: "G", title: "G" },
    ],
  },

  {
    id: "Tekken8",
    name: "Tekken 8",
    icon: <Gamepad2 className="h-5 w-5 mr-2" />,
    badges: {
      KND: { className: "bg-indigo-700 text-white" },
      STN: { className: "bg-amber-700 text-white" },
      LNC: { className: "bg-rose-700 text-white" },
    },
    translations: {
      specific: {},
      defaultEnabled: ["weirdTekken"],
    },
    icons: [
      { code: "LP", title: "Light Punch" },
      { code: "RP", title: "Right Punch" },
      { code: "LK", title: "Light Kick" },
      { code: "RK", title: "Right Kick" },
    ],
  },
];

// Define universally available directional icons (without titles)
const DIRECTIONAL_ICONS: Pick<IconConfig, "code" | "iconClasses">[] = [
  { code: "1" },
  { code: "2" },
  { code: "3" },
  { code: "4" },
  { code: "5" },
  { code: "6" },
  { code: "7" },
  { code: "8" },
  { code: "9" },
];

// No longer using SQL.js globally; data is loaded from static JSON in public/Games

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
    const gameFromUrl = params.gameId
      ? avaliableGames.find((g) => g.id === params.gameId)
      : null;
    const savedGameId = !gameFromUrl
      ? localStorage.getItem("selectedGameId")
      : null;
    const gameFromStorage = savedGameId
      ? avaliableGames.find((g) => g.id === savedGameId)
      : null;
    return gameFromUrl || gameFromStorage || avaliableGames[0];
  });

  const [isCharactersLoading, setIsCharactersLoading] = useState(true);
  const [characterError, setCharacterError] = useState<string | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(
    null,
  );

  useEffect(() => {
    const loadCharacters = async () => {
      if (!selectedGame) {
        setCharacters([]);
        setIsCharactersLoading(false);
        setCharacterError("No game selected.");
        return;
      }

      setIsCharactersLoading(true);
      setCharacterError(null);
      setCharacters([]);

      try {
        // Load from public/Games/{gameId}/Characters.json
        const url = `/Games/${encodeURIComponent(
          selectedGame.id,
        )}/Characters.json`;
        const res = await fetch(url);
        if (!res.ok)
          throw new Error(
            `Failed to fetch characters (${res.status}): ${res.statusText}`,
          );
        const data = await res.json();
        const charactersData: Character[] = (
          Array.isArray(data) ? data : []
        ).map((c: any) => ({
          id: Number(c.id),
          name: String(c.name),
        }));
        setCharacters(charactersData);
      } catch (err) {
        setCharacterError(
          err instanceof Error
            ? err.message
            : `Unknown error loading characters.`,
        );
        setCharacters([]);
      } finally {
        setIsCharactersLoading(false);
      }
    };

    loadCharacters();
  }, [selectedGame?.id]);

  useEffect(() => {
    if (selectedGame) {
      localStorage.setItem("selectedGameId", selectedGame.id);
    }
  }, [selectedGame?.id]);

  const handleSetSelectedGameById = (gameId: string) => {
    const game = avaliableGames.find((g) => g.id === gameId);
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
  const combinedIconsMap = new Map<string, IconConfig>();
  DIRECTIONAL_ICONS.forEach((icon) =>
    combinedIconsMap.set(icon.code, icon as IconConfig),
  ); // Add directionals first
  (selectedGame.icons || []).forEach((icon) =>
    combinedIconsMap.set(icon.code, icon),
  ); // Game-specific override/add

  const combinedIcons = Array.from(combinedIconsMap.values());

  const getIconUrl = (iconName: string, isHeld: boolean = false): string => {
    const upperIconName = iconName.toUpperCase();
    return `/Games/${selectedGame.id}/Icons/${upperIconName}.svg`;
  };

  const { getEnabledTranslations } = useUserSettings();

  // Memoize translation map for the selected game
  const translationMap = React.useMemo<TranslationMap>(() => {
    const enabled = getEnabledTranslations(
      selectedGame.id,
      selectedGame.translations.defaultEnabled
    );
    return buildTranslationMap(selectedGame.translations, enabled);
  }, [
    selectedGame.id,
    selectedGame.translations,
    getEnabledTranslations,
  ]);

  const getTranslationMap = (): TranslationMap => translationMap;

  const translateText = (text: string | null): string | null => {
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
    availableIcons: combinedIcons,
    getIconUrl: getIconUrl,
    getTranslationMap,
    translateText,
  };

  return (
    <GameContext.Provider value={contextValue}>{children}</GameContext.Provider>
  );
};

export const useGame = (): GameContextType => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
};
