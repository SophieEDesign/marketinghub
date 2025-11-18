"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useSettings } from "@/lib/useSettings";

export const ThemeContext = createContext<{
  theme: "light" | "dark" | "brand";
  setTheme: (theme: "light" | "dark" | "brand") => void;
} | null>(null);

export const DensityContext = createContext<{
  density: "comfortable" | "compact";
  setDensity: (density: "comfortable" | "compact") => void;
} | null>(null);

export function useTheme() {
  return useContext(ThemeContext);
}

export function useDensity() {
  return useContext(DensityContext);
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark" | "brand">("light");
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const { settings } = useSettings();

  // Apply brand theme colors as CSS variables
  useEffect(() => {
    if (theme === "brand" && settings.branding_colors) {
      const root = document.documentElement;
      root.style.setProperty("--brand-primary", settings.branding_colors.primary || "#2563eb");
      root.style.setProperty("--brand-secondary", settings.branding_colors.secondary || "#64748b");
      root.style.setProperty("--brand-accent", settings.branding_colors.accent || "#f59e0b");
    } else {
      // Clear brand variables when not using brand theme
      const root = document.documentElement;
      root.style.removeProperty("--brand-primary");
      root.style.removeProperty("--brand-secondary");
      root.style.removeProperty("--brand-accent");
    }
  }, [theme, settings.branding_colors]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <DensityContext.Provider value={{ density, setDensity }}>
        <div data-theme={theme} className={density}>
          {children}
        </div>
      </DensityContext.Provider>
    </ThemeContext.Provider>
  );
}

