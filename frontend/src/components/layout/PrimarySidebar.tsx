import React from "react"
import { UserAvatar } from "@/components/ui/UserAvatar"
import { useUsers } from "@/context/UserContext"
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Calendar,
  LibraryBig,
  Settings,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/Tooltip"

export type NavItemKey =
  | "dashboard"
  | "projects"
  | "tasks"
  | "calendar"
  | "resources"
  | "settings"

interface PrimarySidebarProps {
  activeItem: NavItemKey
  onSelectItem: (item: NavItemKey) => void
  className?: string
}

export const PrimarySidebar: React.FC<PrimarySidebarProps> = ({
  activeItem,
  onSelectItem,
  className,
}) => {
  const { currentUser, openIdentity } = useUsers()
  const navItems = [
    { key: "dashboard" as NavItemKey, label: "Command Center", icon: LayoutDashboard },
    { key: "projects" as NavItemKey, label: "Projects", icon: FolderKanban },
    { key: "tasks" as NavItemKey, label: "Tasks & Board", icon: CheckSquare },
    { key: "calendar" as NavItemKey, label: "Calendar", icon: Calendar },
    { key: "resources" as NavItemKey, label: "Project Resources", icon: LibraryBig },
    { key: "settings" as NavItemKey, label: "Settings", icon: Settings },
  ]

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        className={cn(
          "flex flex-col items-center justify-between w-14 shrink-0 bg-sidebar-primary py-3 text-sidebar-primary-foreground border-r border-sidebar-border/30 select-none z-30 transition-all shadow-md",
          className
        )}
      >
        {/* Top: App Brand Logo */}
        <div className="flex flex-col items-center gap-6">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500 text-white shadow-md shadow-blue-500/30 cursor-pointer hover:scale-105 transition-transform"
            title="Apex Command Center"
          >
            <Zap className="h-5 w-5 fill-white text-white" />
          </div>

          {/* Navigation Icons list */}
          <nav className="flex flex-col items-center gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeItem === item.key

              return (
                <Tooltip key={item.key}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onSelectItem(item.key)}
                      aria-label={item.label}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "relative flex h-9 w-9 items-center justify-center rounded-lg transition-all",
                        isActive
                          ? "bg-white/15 text-white font-semibold shadow-inner"
                          : "text-white/65 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      {/* Active indicator bar */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-blue-400" />
                      )}
                      <Icon className="h-4.5 w-4.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <span>{item.label}</span>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </nav>
        </div>

        {/* Bottom Avatar / Quick Settings */}
        <div className="flex flex-col items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => openIdentity("select")}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white font-bold text-xs ring-2 ring-white/20 cursor-pointer hover:ring-white/40 transition-all"
                title={currentUser?.display_name || "Choose workspace identity"}
                aria-label="Choose workspace identity"
              >
                <UserAvatar user={currentUser} size="md" className="border-0 bg-transparent text-white" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <span>{currentUser?.display_name || "Choose workspace identity"}</span>
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  )
}
