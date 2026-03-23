"use client"

import { createContext, useContext, useEffect, useState } from "react"

export type Theme = "light" | "dark" | "system"

const STORAGE_KEY = "marketing-hub-theme"

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system"
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (stored && ["light", "dark", "system"].includes(stored)) return stored
  } catch {
    // Ignore
  }
  return "system"
}

function getEffectiveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark"
    }
    return "light"
  }
  return theme
}

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: "light" | "dark"
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setThemeState(getStoredTheme())
    setMounted(true)
  }, [])

  const setTheme = (next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Ignore
    }
  }

  const resolvedTheme = getEffectiveTheme(theme)

  useEffect(() => {
    if (!mounted) return
    const root = document.documentElement
    if (resolvedTheme === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }
  }, [resolvedTheme, mounted])

  // Sync system preference changes
  useEffect(() => {
    if (!mounted || theme !== "system") return
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const handle = () => {
      const root = document.documentElement
      if (getEffectiveTheme("system") === "dark") {
        root.classList.add("dark")
      } else {
        root.classList.remove("dark")
      }
    }
    media.addEventListener("change", handle)
    return () => media.removeEventListener("change", handle)
  }, [mounted, theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}
