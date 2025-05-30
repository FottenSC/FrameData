import React, { createContext, useContext, useState, useEffect } from 'react';

// Define the column configuration interface
export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  order: number;
}

// Default column configuration
export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'stance', label: 'Stance', visible: true, order: 0 },
  { id: 'command', label: 'Command', visible: true, order: 1 },
  { id: 'rawCommand', label: 'Raw Command', visible: false, order: 2 },
  { id: 'hitLevel', label: 'Hit Level', visible: true, order: 3 },
  { id: 'impact', label: 'Impact', visible: true, order: 4 },
  { id: 'damage', label: 'Damage', visible: true, order: 5 },
  { id: 'block', label: 'Block', visible: true, order: 6 },
  { id: 'hit', label: 'Hit', visible: true, order: 7 },
  { id: 'counterHit', label: 'CH', visible: true, order: 8 },
  { id: 'guardBurst', label: 'GB', visible: true, order: 9 },
  { id: 'notes', label: 'Notes', visible: true, order: 10 }
];

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
    // Try to load from localStorage
    try {
      const saved = localStorage.getItem('tableColumnConfig');
      return saved ? JSON.parse(saved) : DEFAULT_COLUMNS;
    } catch {
      return DEFAULT_COLUMNS;
    }
  });

  // Save to localStorage whenever config changes
  useEffect(() => {
    try {
      localStorage.setItem('tableColumnConfig', JSON.stringify(columnConfigs));
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