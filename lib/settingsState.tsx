"use client";

import { createContext, useContext, useState } from "react";

interface SettingsContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <SettingsContext.Provider value={{ open, setOpen }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettingsState() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettingsState must be used within SettingsProvider");
  }
  return context;
}

