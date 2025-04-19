import React, { createContext, useContext, useState, ReactNode } from 'react';

interface CommandContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const CommandContext = createContext<CommandContextType | undefined>(undefined);

interface CommandProviderProps {
  children: ReactNode;
}

export function CommandProvider({ children }: CommandProviderProps) {
  const [open, setOpen] = useState(false);

  return (
    <CommandContext.Provider value={{ open, setOpen }}>
      {children}
    </CommandContext.Provider>
  );
}

export function useCommand() {
  const context = useContext(CommandContext);
  if (context === undefined) {
    throw new Error('useCommand must be used within a CommandProvider');
  }
  return context;
} 