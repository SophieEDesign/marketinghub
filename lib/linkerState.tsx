"use client";

import { createContext, useContext, useState } from "react";

interface LinkerContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  mode: "campaigns" | "contacts" | null;
  setMode: (mode: "campaigns" | "contacts" | null) => void;
  multiSelect: boolean;
  setMultiSelect: (multi: boolean) => void;
  onSelect: ((ids: string[]) => void) | null;
  setOnSelect: (callback: ((ids: string[]) => void) | null) => void;
}

const LinkerContext = createContext<LinkerContextType | null>(null);

export function LinkerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"campaigns" | "contacts" | null>(null);
  const [multiSelect, setMultiSelect] = useState(false);
  const [onSelect, setOnSelect] = useState<((ids: string[]) => void) | null>(
    null
  );

  return (
    <LinkerContext.Provider
      value={{
        open,
        setOpen,
        mode,
        setMode,
        multiSelect,
        setMultiSelect,
        onSelect,
        setOnSelect,
      }}
    >
      {children}
    </LinkerContext.Provider>
  );
}

export function useLinker() {
  const context = useContext(LinkerContext);
  if (!context) {
    throw new Error("useLinker must be used within LinkerProvider");
  }
  return context;
}

