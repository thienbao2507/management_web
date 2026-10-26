import React, { createContext, useContext, useEffect, useState } from "react"

export type Theme = "light" | "dark" | "system"

interface ThemeContextType {
  theme: Theme
  resolvedTheme: "light" | "dark"
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const STORAGE_KEY = "management_web_theme"

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === "light" || saved === "dark" || saved === "system") {
      return saved
    }
    return "system"
  })

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light")

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
      } else {
        root.classList.remove("dark")
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

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem(STORAGE_KEY, newTheme)
    setThemeState(newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
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
