import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo } from "react";

export type CommandView =
  | "main"
  | "tableConfig"
  | "notationMappings"
  | "characters"
  | "games"
  | "credits";

interface CommandContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  currentView: CommandView;
  setCurrentView: (view: CommandView) => void;
  openView: (view: CommandView) => void;
}

const CommandContext = createContext<CommandContextType | undefined>(undefined);

interface CommandProviderProps {
  children: ReactNode;
}

export function CommandProvider({ children }: CommandProviderProps) {
  const [open, setOpen] = useState(false);
  const [currentView, setCurrentView] = useState<CommandView>("main");

  const openView = useCallback((view: CommandView) => {
    setCurrentView(view);
    setOpen(true);
  }, []);

  const handleSetOpen = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      setCurrentView("main");
    }
    setOpen(newOpen);
  }, []);

  const value = useMemo(() => ({
    open,
    setOpen: handleSetOpen,
    currentView,
    setCurrentView,
    openView,
  }), [open, handleSetOpen, currentView, openView]);

  return (
    <CommandContext.Provider value={value}>
      {children}
    </CommandContext.Provider>
  );
}

export function useCommand() {
  const context = useContext(CommandContext);
  if (context === undefined) {
    throw new Error("useCommand must be used within a CommandProvider");
  }
  return context;
}
