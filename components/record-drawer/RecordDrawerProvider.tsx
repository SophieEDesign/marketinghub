"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface RecordDrawerContextType {
  open: boolean;
  table: string | null;
  recordId: string | null;
  openRecord: (table: string, recordId: string) => void;
  closeRecord: () => void;
}

const RecordDrawerContext = createContext<RecordDrawerContextType | undefined>(undefined);

export function RecordDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [table, setTable] = useState<string | null>(null);
  const [recordId, setRecordId] = useState<string | null>(null);

  const openRecord = useCallback((tableName: string, id: string) => {
    setTable(tableName);
    setRecordId(id);
    setOpen(true);
  }, []);

  const closeRecord = useCallback(() => {
    setOpen(false);
    // Don't clear table/recordId immediately to allow smooth close animation
    setTimeout(() => {
      setTable(null);
      setRecordId(null);
    }, 200);
  }, []);

  return (
    <RecordDrawerContext.Provider
      value={{
        open,
        table,
        recordId,
        openRecord,
        closeRecord,
      }}
    >
      {children}
    </RecordDrawerContext.Provider>
  );
}

export function useRecordDrawer() {
  const context = useContext(RecordDrawerContext);
  if (context === undefined) {
    throw new Error("useRecordDrawer must be used within a RecordDrawerProvider");
  }
  return context;
}

