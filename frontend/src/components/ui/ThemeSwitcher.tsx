import React from "react"
import { Sun, Moon, Monitor } from "lucide-react"
import { useTheme, type Theme } from "@/context/ThemeContext"
import { cn } from "@/lib/utils"

interface ThemeSwitcherProps {
  variant?: "pills" | "dropdown" | "icon"
  className?: string
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({
  variant = "pills",
  className,
}) => {
  const { theme, setTheme } = useTheme()

  if (variant === "icon") {
    // Single toggle button that cycles through light -> dark -> system
    const nextTheme: Record<Theme, Theme> = {
      light: "dark",
      dark: "system",
      system: "light",
    }

    return (
      <button
        type="button"
        onClick={() => setTheme(nextTheme[theme])}
        title={`Theme: ${theme}. Click to change.`}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-surface/50 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors",
          className
        )}
      >
        {theme === "light" && <Sun className="h-4 w-4 text-amber-500" />}
        {theme === "dark" && <Moon className="h-4 w-4 text-blue-400" />}
        {theme === "system" && <Monitor className="h-4 w-4" />}
      </button>
    )
  }

  // Segmented Pill Control (Default)
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border border-border/80 bg-surface/80 p-0.5 text-xs shadow-sm",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all",
          theme === "light"
            ? "bg-background text-foreground shadow-sm font-semibold"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Sun className={cn("h-3.5 w-3.5", theme === "light" && "text-amber-500")} />
        <span className="hidden sm:inline">Light</span>
      </button>

      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all",
          theme === "dark"
            ? "bg-background text-foreground shadow-sm font-semibold"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Moon className={cn("h-3.5 w-3.5", theme === "dark" && "text-blue-400")} />
        <span className="hidden sm:inline">Dark</span>
      </button>

      <button
        type="button"
        onClick={() => setTheme("system")}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all",
          theme === "system"
            ? "bg-background text-foreground shadow-sm font-semibold"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Monitor className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">System</span>
      </button>
    </div>
  )
}
