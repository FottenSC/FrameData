import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { LEGACY_STYLE_ID_MAP } from "@/lib/notation";

interface UserSettingsContextType {
  /**
   * One notation style id per game. Replaces the legacy
   * `gameNotationMappings` multi-select — now radio semantics.
   */
  notationStyleByGame: Record<string, string>;
  /**
   * Resolve the active style id for a game. Returns the user's saved choice
   * if any, else the provided `fallback` (typically `game.defaultNotationStyleId`),
   * else `"universal"`.
   */
  getNotationStyleId: (gameId: string, fallback?: string) => string;
  /** Set (or replace) the active style id for a game. */
  setNotationStyle: (gameId: string, styleId: string) => void;
}

const UserSettingsContext = createContext<UserSettingsContextType | undefined>(
  undefined,
);

interface UserSettingsProviderProps {
  children: ReactNode;
}

export const UserSettingsProvider: React.FC<UserSettingsProviderProps> = ({
  children,
}) => {
  // --- Notation style (one per game) ---------------------------------------
  //
  // Stored as `{ [gameId]: styleId }`. Initial read also migrates the legacy
  // `gameNotationMappings` array format: if present, take the first element
  // of each array, translate through LEGACY_STYLE_ID_MAP, and drop the old key.
  const [notationStyleByGame, setNotationStyleByGame] = useState<
    Record<string, string>
  >(() => {
    try {
      const saved = localStorage.getItem("notationStyleByGame");
      if (saved) return JSON.parse(saved);

      const legacy = localStorage.getItem("gameNotationMappings");
      if (legacy) {
        const parsed = JSON.parse(legacy) as Record<string, string[]>;
        const migrated: Record<string, string> = {};
        for (const [gameId, enabled] of Object.entries(parsed ?? {})) {
          const first = Array.isArray(enabled) ? enabled[0] : undefined;
          if (first) migrated[gameId] = LEGACY_STYLE_ID_MAP[first] ?? first;
        }
        localStorage.removeItem("gameNotationMappings");
        return migrated;
      }
    } catch {
      // fall through
    }
    return {};
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        "notationStyleByGame",
        JSON.stringify(notationStyleByGame),
      );
    } catch {
      // ignore quota / privacy-mode errors
    }
  }, [notationStyleByGame]);

  const getNotationStyleId = useCallback(
    (gameId: string, fallback?: string) =>
      notationStyleByGame[gameId] ?? fallback ?? "universal",
    [notationStyleByGame],
  );

  const setNotationStyle = useCallback((gameId: string, styleId: string) => {
    setNotationStyleByGame((prev) =>
      prev[gameId] === styleId ? prev : { ...prev, [gameId]: styleId },
    );
  }, []);

  const value: UserSettingsContextType = useMemo(
    () => ({
      notationStyleByGame,
      getNotationStyleId,
      setNotationStyle,
    }),
    [notationStyleByGame, getNotationStyleId, setNotationStyle],
  );

  return (
    <UserSettingsContext.Provider value={value}>
      {children}
    </UserSettingsContext.Provider>
  );
};

export const useUserSettings = (): UserSettingsContextType => {
  const context = useContext(UserSettingsContext);
  if (context === undefined) {
    throw new Error(
      "useUserSettings must be used within a UserSettingsProvider",
    );
  }
  return context;
};
