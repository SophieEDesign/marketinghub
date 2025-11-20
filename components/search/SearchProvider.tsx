"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface SearchContextType {
  showSearch: boolean;
  setShowSearch: (show: boolean) => void;
  openSearch: () => void;
  closeSearch: () => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error("useSearch must be used within SearchProvider");
  }
  return context;
}

interface SearchProviderProps {
  children: ReactNode;
}

export function SearchProvider({ children }: SearchProviderProps) {
  const [showSearch, setShowSearch] = useState(false);

  const openSearch = () => setShowSearch(true);
  const closeSearch = () => setShowSearch(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        openSearch();
        return;
      }

      // Forward slash (/) - only if not typing in input/textarea
      if (e.key === "/" && !isTypingInInput(e.target)) {
        e.preventDefault();
        openSearch();
        return;
      }

      // ESC to close
      if (e.key === "Escape" && showSearch) {
        e.preventDefault();
        closeSearch();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSearch]);

  return (
    <SearchContext.Provider value={{ showSearch, setShowSearch, openSearch, closeSearch }}>
      {children}
    </SearchContext.Provider>
  );
}

function isTypingInInput(target: EventTarget | null): boolean {
  if (!target) return false;
  const element = target as HTMLElement;
  return (
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.isContentEditable
  );
}

