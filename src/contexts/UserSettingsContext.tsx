import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

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
    width: 170,
    minWidth: 170,
    maxWidth: 170,
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
    id: "notes",
    label: "Notes",
    visible: true,
    order: 10,
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
  // Game notation mappings
  gameNotationMappings: Record<string, string[]>;
  getEnabledNotationMappings: (gameId: string, defaults?: string[]) => string[];
  toggleGameNotationMapping: (
    gameId: string,
    key: string,
    currentEnabled: string[],
  ) => void;
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
  // Game notation mappings state
  const [gameNotationMappings, setGameNotationMappings] = useState<
    Record<string, string[]>
  >(() => {
    const saved = localStorage.getItem("gameNotationMappings");
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem(
      "gameNotationMappings",
      JSON.stringify(gameNotationMappings),
    );
  }, [gameNotationMappings]);

  const getEnabledNotationMappings = (
    gameId: string,
    defaults: string[] = [],
  ) => {
    return gameNotationMappings[gameId] ?? defaults;
  };

  const toggleGameNotationMapping = (
    gameId: string,
    key: string,
    currentEnabled: string[],
  ) => {
    setGameNotationMappings((prev) => {
      const isEnabled = currentEnabled.includes(key);
      const newEnabled = isEnabled
        ? currentEnabled.filter((k) => k !== key)
        : [...currentEnabled, key];

      return { ...prev, [gameId]: newEnabled };
    });
  };

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

  const updateColumnVisibility = (columnId: string, visible: boolean) => {
    setColumnConfigs((prev) =>
      prev.map((col) => (col.id === columnId ? { ...col, visible } : col)),
    );
  };

  const reorderColumns = (fromIndex: number, toIndex: number) => {
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
  };

  const restoreDefaults = () => {
    setColumnConfigs(defaultColumns);
  };

  const getVisibleColumns = () =>
    columnConfigs
      .filter((col) => col.visible)
      .sort((a, b) => a.order - b.order);

  const getSortedColumns = () => [...columnConfigs].sort((a, b) => a.order - b.order);

  const value: UserSettingsContextType = {
    gameNotationMappings,
    getEnabledNotationMappings,
    toggleGameNotationMapping,
    columnConfigs,
    setColumnConfigs,
    updateColumnVisibility,
    reorderColumns,
    restoreDefaults,
    getVisibleColumns,
    getSortedColumns,
  };

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
