"use client";

import { createContext, useContext, useState } from "react";

interface DrawerContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  recordId: string | null;
  setRecordId: (id: string | null) => void;
  tableId: string | null;
  setTableId: (id: string | null) => void;
}

const DrawerContext = createContext<DrawerContextType | null>(null);

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);

  return (
    <DrawerContext.Provider value={{ open, setOpen, recordId, setRecordId, tableId, setTableId }}>
      {children}
    </DrawerContext.Provider>
  );
}

export function useDrawer() {
  const context = useContext(DrawerContext);
  if (!context) {
    throw new Error("useDrawer must be used within DrawerProvider");
  }
  return context;
}

