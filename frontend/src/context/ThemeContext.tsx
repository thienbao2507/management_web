import React, { createContext, useContext, useEffect, useState } from "react"

export type Theme = "light" | "dark" | "system"

export const ACCENT_COLORS = [
  { key: "blue", label: "Xanh dương", swatch: "hsl(221 83% 53%)" },
  { key: "indigo", label: "Chàm", swatch: "hsl(243 75% 59%)" },
  { key: "violet", label: "Tím", swatch: "hsl(262 83% 58%)" },
  { key: "pink", label: "Hồng", swatch: "hsl(330 81% 60%)" },
  { key: "red", label: "Đỏ", swatch: "hsl(0 72% 51%)" },
  { key: "orange", label: "Cam", swatch: "hsl(21 90% 48%)" },
  { key: "green", label: "Xanh lá", swatch: "hsl(161 94% 30%)" },
  { key: "teal", label: "Xanh ngọc", swatch: "hsl(175 84% 32%)" },
] as const satisfies readonly { key: string; label: string; swatch: string }[]

export type AccentColor = (typeof ACCENT_COLORS)[number]["key"]

interface ThemeContextType {
  theme: Theme
  resolvedTheme: "light" | "dark"
  accent: AccentColor
  setTheme: (theme: Theme) => void
  setAccent: (accent: AccentColor) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_STORAGE_KEY = "management_web_theme"
const ACCENT_STORAGE_KEY = "management_web_accent"

const isAccentColor = (value: string | null): value is AccentColor =>
  ACCENT_COLORS.some(({ key }) => key === value)

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY)
      if (saved === "light" || saved === "dark" || saved === "system") {
        return saved
      }
    } catch {
      // Use the system theme when storage is unavailable.
    }
    return "system"
  })

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light")
  const [accent, setAccentState] = useState<AccentColor>(() => {
    try {
      const saved = localStorage.getItem(ACCENT_STORAGE_KEY)
      return isAccentColor(saved) ? saved : "blue"
    } catch {
      return "blue"
    }
  })

  useEffect(() => {
    const root = window.document.documentElement

    const updateResolvedTheme = () => {
      let activeTheme: "light" | "dark" = "light"
      if (theme === "system") {
        const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
        activeTheme = systemPrefersDark ? "dark" : "light"
      } else {
        activeTheme = theme
      }

      setResolvedTheme(activeTheme)

      if (activeTheme === "dark") {
        root.classList.add("dark")
        root.style.colorScheme = "dark"
      } else {
        root.classList.remove("dark")
        root.style.colorScheme = "light"
      }
    }

    updateResolvedTheme()

    // Listen to OS system color scheme change
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => {
      if (theme === "system") {
        updateResolvedTheme()
      }
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [theme])

  useEffect(() => {
    document.documentElement.dataset.accent = accent
  }, [accent])

  const setTheme = (newTheme: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme)
    } catch {
      // Keep the in-memory selection when storage is unavailable.
    }
    setThemeState(newTheme)
  }

  const setAccent = (newAccent: AccentColor) => {
    try {
      localStorage.setItem(ACCENT_STORAGE_KEY, newAccent)
    } catch {
      // Keep the in-memory selection when storage is unavailable.
    }
    setAccentState(newAccent)
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, accent, setTheme, setAccent }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
