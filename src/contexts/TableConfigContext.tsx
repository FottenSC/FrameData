import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useGame } from "./GameContext";
import {
  getDefaultColumns,
  isColumnId,
  type ColumnDefinition,
  type ColumnId,
} from "@/lib/columns";

export type ColumnConfig = ColumnDefinition;

interface StoredColumnConfig {
  id: ColumnId;
  visible: boolean;
  order: number;
}

interface StoredTableConfig {
  version: 2;
  games: Record<string, StoredColumnConfig[]>;
  migrationSeed?: StoredColumnConfig[];
}

interface TableConfigContextType {
  columnConfigs: ColumnConfig[];
  setColumnConfigs: React.Dispatch<React.SetStateAction<ColumnConfig[]>>;
  updateColumnVisibility: (columnId: ColumnId, visible: boolean) => void;
  restoreDefaults: () => void;
  getVisibleColumns: () => ColumnConfig[];
}

const STORAGE_KEY = "tableColumnConfigByGame";
const LEGACY_STORAGE_KEY = "tableColumnConfig";

const parseStoredColumns = (value: unknown): StoredColumnConfig[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<ColumnId>();
  const parsed: StoredColumnConfig[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Partial<StoredColumnConfig>;
    if (
      !isColumnId(candidate.id) ||
      seen.has(candidate.id) ||
      typeof candidate.visible !== "boolean" ||
      typeof candidate.order !== "number"
    ) {
      continue;
    }
    seen.add(candidate.id);
    parsed.push({
      id: candidate.id,
      visible: candidate.visible,
      order: candidate.order,
    });
  }
  return parsed;
};

const loadStoredConfig = (): StoredTableConfig => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const raw = JSON.parse(saved) as Partial<StoredTableConfig>;
      if (raw.version === 2 && raw.games && typeof raw.games === "object") {
        return {
          version: 2,
          games: Object.fromEntries(
            Object.entries(raw.games).map(([gameId, columns]) => [
              gameId,
              parseStoredColumns(columns),
            ]),
          ),
          migrationSeed: raw.migrationSeed
            ? parseStoredColumns(raw.migrationSeed)
            : undefined,
        };
      }
    }

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    const migrationSeed = legacy
      ? parseStoredColumns(JSON.parse(legacy))
      : undefined;
    return {
      version: 2,
      games: {},
      migrationSeed:
        migrationSeed && migrationSeed.length > 0 ? migrationSeed : undefined,
    };
  } catch {
    return { version: 2, games: {} };
  }
};

const reconcileColumns = (
  stored: readonly StoredColumnConfig[] | undefined,
  availableColumns: readonly ColumnId[],
): ColumnConfig[] => {
  const defaults = getDefaultColumns(availableColumns);
  if (!stored || stored.length === 0) return defaults;

  const defaultsById = new Map(defaults.map((column) => [column.id, column]));
  const configured = stored
    .filter((column) => defaultsById.has(column.id))
    .toSorted((left, right) => left.order - right.order)
    .map((column) => ({
      ...defaultsById.get(column.id)!,
      visible: column.visible,
    }));
  const configuredIds = new Set(configured.map((column) => column.id));
  const appended = defaults.filter((column) => !configuredIds.has(column.id));

  return [...configured, ...appended].map((column, order) => ({
    ...column,
    order,
  }));
};

const toStoredColumns = (
  columns: readonly ColumnConfig[],
): StoredColumnConfig[] =>
  columns.map(({ id, visible }, order) => ({ id, visible, order }));

const storedColumnsEqual = (
  left: readonly StoredColumnConfig[] | undefined,
  right: readonly StoredColumnConfig[],
): boolean =>
  !!left &&
  left.length === right.length &&
  left.every(
    (column, index) =>
      column.id === right[index].id &&
      column.visible === right[index].visible &&
      column.order === right[index].order,
  );

const TableConfigContext = createContext<TableConfigContextType | undefined>(
  undefined,
);

export const TableConfigProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { selectedGame, availableColumns } = useGame();
  const gameId = selectedGame.id;
  const [storedConfig, setStoredConfig] =
    useState<StoredTableConfig>(loadStoredConfig);

  const columnConfigs = useMemo(
    () =>
      reconcileColumns(
        storedConfig.games[gameId] ?? storedConfig.migrationSeed,
        availableColumns,
      ),
    [storedConfig, gameId, availableColumns],
  );

  useEffect(() => {
    if (availableColumns.length === 0) return;
    const reconciled = toStoredColumns(columnConfigs);
    setStoredConfig((previous) => {
      if (storedColumnsEqual(previous.games[gameId], reconciled)) {
        return previous;
      }
      return {
        ...previous,
        games: { ...previous.games, [gameId]: reconciled },
      };
    });
  }, [availableColumns.length, columnConfigs, gameId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedConfig));
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (error) {
      console.warn("Failed to save table config to localStorage:", error);
    }
  }, [storedConfig]);

  const setColumnConfigs = useCallback<
    React.Dispatch<React.SetStateAction<ColumnConfig[]>>
  >(
    (update) => {
      setStoredConfig((previous) => {
        if (availableColumns.length === 0) return previous;
        const current = reconcileColumns(
          previous.games[gameId] ?? previous.migrationSeed,
          availableColumns,
        );
        const next = typeof update === "function" ? update(current) : update;
        const available = new Set(availableColumns);
        const supported = next.filter((column) => available.has(column.id));
        return {
          ...previous,
          games: {
            ...previous.games,
            [gameId]: toStoredColumns(supported),
          },
        };
      });
    },
    [availableColumns, gameId],
  );

  const updateColumnVisibility = useCallback(
    (columnId: ColumnId, visible: boolean) => {
      setColumnConfigs((previous) =>
        previous.map((column) =>
          column.id === columnId ? { ...column, visible } : column,
        ),
      );
    },
    [setColumnConfigs],
  );

  const restoreDefaults = useCallback(() => {
    setColumnConfigs(getDefaultColumns(availableColumns));
  }, [availableColumns, setColumnConfigs]);

  const getVisibleColumns = useCallback(
    () =>
      columnConfigs
        .filter((column) => column.visible)
        .toSorted((left, right) => left.order - right.order),
    [columnConfigs],
  );

  const value = useMemo<TableConfigContextType>(
    () => ({
      columnConfigs,
      setColumnConfigs,
      updateColumnVisibility,
      restoreDefaults,
      getVisibleColumns,
    }),
    [
      columnConfigs,
      setColumnConfigs,
      updateColumnVisibility,
      restoreDefaults,
      getVisibleColumns,
    ],
  );

  return (
    <TableConfigContext.Provider value={value}>
      {children}
    </TableConfigContext.Provider>
  );
};

export const useTableConfig = (): TableConfigContextType => {
  const context = useContext(TableConfigContext);
  if (!context) {
    throw new Error("useTableConfig must be used within a TableConfigProvider");
  }
  return context;
};
