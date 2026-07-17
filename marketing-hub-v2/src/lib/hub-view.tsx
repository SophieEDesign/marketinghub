"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { HubViewMode } from "@/lib/nav";

export type { HubViewMode };

const STORAGE_KEY = "mh_hub_view";

type HubViewContextValue = {
  view: HubViewMode;
  setView: (view: HubViewMode) => void;
  ready: boolean;
};

const HubViewContext = createContext<HubViewContextValue | null>(null);

export function HubViewProvider({ children }: { children: React.ReactNode }) {
  const [view, setViewState] = useState<HubViewMode>("member");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "admin" || saved === "member") {
        setViewState(saved);
      }
    } catch {
      // ignore
    }
    setReady(true);
  }, []);

  const setView = useCallback((next: HubViewMode) => {
    setViewState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(
    () => ({ view, setView, ready }),
    [view, setView, ready]
  );

  return (
    <HubViewContext.Provider value={value}>{children}</HubViewContext.Provider>
  );
}

export function useHubView() {
  const ctx = useContext(HubViewContext);
  if (!ctx) {
    throw new Error("useHubView must be used within HubViewProvider");
  }
  return ctx;
}
