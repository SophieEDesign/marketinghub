"use client";

import { useEffect } from "react";
import { useTheme } from "@/app/providers";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeContext = useTheme();
  
  useEffect(() => {
    if (typeof window === 'undefined' || !themeContext) return;
    const root = document.documentElement;
    if (themeContext.theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [themeContext?.theme]);
  
  return <>{children}</>;
}

