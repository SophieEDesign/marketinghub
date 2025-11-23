"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Filter } from "@/lib/types/filters";

interface PageContextValue {
  // Shared filter state - filters from FilterBlock components
  sharedFilters: Record<string, Filter[]>; // keyed by table name
  setSharedFilters: (table: string, filters: Filter[]) => void;
  getSharedFilters: (table: string) => Filter[];
  
  // Block-specific config overrides
  blockConfigs: Record<string, any>; // keyed by block id
  setBlockConfig: (blockId: string, config: any) => void;
  getBlockConfig: (blockId: string) => any;
}

const PageContext = createContext<PageContextValue | undefined>(undefined);

interface PageContextProviderProps {
  children: ReactNode;
}

export function PageContextProvider({ children }: PageContextProviderProps) {
  const [sharedFilters, setSharedFiltersState] = useState<Record<string, Filter[]>>({});
  const [blockConfigs, setBlockConfigsState] = useState<Record<string, any>>({});

  const setSharedFilters = useCallback((table: string, filters: Filter[]) => {
    setSharedFiltersState((prev) => ({
      ...prev,
      [table]: filters,
    }));
  }, []);

  const getSharedFilters = useCallback(
    (table: string) => {
      return sharedFilters[table] || [];
    },
    [sharedFilters]
  );

  const setBlockConfig = useCallback((blockId: string, config: any) => {
    setBlockConfigsState((prev) => ({
      ...prev,
      [blockId]: config,
    }));
  }, []);

  const getBlockConfig = useCallback(
    (blockId: string) => {
      return blockConfigs[blockId] || null;
    },
    [blockConfigs]
  );

  return (
    <PageContext.Provider
      value={{
        sharedFilters,
        setSharedFilters,
        getSharedFilters,
        blockConfigs,
        setBlockConfig,
        getBlockConfig,
      }}
    >
      {children}
    </PageContext.Provider>
  );
}

export function usePageContext() {
  const context = useContext(PageContext);
  if (context === undefined) {
    throw new Error("usePageContext must be used within a PageContextProvider");
  }
  return context;
}

