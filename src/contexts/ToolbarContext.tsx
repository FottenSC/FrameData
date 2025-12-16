import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  ReactNode,
} from "react";

interface ToolbarContextType {
  activeFiltersCount: number;
  setActiveFiltersCount: (count: number) => void;
  exportHandler: React.MutableRefObject<
    ((format: "csv" | "excel") => void) | null
  >;
  totalMoves: number;
  setTotalMoves: (count: number) => void;
  filteredMoves: number;
  setFilteredMoves: (count: number) => void;
  isUpdating: boolean;
  setIsUpdating: (updating: boolean) => void;
}

const ToolbarContext = createContext<ToolbarContextType | undefined>(undefined);

interface ToolbarProviderProps {
  children: ReactNode;
}

export function ToolbarProvider({ children }: ToolbarProviderProps) {
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);
  const exportHandler = useRef<((format: "csv" | "excel") => void) | null>(
    null,
  );
  const [totalMoves, setTotalMoves] = useState(0);
  const [filteredMoves, setFilteredMoves] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);

  return (
    <ToolbarContext.Provider
      value={{
        activeFiltersCount,
        setActiveFiltersCount,
        exportHandler,
        totalMoves,
        setTotalMoves,
        filteredMoves,
        setFilteredMoves,
        isUpdating,
        setIsUpdating,
      }}
    >
      {children}
    </ToolbarContext.Provider>
  );
}

export function useToolbar() {
  const context = useContext(ToolbarContext);
  if (context === undefined) {
    throw new Error("useToolbar must be used within a ToolbarProvider");
  }
  return context;
}
