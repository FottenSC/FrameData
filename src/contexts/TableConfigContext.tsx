import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useMemo,
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
        width: 300,
        minWidth: 300,
        maxWidth: 300,
    },
    {
        id: "rawCommand",
        label: "Raw Command",
        visible: false,
        order: 2,
        className: "pt-2 px-2",
        width: 210, // use min width as fixed to avoid layout shift when shown
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
        maxWidth: 80
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
        // Notes column is flexible; no explicit width constraints
    },
];

// Define the minimal storage interface for localStorage
interface StoredColumnConfig {
    id: string;
    visible: boolean;
    order: number;
}

interface TableConfigContextType {
    columnConfigs: ColumnConfig[];
    setColumnConfigs: React.Dispatch<React.SetStateAction<ColumnConfig[]>>;
    updateColumnVisibility: (columnId: string, visible: boolean) => void;
    reorderColumns: (fromIndex: number, toIndex: number) => void;
    restoreDefaults: () => void;
    getVisibleColumns: () => ColumnConfig[];
    getSortedColumns: () => ColumnConfig[];
}

const TableConfigContext = createContext<TableConfigContextType | undefined>(
    undefined
);

export const TableConfigProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [columnConfigs, setColumnConfigs] = useState<ColumnConfig[]>(() => {
        // Try to load from localStorage and merge with defaults
        try {
            const saved = localStorage.getItem("tableColumnConfig");
            if (saved) {
                const storedConfigs: StoredColumnConfig[] = JSON.parse(saved);
                const storedMap = new Map(
                    storedConfigs.map((config) => [config.id, config])
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

    // Save to localStorage whenever config changes (only essential properties)
    useEffect(() => {
        try {
            const configsToStore: StoredColumnConfig[] = columnConfigs.map(
                (col) => ({
                    id: col.id,
                    visible: col.visible,
                    order: col.order,
                })
            );
            localStorage.setItem(
                "tableColumnConfig",
                JSON.stringify(configsToStore)
            );
        } catch (error) {
            console.warn("Failed to save table config to localStorage:", error);
        }
    }, [columnConfigs]);

    // Memoized function to update column visibility - only recreates when necessary
    const updateColumnVisibility = useCallback(
        (columnId: string, visible: boolean) => {
            setColumnConfigs((prev) =>
                prev.map((col) =>
                    col.id === columnId ? { ...col, visible } : col
                )
            );
        },
        []
    );

    // Optimized reorderColumns - only updates objects that actually change
    const reorderColumns = useCallback((fromIndex: number, toIndex: number) => {
        setColumnConfigs((prev) => {
            const newConfigs = [...prev];
            const [movedColumn] = newConfigs.splice(fromIndex, 1);
            newConfigs.splice(toIndex, 0, movedColumn);

            // Only update order values for columns whose order actually changed
            const minIndex = Math.min(fromIndex, toIndex);
            const maxIndex = Math.max(fromIndex, toIndex);

            return newConfigs.map((col, index) => {
                // Only recreate objects for columns whose order changed
                if (index >= minIndex && index <= maxIndex) {
                    return { ...col, order: index };
                }
                // Keep original object reference if order didn't change
                return col.order === index ? col : { ...col, order: index };
            });
        });
    }, []);

    // Memoized function to restore defaults
    const restoreDefaults = useCallback(() => {
        setColumnConfigs(defaultColumns);
    }, []);

    // Memoized getters to prevent unnecessary recalculations
    const getVisibleColumns = useMemo(() => {
        return () =>
            columnConfigs
                .filter((col) => col.visible)
                .sort((a, b) => a.order - b.order);
    }, [columnConfigs]);

    const getSortedColumns = useMemo(() => {
        return () => [...columnConfigs].sort((a, b) => a.order - b.order);
    }, [columnConfigs]);

    // Memoize the context value to prevent unnecessary re-renders
    const value: TableConfigContextType = useMemo(
        () => ({
            columnConfigs,
            setColumnConfigs,
            updateColumnVisibility,
            reorderColumns,
            restoreDefaults,
            getVisibleColumns,
            getSortedColumns,
        }),
        [
            columnConfigs,
            updateColumnVisibility,
            reorderColumns,
            restoreDefaults,
            getVisibleColumns,
            getSortedColumns,
        ]
    );

    return (
        <TableConfigContext.Provider value={value}>
            {children}
        </TableConfigContext.Provider>
    );
};

export const useTableConfig = (): TableConfigContextType => {
    const context = useContext(TableConfigContext);
    if (context === undefined) {
        throw new Error(
            "useTableConfig must be used within a TableConfigProvider"
        );
    }
    return context;
};
