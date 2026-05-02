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

// Define the column configuration interface
export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  order: number;
  friendlyLabel?: string;
  /**
   * Non-size related classes (padding, alignment, overflow behavior, etc.)
   * Size (width) is controlled via width/minWidth/maxWidth below to ensure a single source of truth.
   */
  className: string;
  /** Fixed width in px (optional). */
  width?: number;
  /** Minimum width in px (optional). */
  minWidth?: number;
  /** Maximum width in px (optional). */
  maxWidth?: number;
}

// Default column configuration
export const defaultColumns: ColumnConfig[] = [
  {
    id: "character",
    label: "Character",
    visible: true,
    order: -1,
    className: "pt-2 px-2",
    width: 100,
    minWidth: 100,
    maxWidth: 100,
  },
  {
    id: "stance",
    label: "Stance",
    visible: true,
    order: 0,
    className: "pt-2 px-2 text-right",
    width: 150,
    minWidth: 150,
    maxWidth: 150,
  },
  {
    id: "command",
    label: "Command",
    visible: true,
    order: 1,
    className: "pt-2 px-2",
    width: 200,
    minWidth: 200,
    maxWidth: 200,
  },
  {
    id: "rawCommand",
    label: "Raw Command",
    visible: false,
    order: 2,
    className: "pt-2 px-2",
    width: 210,
    minWidth: 210,
    maxWidth: 210,
  },
  {
    id: "hitLevel",
    label: "Hit Level",
    visible: true,
    order: 3,
    className: "pt-2 px-2",
    width: 135,
    minWidth: 135,
    maxWidth: 150,
  },
  {
    id: "impact",
    label: "Impact",
    visible: true,
    order: 4,
    className: "pt-2 px-2",
    width: 70,
    minWidth: 70,
    maxWidth: 70,
  },
  {
    id: "damage",
    label: "Damage",
    visible: true,
    order: 5,
    className: "pt-2 px-2",
    width: 80,
    minWidth: 80,
    maxWidth: 80,
  },
  // Outcome columns show only the numeric advantage pill now; any descriptive
  // tags (KND / LNC / STN / …) live in the Properties column, so these can
  // stay the compact 60px they were before the outcome-tag refactor.
  {
    id: "block",
    label: "Block",
    visible: true,
    order: 6,
    className: "pt-2 px-2",
    width: 60,
    minWidth: 60,
    maxWidth: 60,
  },
  {
    id: "hit",
    label: "Hit",
    visible: true,
    order: 7,
    className: "pt-2 px-2",
    width: 60,
    minWidth: 60,
    maxWidth: 60,
  },
  {
    id: "counterHit",
    label: "CH",
    friendlyLabel: "Counter Hit",
    visible: true,
    order: 8,
    className: "pt-2 px-2",
    width: 60,
    minWidth: 60,
    maxWidth: 60,
  },
  {
    id: "guardBurst",
    label: "GB",
    friendlyLabel: "Guard Burst",
    visible: true,
    order: 9,
    className: "pt-2 px-2",
    width: 60,
    minWidth: 60,
    maxWidth: 60,
  },
  {
    id: "properties",
    label: "Properties",
    visible: true,
    order: 10,
    className: "pt-2 px-2",
    width: 150,
    minWidth: 150,
    maxWidth: 150,
  },
  {
    id: "notes",
    label: "Notes",
    visible: true,
    order: 11,
    className: "pt-2 px-2 overflow-visible",
  },
];

// Define the minimal storage interface for localStorage
interface StoredColumnConfig {
  id: string;
  visible: boolean;
  order: number;
}

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

  // Table config
  columnConfigs: ColumnConfig[];
  setColumnConfigs: React.Dispatch<React.SetStateAction<ColumnConfig[]>>;
  updateColumnVisibility: (columnId: string, visible: boolean) => void;
  reorderColumns: (fromIndex: number, toIndex: number) => void;
  restoreDefaults: () => void;
  getVisibleColumns: () => ColumnConfig[];
  getSortedColumns: () => ColumnConfig[];
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

  // Table config state
  const [columnConfigs, setColumnConfigs] = useState<ColumnConfig[]>(() => {
    try {
      const saved = localStorage.getItem("tableColumnConfig");
      if (saved) {
        const storedConfigs: StoredColumnConfig[] = JSON.parse(saved);
        const storedMap = new Map(
          storedConfigs.map((config) => [config.id, config]),
        );
        return defaultColumns
          .map((defaultCol) => {
            const stored = storedMap.get(defaultCol.id);
            if (stored) {
              return {
                ...defaultCol,
                visible: stored.visible,
                order: stored.order,
              };
            }
            return defaultCol;
          })
          .sort((a, b) => a.order - b.order);
      }
      return defaultColumns;
    } catch {
      return defaultColumns;
    }
  });

  useEffect(() => {
    try {
      const configsToStore: StoredColumnConfig[] = columnConfigs.map((col) => ({
        id: col.id,
        visible: col.visible,
        order: col.order,
      }));
      localStorage.setItem("tableColumnConfig", JSON.stringify(configsToStore));
    } catch (error) {
      console.warn("Failed to save table config to localStorage:", error);
    }
  }, [columnConfigs]);

  const updateColumnVisibility = useCallback(
    (columnId: string, visible: boolean) => {
      setColumnConfigs((prev) =>
        prev.map((col) => (col.id === columnId ? { ...col, visible } : col)),
      );
    },
    [],
  );

  const reorderColumns = useCallback((fromIndex: number, toIndex: number) => {
    setColumnConfigs((prev) => {
      const newConfigs = [...prev];
      const [movedColumn] = newConfigs.splice(fromIndex, 1);
      newConfigs.splice(toIndex, 0, movedColumn);

      const minIndex = Math.min(fromIndex, toIndex);
      const maxIndex = Math.max(fromIndex, toIndex);

      return newConfigs.map((col, index) => {
        if (index >= minIndex && index <= maxIndex) {
          return { ...col, order: index };
        }
        return col.order === index ? col : { ...col, order: index };
      });
    });
  }, []);

  const restoreDefaults = useCallback(() => {
    setColumnConfigs(defaultColumns);
  }, []);

  const getVisibleColumns = useCallback(
    () =>
      columnConfigs
        .filter((col) => col.visible)
        .toSorted((a, b) => a.order - b.order),
    [columnConfigs],
  );

  const getSortedColumns = useCallback(
    () => columnConfigs.toSorted((a, b) => a.order - b.order),
    [columnConfigs],
  );

  const value: UserSettingsContextType = useMemo(
    () => ({
      notationStyleByGame,
      getNotationStyleId,
      setNotationStyle,
      columnConfigs,
      setColumnConfigs,
      updateColumnVisibility,
      reorderColumns,
      restoreDefaults,
      getVisibleColumns,
      getSortedColumns,
    }),
    [
      notationStyleByGame,
      getNotationStyleId,
      setNotationStyle,
      columnConfigs,
      updateColumnVisibility,
      reorderColumns,
      restoreDefaults,
      getVisibleColumns,
      getSortedColumns,
    ],
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

// Backwards compatibility alias
export const useTableConfig = useUserSettings;
