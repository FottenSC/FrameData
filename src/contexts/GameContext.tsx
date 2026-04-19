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
import {
  applyNotationStyle,
  getNotationStyle,
  getStylesForGame,
  NotationStyle,
} from "@/lib/notation";
import { useUserSettings } from "./UserSettingsContext";
import { clearStringCache } from "@/hooks/useMoves";
import { loadGameData } from "@/lib/loadGameData";

// Define configuration for a game-specific icon with its alt text
export interface IconConfig {
  /** icon code used in Notes strings, e.g. 'UA' */
  code: string;
  /** descriptive title/tooltip text for accessibility */
  title: string;
  /** optional Tailwind classes for icon sizing/aspect ratio */
  iconClasses?: string;
}

// Define Game interface here
export interface Game {
  id: string;
  name: string;
  icons: IconConfig[];
  /** Notation style selected when the user first lands on this game. */
  defaultNotationStyleId: string;
  icon: ReactNode;
  badges?: Record<string, { className: string }>;
}

export interface CreditEntry {
  name: string;
  url?: string;
  role?: string;
}

// Define Character interface here
export interface Character {
  id: number;
  name: string;
  image?: string;
  credits?: CreditEntry[];
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
    // Fallback chip colours used when Game.json#properties doesn't declare a
    // className for the code. Outcome tags (KND / STN / LNC) share a single
    // muted warm-neutral — they all mean "something specific happens next"
    // and carrying three loud, different colours on one row was visual noise.
    // Matches the guard-damage pill in AdvantagePill(tone="guard").
    badges: {
      KND: { className: "bg-stone-600 text-white" },
      STN: { className: "bg-stone-600 text-white" },
      LNC: { className: "bg-stone-600 text-white" },
    },
    defaultNotationStyleId: "soulcalibur",
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
      KND: { className: "bg-stone-600 text-white" },
      STN: { className: "bg-stone-600 text-white" },
      LNC: { className: "bg-stone-600 text-white" },
    },
    defaultNotationStyleId: "tekken",
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
  /** The notation style currently active for the selected game. */
  notationStyle: NotationStyle;
  /** All styles available for the selected game (for the switcher UI). */
  notationStylesForGame: NotationStyle[];
  /** Apply the currently-active style to a command string. Null-safe. */
  applyNotation: (text: string | null) => string | null;
  getStanceInfo: (
    stanceCode: string,
    characterId?: number | null,
  ) => StanceInfo | null;
  /**
   * Lookup descriptive info for a property / outcome-tag code (UA, BA, KND,
   * LNC, STN, …). The same registry — `game.properties` from Game.json — backs
   * both the Properties column and the tag chips rendered inside outcome
   * cells. Returns null when the code isn't in the registry; callers should
   * fall back to rendering the raw code.
   */
  getPropertyInfo: (propertyCode: string) => PropertyInfo | null;
  hitLevels: Record<string, HitLevelInfo>;
  /**
   * Raw registries exposed for UI surfaces that need to enumerate every
   * possible value (the filter builder's multi-select "In list" operator
   * populates its options from these).
   */
  gameStances: Record<string, StanceInfo>;
  characterStances: Record<number, Record<string, StanceInfo>>;
  gameProperties: Record<string, PropertyInfo>;
  gameCredits: CreditEntry[];
  gameCreditsDescription: string | null;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

interface GameProviderProps {
  children: ReactNode;
}

export const GameProvider: React.FC<GameProviderProps> = ({ children }) => {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as {
    gameId?: string;
    characterName?: string;
  };
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
  const [gameStances, setGameStances] = useState<Record<string, StanceInfo>>(
    {},
  );
  // Character-specific stances: characterId -> stanceCode -> StanceInfo
  const [characterStances, setCharacterStances] = useState<
    Record<number, Record<string, StanceInfo>>
  >({});
  // Game-level properties. Doubles as the registry consulted when rendering
  // outcome-tag chips (KND/LNC/STN/…) — a single list in Game.json drives both.
  const [gameProperties, setGameProperties] = useState<
    Record<string, PropertyInfo>
  >({});
  // Game-level hit levels
  const [hitLevels, setHitLevels] = useState<Record<string, HitLevelInfo>>({});
  const [gameCreditsDescription, setGameCreditsDescription] = useState<
    string | null
  >(null);
  const [gameCredits, setGameCredits] = useState<CreditEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
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
        const data = await loadGameData(selectedGame.id);
        if (cancelled) return;

        setCharacters(data.characters);
        setGameCredits(data.credits);
        setGameCreditsDescription(data.creditsDescription);
        setGameStances(data.gameStances);
        setGameProperties(data.gameProperties);
        setCharacterStances(data.characterStances);
        setHitLevels(data.hitLevels);
      } catch (err) {
        if (cancelled) return;
        setCharacterError(
          err instanceof Error
            ? err.message
            : `Unknown error loading characters.`,
        );
        setCharacters([]);
      } finally {
        if (!cancelled) setIsCharactersLoading(false);
      }
    };

    run();
    return () => {
      // Guard against a late-arriving response after the user switches games.
      cancelled = true;
    };
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

  const getIconUrl = useCallback(
    (iconName: string, isHeld: boolean = false): string => {
      const upperIconName = iconName.toUpperCase();
      const heldSuffix = isHeld ? "-" : "";
      return `/Games/${selectedGame.id}/Icons/${upperIconName}${heldSuffix}.svg`;
    },
    [selectedGame.id],
  );

  const { getNotationStyleId } = useUserSettings();

  // Available styles for the current game (for the switcher UI).
  const notationStylesForGame = useMemo(
    () => getStylesForGame(selectedGame.id),
    [selectedGame.id],
  );

  // The single style active for the selected game right now. Always resolves
  // to a concrete style: user's pick → first style for the game → universal.
  const notationStyle: NotationStyle = useMemo(() => {
    const pickedId = getNotationStyleId(
      selectedGame.id,
      selectedGame.defaultNotationStyleId,
    );
    return (
      getNotationStyle(pickedId) ??
      notationStylesForGame[0] ??
        // Last-ditch fallback — a zero-replacement pass-through.
        {
          id: "universal",
          name: "Universal",
          short: "ABCD",
          games: [],
          replacements: {},
        }
    );
  }, [
    getNotationStyleId,
    selectedGame.id,
    selectedGame.defaultNotationStyleId,
    notationStylesForGame,
  ]);

  const applyNotation = useCallback(
    (text: string | null): string | null =>
      applyNotationStyle(text, notationStyle),
    [notationStyle],
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

  // Look up a property by code. Used both by the Properties column and by the
  // outcome-cell tag chips — Game.json's `properties` registry drives both.
  const getPropertyInfo = useCallback(
    (propertyCode: string): PropertyInfo | null =>
      gameProperties[propertyCode] ?? null,
    [gameProperties],
  );

  const contextValue: GameContextType = useMemo(
    () => ({
      selectedGame,
      setSelectedGameById: handleSetSelectedGameById,
      isCharactersLoading,
      characterError,
      characters,
      setCharacters,
      selectedCharacterId,
      setSelectedCharacterId: handleSetSelectedCharacterId,
      availableIcons: combinedIcons,
      gameCreditsDescription,
      getIconUrl: getIconUrl,
      notationStyle,
      notationStylesForGame,
      applyNotation,
      getStanceInfo,
      getPropertyInfo,
      hitLevels,
      gameStances,
      characterStances,
      gameProperties,
      gameCredits,
    }),
    [
      selectedGame,
      handleSetSelectedGameById,
      isCharactersLoading,
      characterError,
      characters,
      selectedCharacterId,
      handleSetSelectedCharacterId,
      gameCreditsDescription,
      combinedIcons,
      getIconUrl,
      notationStyle,
      notationStylesForGame,
      applyNotation,
      getStanceInfo,
      getPropertyInfo,
      hitLevels,
      gameStances,
      characterStances,
      gameProperties,
      gameCredits,
    ],
  );

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
