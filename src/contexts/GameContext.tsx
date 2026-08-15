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
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  getNotationStyle,
  getStylesForGame,
  NotationStyle,
} from "@/lib/notation";
import { useUserSettings } from "./UserSettingsContext";
import { clearStringCache } from "@/hooks/useMoves";
import {
  loadGameData,
  getCachedGameData,
  type GameCommunity,
} from "@/lib/loadGameData";
import { withViewTransition } from "@/lib/viewTransition";
import type { ColumnId } from "@/lib/columns";
import {
  findCharacterByRouteName,
  getCharacterRouteName,
} from "@/lib/characterRoute";

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
  /** Canonical external wiki page for this character, when provided. */
  wikiUrl?: string;
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
  /** Shared table columns supported by the active game's Game.json. */
  availableColumns: ColumnId[];
  setSelectedGameById: (gameId: string) => void;
  isCharactersLoading: boolean;
  characterError: string | null;
  characters: Character[];
  setCharacters: (chars: Character[]) => void;
  selectedCharacterId: number | null;
  setSelectedCharacterId: (id: number | null) => void;
  availableIcons: IconConfig[];
  getIconUrl: (iconName: string, isHeld?: boolean) => string;
  /**
   * The notation style currently active for the selected game. Consumers
   * that need to translate tokens should use {@link translateToken} /
   * {@link translateCommand} from `@/lib/notation` with this style — it's
   * memoised per (style, token) so repeated calls across thousands of moves
   * are effectively free.
   */
  notationStyle: NotationStyle;
  /** All styles available for the selected game (for the switcher UI). */
  notationStylesForGame: NotationStyle[];
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
  /**
   * Per-game community / external-resource links surfaced in the
   * credits view (shared spreadsheet, discord, …). Each game's
   * `Game.json` carries its own; games without a `community` block
   * yield an empty object here.
   */
  gameCommunity: GameCommunity;
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
  // `selectedGame` is derived from the URL — the route's `$gameId` segment
  // is the single source of truth. On routes without that segment (the
  // landing page) fall back to the last-used game so the Navbar still has
  // a coherent game to display.
  const selectedGame = useMemo<Game>(() => {
    const fromUrl = params.gameId
      ? avaliableGames.find((g) => g.id === params.gameId)
      : undefined;
    if (fromUrl) return fromUrl;
    const savedId = localStorage.getItem("selectedGameId");
    const fromStorage = savedId
      ? avaliableGames.find((g) => g.id === savedId)
      : undefined;
    return fromStorage || avaliableGames[0];
  }, [params.gameId]);

  const [isCharactersLoading, setIsCharactersLoading] = useState(true);
  const [characterError, setCharacterError] = useState<string | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  // `selectedCharacterId` is derived from the URL's `$characterName`
  // segment. -1 is the "All characters" sentinel; an unknown name (or no
  // segment) yields null. The id↔name mapping needs the loaded character
  // list, so this stays null until `characters` arrives, then resolves.
  const selectedCharacterId = useMemo<number | null>(() => {
    const seg = params.characterName;
    if (!seg) return null;
    const name = decodeURIComponent(seg);
    if (name.toLowerCase() === "all") return -1;
    const match = findCharacterByRouteName(selectedGame.id, name, characters);
    return match ? match.id : null;
  }, [params.characterName, characters, selectedGame.id]);
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
  const [gameCommunity, setGameCommunity] = useState<GameCommunity>({});
  const [loadedColumns, setLoadedColumns] = useState<ColumnId[]>([]);
  const [loadedColumnsGameId, setLoadedColumnsGameId] = useState<string | null>(
    null,
  );
  const availableColumns = useMemo(
    () => (loadedColumnsGameId === selectedGame.id ? loadedColumns : []),
    [loadedColumns, loadedColumnsGameId, selectedGame.id],
  );

  useEffect(() => {
    let cancelled = false;

    /** Shared "apply parsed GameData to context state" helper. */
    const applyGameData = (data: ReturnType<typeof getCachedGameData>) => {
      if (!data) return;
      setCharacters(data.characters);
      setLoadedColumns(data.availableColumns);
      setLoadedColumnsGameId(selectedGame.id);
      setGameCredits(data.credits);
      setGameCreditsDescription(data.creditsDescription);
      setGameCommunity(data.community);
      setGameStances(data.gameStances);
      setGameProperties(data.gameProperties);
      setCharacterStances(data.characterStances);
      setHitLevels(data.hitLevels);
    };

    if (!selectedGame) {
      setCharacters([]);
      setIsCharactersLoading(false);
      setCharacterError("No game selected.");
      return;
    }

    // Cache-hit fast path. If Game.json has already been fetched and
    // parsed this session, populate state synchronously in this same
    // render pass. We deliberately do NOT flip `isCharactersLoading` to
    // true or clear `characters` first — that would force a one-frame
    // "empty skeleton" flicker on a transition that should feel
    // instantaneous (especially when the user is just flipping between
    // two games they've already visited).
    const cached = getCachedGameData(selectedGame.id);
    if (cached) {
      applyGameData(cached);
      setCharacterError(null);
      setIsCharactersLoading(false);
      return;
    }

    // Cold path: no cache hit, fetch + parse. Only now do we show the
    // skeleton and drop the stale character list.
    clearStringCache();
    setIsCharactersLoading(true);
    setCharacterError(null);
    setCharacters([]);
    setLoadedColumns([]);
    setLoadedColumnsGameId(null);

    (async () => {
      try {
        const data = await loadGameData(selectedGame.id);
        if (cancelled) return;
        applyGameData(data);
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
    })();

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

  // The two setters are navigation-only: `selectedGame` and
  // `selectedCharacterId` are derived from the resulting URL, so there is
  // no local state to write. Game selection uses two layers of smoothing:
  //   1. `withViewTransition` gives the BROWSER a cross-fade — it snapshots
  //      old DOM, runs the navigation, snapshots new DOM, animates between
  //      them. A no-op on browsers without the View Transitions API.
  //   2. `React.startTransition` marks the game route swap non-urgent so
  //      Suspense boundaries keep the previous route mounted until the
  //      next one is ready instead of flashing a fallback.
  const handleSetSelectedGameById = useCallback(
    (gameId: string) => {
      if (!avaliableGames.some((g) => g.id === gameId)) return;
      withViewTransition(() => {
        React.startTransition(() => {
          navigate({ to: `/${gameId}` });
        });
      });
    },
    [navigate],
  );

  const handleSetSelectedCharacterId = useCallback(
    (id: number | null) => {
      // null → the game's character-select page; -1 → the "All" view;
      // any other id → that character's page (resolved to its name for
      // the URL). An unknown id is ignored.
      let to = `/${selectedGame.id}`;
      if (id === -1) {
        to = `/${selectedGame.id}/All`;
      } else if (id !== null) {
        const name = characters.find((c) => c.id === id)?.name;
        if (!name) return;
        const routeName = getCharacterRouteName(selectedGame.id, name);
        to = `/${selectedGame.id}/${encodeURIComponent(routeName)}`;
      }
      // Character swaps are deliberately urgent. Wrapping this navigation in
      // startTransition/viewTransition allowed a fast move-data request to
      // finish before React committed the loading render, so the existing
      // table skeleton was skipped and the previous character remained on
      // screen. An immediate route update lets the cold-query skeleton render;
      // cached character data still appears without a loading flash.
      void navigate({ to });
    },
    [navigate, selectedGame.id, characters],
  );

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
      // Numpad direction icons (1–9 plus held variants) are byte-identical
      // across every game we support, so they live ONCE under the shared
      // `/Icons/` root. Game-specific icons (UA, BA, KND, LP, …) still
      // resolve under `/Games/{id}/Icons/` because they're authored per
      // game. The check is a single-character comparison; cheap to run on
      // the render hot path.
      if (iconName.length === 1 && iconName >= "1" && iconName <= "9") {
        return `/Icons/${upperIconName}${heldSuffix}.svg`;
      }
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
      availableColumns,
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
      getStanceInfo,
      getPropertyInfo,
      hitLevels,
      gameStances,
      characterStances,
      gameProperties,
      gameCredits,
      gameCommunity,
    }),
    [
      selectedGame,
      availableColumns,
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
      getStanceInfo,
      getPropertyInfo,
      hitLevels,
      gameStances,
      characterStances,
      gameProperties,
      gameCredits,
      gameCommunity,
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
