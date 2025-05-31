import React, { createContext, useContext, useState, useEffect } from 'react';

// Define the column configuration interface
export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  order: number;
  friendlyLabel?: string;
  colClasses: string;
}

// Default column configuration
export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { 
    id: 'stance', 
    label: 'Stance', 
    visible: true, 
    order: 0,
    colClasses: 'pt-2 px-2 cursor-pointer min-w-[100px] max-w-[100px] text-right'
  },
  { 
    id: 'command', 
    label: 'Command', 
    visible: true, 
    order: 1,
    colClasses: 'pt-2 px-2 cursor-pointer min-w-[210px] max-w-[300px]'
  },
  { 
    id: 'rawCommand', 
    label: 'Raw Command', 
    visible: false, 
    order: 2,
    colClasses: 'pt-2 px-2 cursor-pointer w-[200px] min-w-[210px] max-w-[300px]'
  },
  { 
    id: 'hitLevel', 
    label: 'Hit Level', 
    visible: true, 
    order: 3,
    colClasses: 'pt-2 px-2 cursor-pointer w-[135px] min-w-[135px] max-w-[150px]'
  },
  { 
    id: 'impact', 
    label: 'Impact', 
    visible: true, 
    order: 4,
    colClasses: 'pt-2 px-2 cursor-pointer w-[50px]'
  },
  { 
    id: 'damage', 
    label: 'Damage', 
    visible: true, 
    order: 5,
    colClasses: 'pt-2 px-2 cursor-pointer w-[50px]',
  },
  { 
    id: 'block', 
    label: 'Block', 
    visible: true, 
    order: 6,
    colClasses: 'pt-2 px-2 cursor-pointer w-[70px]',
  },
  { 
    id: 'hit', 
    label: 'Hit', 
    visible: true, 
    order: 7,
    colClasses: 'pt-2 px-2 cursor-pointer w-[60px]'
  },
  { 
    id: 'counterHit', 
    label: 'CH', 
    friendlyLabel: 'Counter Hit', 
    visible: true, 
    order: 8,
    colClasses: 'pt-2 px-2 cursor-pointer w-[50px]'
  },
  { 
    id: 'guardBurst', 
    label: 'GB', 
    friendlyLabel: 'Guard Burst', 
    visible: true, 
    order: 9,
    colClasses: 'pt-2 px-2 cursor-pointer w-[50px]'
  },
  { 
    id: 'notes', 
    label: 'Notes', 
    visible: true, 
    order: 10,
    colClasses: 'pt-2 px-2 cursor-pointer overflow-visible'
  }
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

const TableConfigContext = createContext<TableConfigContextType | undefined>(undefined);

export const TableConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [columnConfigs, setColumnConfigs] = useState<ColumnConfig[]>(() => {
    // Try to load from localStorage and merge with defaults
    try {
      const saved = localStorage.getItem('tableColumnConfig');
      if (saved) {
        const storedConfigs: StoredColumnConfig[] = JSON.parse(saved);
        const storedMap = new Map(storedConfigs.map(config => [config.id, config]));
        return DEFAULT_COLUMNS.map(defaultCol => {
          const stored = storedMap.get(defaultCol.id);
          if (stored) {
            return {
              ...defaultCol,
              visible: stored.visible,
              order: stored.order
            };
          }
          return defaultCol;
        }).sort((a, b) => a.order - b.order);
      }
      return DEFAULT_COLUMNS;
    } catch {
      return DEFAULT_COLUMNS;
    }
  });

  // Save to localStorage whenever config changes (only essential properties)
  useEffect(() => {
    try {
      const configsToStore: StoredColumnConfig[] = columnConfigs.map(col => ({
        id: col.id,
        visible: col.visible,
        order: col.order
      }));
      localStorage.setItem('tableColumnConfig', JSON.stringify(configsToStore));
    } catch (error) {
      console.warn('Failed to save table config to localStorage:', error);
    }
  }, [columnConfigs]);

  const updateColumnVisibility = (columnId: string, visible: boolean) => {
    setColumnConfigs(prev => 
      prev.map(col => 
        col.id === columnId ? { ...col, visible } : col
      )
    );
  };

  const reorderColumns = (fromIndex: number, toIndex: number) => {
    setColumnConfigs(prev => {
      const newConfigs = [...prev];
      const [movedColumn] = newConfigs.splice(fromIndex, 1);
      newConfigs.splice(toIndex, 0, movedColumn);
      
      // Update order values
      return newConfigs.map((col, index) => ({ ...col, order: index }));
    });
  };

  const restoreDefaults = () => {
    setColumnConfigs(DEFAULT_COLUMNS);
  };

  const getVisibleColumns = () => {
    return columnConfigs.filter(col => col.visible).sort((a, b) => a.order - b.order);
  };

  const getSortedColumns = () => {
    return [...columnConfigs].sort((a, b) => a.order - b.order);
  };

  const value: TableConfigContextType = {
    columnConfigs,
    setColumnConfigs,
    updateColumnVisibility,
    reorderColumns,
    restoreDefaults,
    getVisibleColumns,
    getSortedColumns
  };

  return (
    <TableConfigContext.Provider value={value}>
      {children}
    </TableConfigContext.Provider>
  );
};

export const useTableConfig = (): TableConfigContextType => {
  const context = useContext(TableConfigContext);
  if (context === undefined) {
    throw new Error('useTableConfig must be used within a TableConfigProvider');
  }
  return context;
}; 