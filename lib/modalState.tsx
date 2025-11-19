"use client";

import { createContext, useContext, useState } from "react";

interface ModalContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  tableId: string | null;
  setTableId: (id: string | null) => void;
}

const ModalContext = createContext<ModalContextType | null>(null);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [tableId, setTableId] = useState<string | null>(null);

  return (
    <ModalContext.Provider value={{ open, setOpen, tableId, setTableId }}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within ModalProvider");
  }
  return context;
}

