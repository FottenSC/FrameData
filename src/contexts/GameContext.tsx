import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from "react";
import { Gamepad2, Sword } from "lucide-react";
import { useNavigate, useParams, useLocation } from "@tanstack/react-router";
import { sharedNotationMapping, NotationMap } from "@/lib/notationMapping";
import { useUserSettings } from "./UserSettingsContext";
import { clearStringCache } from "@/hooks/useMoves";

// Define configuration for a game-specific icon with its alt text
export interface IconConfig {
  /** icon code used in Notes strings, e.g. 'UA' */
  code: string;
  /** descriptive title/tooltip text for accessibility */
  title: string;
  /** optional Tailwind classes for icon sizing/aspect ratio */
  iconClasses?: string;
}

// --- Notation Mapping Layer ---
// NotationMap imported from lib

// Define reusable notation mappings
// Define reusable notation mappings
// Moved to src/lib/notationMapping.ts

// Define notation mapping configuration for games
// Define notation mapping configuration for games
export type GameNotationMappingConfig = {
  // extends?: string[]; // Removed: managed by user settings
  specific?: NotationMap; // Game-unique mappings
  defaultEnabled?: string[]; // Default enabled notation mappings for this game
};

// Helper function to build the final notation map for a game
export const buildNotationMap = (
  config: GameNotationMappingConfig,
  enabledNotationMappings: string[],
): NotationMap => {
  let effectiveMap: NotationMap = {};

  // Add mappings from enabled notation mappings (User Settings)
  enabledNotationMappings.forEach((mappingName) => {
    const mapping = sharedNotationMapping[mappingName];
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

// Cache for pre-compiled notation RegExps to avoid expensive re-compilation
// Use WeakMap to allow NotationMap objects to be garbage collected
const notationRegexCache = new WeakMap<NotationMap, { regex: RegExp }>();

// Helper function to apply notation mappings
export const applyNotationMapping = (
  text: string | null,
  map: NotationMap,
): string | null => {
  if (text === null) {
    return null;
  }
  
  const keys = Object.keys(map);
  if (keys.length === 0) return text;

  let cache = notationRegexCache.get(map);
  if (!cache) {
    // Sort keys by length descending to replace longer sequences first
    const sortedKeys = [...keys].sort((a, b) => b.length - a.length);
    const escapedKeys = sortedKeys.map(key => key.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"));
    const regex = new RegExp(escapedKeys.join("|"), "g");
    cache = { regex };
    notationRegexCache.set(map, cache);
  }

  return text.replace(cache.regex, (matched) => map[matched] ?? matched);
};

// Define Game interface here
export interface Game {
  id: string;
  name: string;
  icons: IconConfig[];
  notationMapping: GameNotationMappingConfig;
  icon: ReactNode;
  badges?: Record<string, { className: string }>;
}

// Define Character interface here
export interface Character {
  id: number;
  name: string;
  image?: string;
}

// Define StanceInfo for tooltip display
export interface StanceInfo {
  name: string;
  description: string;
}

// Define PropertyInfo for badge styling
export interface PropertyInfo {
  name: string;
  description: string;
  className: string;
}

// Define HitLevelInfo for styling
export interface HitLevelInfo {
  name: string;
  description: string;
  className: string;
}

// Define avaliableGames here
export const avaliableGames: Game[] = [
  {
    id: "SoulCalibur6",
    name: "Soulcalibur VI",
    icon: <Sword className="h-5 w-5 mr-2" />,
    badges: {
      KND: { className: "bg-fuchsia-800 text-white" },
      STN: { className: "bg-pink-700 text-white" },
      LNC: { className: "bg-rose-700 text-white" },
    },
    notationMapping: {
      specific: {},
      defaultEnabled: ["soulcaliburButtons"],
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
    notationMapping: {
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
  getNotationMap: () => NotationMap;
  applyNotation: (text: string | null) => string | null;
  getStanceInfo: (stanceCode: string, characterId?: number | null) => StanceInfo | null;
  getPropertyInfo: (propertyCode: string) => PropertyInfo | null;
  hitLevels: Record<string, HitLevelInfo>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

interface GameProviderProps {
  children: ReactNode;
}

export const GameProvider: React.FC<GameProviderProps> = ({ children }) => {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { gameId?: string; characterName?: string };
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
  // Game-level stances (shared across all characters)
  const [gameStances, setGameStances] = useState<Record<string, StanceInfo>>({});
  // Character-specific stances: characterId -> stanceCode -> StanceInfo
  const [characterStances, setCharacterStances] = useState<Record<number, Record<string, StanceInfo>>>({});
  // Game-level properties
  const [gameProperties, setGameProperties] = useState<Record<string, PropertyInfo>>({});
  // Game-level hit levels
  const [hitLevels, setHitLevels] = useState<Record<string, HitLevelInfo>>({});

  useEffect(() => {
    const loadCharacters = async () => {
      if (!selectedGame) {
        setCharacters([]);
        setIsCharactersLoading(false);
        setCharacterError("No game selected.");
        return;
      }

      // Clear interning caches when switching games to free memory
      clearStringCache();

      setIsCharactersLoading(true);
      setCharacterError(null);
      setCharacters([]);

      try {
        // Load from public/Games/{gameId}/Game.json
        const url = `/Games/${encodeURIComponent(
          selectedGame.id,
        )}/Game.json`;
        const res = await fetch(url);
        if (!res.ok)
          throw new Error(
            `Failed to fetch game data (${res.status}): ${res.statusText}`,
          );
        const data = await res.json();
        const charactersData: Character[] = (
          Array.isArray(data?.characters) ? data.characters : []
        ).map((c: any) => ({
          id: Number(c.id),
          name: String(c.name),
          image: c.image
            ? `/Games/${encodeURIComponent(selectedGame.id)}/Images/${c.image}`
            : undefined,
        }));
        setCharacters(charactersData);

        // Load game-level stances
        if (data?.stances && typeof data.stances === "object") {
          const stances: Record<string, StanceInfo> = {};
          for (const [code, info] of Object.entries(data.stances)) {
            const stanceData = info as { name?: string; description?: string };
            stances[code] = {
              name: stanceData.name || code,
              description: stanceData.description || "",
            };
          }
          setGameStances(stances);
        } else {
          setGameStances({});
        }

        // Load game-level properties
        if (data?.properties && typeof data.properties === "object") {
          const properties: Record<string, PropertyInfo> = {};
          for (const [code, info] of Object.entries(data.properties)) {
            const propData = info as { name?: string; description?: string; className?: string };
            properties[code] = {
              name: propData.name || code,
              description: propData.description || "",
              className: propData.className || "",
            };
          }
          setGameProperties(properties);
        } else {
          setGameProperties({});
        }

        // Load character-specific stances
        const charStances: Record<number, Record<string, StanceInfo>> = {};
        if (Array.isArray(data?.characters)) {
          for (const char of data.characters) {
            if (char.stances && typeof char.stances === "object") {
              const stances: Record<string, StanceInfo> = {};
              for (const [code, info] of Object.entries(char.stances)) {
                const stanceData = info as { name?: string; description?: string };
                stances[code] = {
                  name: stanceData.name || code,
                  description: stanceData.description || "",
                };
              }
              charStances[Number(char.id)] = stances;
            }
          }
        }
        setCharacterStances(charStances);

        // Load game-level hit levels
        if (data?.hitLevels && typeof data.hitLevels === "object") {
          const levels: Record<string, HitLevelInfo> = {};
          for (const [code, info] of Object.entries(data.hitLevels)) {
            if (typeof info === "string") {
              levels[code] = { name: info, description: "", className: "" };
            } else {
              const levelData = info as { name?: string; description?: string; className?: string };
              levels[code] = {
                name: levelData.name || code,
                description: levelData.description || "",
                className: levelData.className || "",
              };
            }
          }
          setHitLevels(levels);
        } else {
          setHitLevels({});
        }
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
      if (typeof React.startTransition === "function") {
        React.startTransition(() => {
          setSelectedGame(game);
          setSelectedCharacterId(null);
        });
      } else {
        setSelectedGame(game);
        setSelectedCharacterId(null);
      }
      navigate({ to: `/${game.id}` });
    } else if (game && game.id === selectedGame?.id) {
      if (typeof React.startTransition === "function") {
        React.startTransition(() => {
          setSelectedCharacterId(null);
        });
      } else {
        setSelectedCharacterId(null);
      }
      navigate({ to: `/${game.id}` });
    }
  };

  const handleSetSelectedCharacterId = (id: number | null) => {
    if (id !== selectedCharacterId) {
      if (typeof React.startTransition === "function") {
        React.startTransition(() => {
          setSelectedCharacterId(id);
        });
      } else {
        setSelectedCharacterId(id);
      }
    }
  };

  // Combine game-specific icons with universal directional icons
  const combinedIcons = useMemo(() => {
    const combinedIconsMap = new Map<string, IconConfig>();
    DIRECTIONAL_ICONS.forEach((icon) =>
      combinedIconsMap.set(icon.code, icon as IconConfig),
    ); // Add directionals first
    (selectedGame.icons || []).forEach((icon) =>
      combinedIconsMap.set(icon.code, icon),
    ); // Game-specific override/add
    return Array.from(combinedIconsMap.values());
  }, [selectedGame.icons]);

  const getIconUrl = useCallback((iconName: string, isHeld: boolean = false): string => {
    const upperIconName = iconName.toUpperCase();
    const heldSuffix = isHeld ? "-" : "";
    return `/Games/${selectedGame.id}/Icons/${upperIconName}${heldSuffix}.svg`;
  }, [selectedGame.id]);

  const { getEnabledNotationMappings } = useUserSettings();

  // Memoize notation map for the selected game
  const notationMap: NotationMap = useMemo(() => {
    const enabled = getEnabledNotationMappings(
      selectedGame.id,
      selectedGame.notationMapping.defaultEnabled,
    );
    return buildNotationMap(selectedGame.notationMapping, enabled);
  }, [selectedGame.id, selectedGame.notationMapping, getEnabledNotationMappings]);

  const getNotationMap = useCallback((): NotationMap => notationMap, [notationMap]);

  const applyNotation = useCallback(
    (text: string | null): string | null => {
      return applyNotationMapping(text, notationMap);
    },
    [notationMap],
  );

  // Get stance info by code, checking character-specific stances first, then game-level
  const getStanceInfo = useCallback(
    (stanceCode: string, characterId?: number | null): StanceInfo | null => {
      // First check character-specific stances if characterId is provided
      if (characterId != null && characterId !== -1) {
        const charStances = characterStances[characterId];
        if (charStances && charStances[stanceCode]) {
          return charStances[stanceCode];
        }
      }
      // Fall back to game-level stances
      if (gameStances[stanceCode]) {
        return gameStances[stanceCode];
      }
      return null;
    },
    [characterStances, gameStances],
  );

  // Get property info by code
  const getPropertyInfo = useCallback(
    (propertyCode: string): PropertyInfo | null => {
      if (gameProperties[propertyCode]) {
        return gameProperties[propertyCode];
      }
      return null;
    },
    [gameProperties],
  );

  const contextValue: GameContextType = useMemo(() => ({
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
    getNotationMap,
    applyNotation,
    getStanceInfo,
    getPropertyInfo,
    hitLevels,
  }), [
    selectedGame,
    handleSetSelectedGameById,
    isCharactersLoading,
    characterError,
    characters,
    selectedCharacterId,
    handleSetSelectedCharacterId,
    combinedIcons,
    getIconUrl,
    getNotationMap,
    applyNotation,
    getStanceInfo,
    getPropertyInfo,
    hitLevels,
  ]);

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
