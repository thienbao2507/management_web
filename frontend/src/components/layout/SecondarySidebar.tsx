import React from "react"
import {
  LayoutDashboard,
  Map,
  Kanban,
  FileText,
  AlertCircle,
  Package,
  Users,
  Settings,
  ChevronLeft,
  FolderGit2,
  Plus,
  Check,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { type ApiProject } from "@/services/api"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu"

export type SecondaryNavKey =
  | "dashboard"
  | "roadmap"
  | "active_sprint"
  | "reports"
  | "issues"
  | "releases"
  | "team"
  | "settings"

interface SecondarySidebarProps {
  projects: ApiProject[]
  selectedProject: ApiProject | null
  onSelectProject: (proj: ApiProject) => void
  onCreateProjectClick: () => void
  activeItem: SecondaryNavKey
  onSelectItem: (item: SecondaryNavKey) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  tasksCount?: number
  className?: string
}

export const SecondarySidebar: React.FC<SecondarySidebarProps> = ({
  projects,
  selectedProject,
  onSelectProject,
  onCreateProjectClick,
  activeItem,
  onSelectItem,
  isCollapsed,
  onToggleCollapse,
  tasksCount = 0,
  className,
}) => {
  const menuItems = [
    { key: "dashboard" as SecondaryNavKey, label: "Dashboard", icon: LayoutDashboard },
    { key: "roadmap" as SecondaryNavKey, label: "Roadmap", icon: Map },
    {
      key: "active_sprint" as SecondaryNavKey,
      label: "Active Sprint",
      icon: Kanban,
      badge: "Active",
    },
    { key: "issues" as SecondaryNavKey, label: "Issues / Tasks", icon: AlertCircle, count: String(tasksCount) },
    { key: "reports" as SecondaryNavKey, label: "Reports", icon: FileText },
    { key: "releases" as SecondaryNavKey, label: "Releases", icon: Package },
    { key: "team" as SecondaryNavKey, label: "Team Members", icon: Users, count: "5" },
    { key: "settings" as SecondaryNavKey, label: "Settings", icon: Settings },
  ]

  return (
    <aside
      className={cn(
        "relative flex flex-col h-full bg-sidebar-secondary text-sidebar-secondary-foreground border-r border-sidebar-border transition-all duration-200 select-none",
        isCollapsed ? "w-0 overflow-hidden border-none" : "w-56 shrink-0",
        className
      )}
    >
      {/* Workspace / Project Selector Dropdown */}
      <div className="flex items-center justify-between p-2.5 border-b border-border/70">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 min-w-0 flex-1 text-left rounded-lg p-1 hover:bg-muted/70 transition-colors group"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-400 font-bold text-xs">
                {selectedProject?.key || <FolderGit2 className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-foreground truncate">
                    {selectedProject ? selectedProject.name : "Select Project"}
                  </h2>
                  <ChevronDown className="h-3 w-3 text-muted-foreground ml-1" />
                </div>
                <p className="text-[10px] text-muted-foreground truncate font-mono">
                  {selectedProject ? `Key: ${selectedProject.key}` : "Neon PostgreSQL"}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Neon Projects</span>
              <span className="text-[10px] text-muted-foreground">{projects.length} total</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {projects.map((proj) => (
              <DropdownMenuItem
                key={proj.id}
                onClick={() => onSelectProject(proj)}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="font-mono text-[10px] font-bold text-primary">
                    {proj.key}
                  </span>
                  <span className="truncate text-xs">{proj.name}</span>
                </div>
                {selectedProject?.id === proj.id && (
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
            {projects.length === 0 && (
              <div className="p-2 text-center text-xs text-muted-foreground">
                No projects found on Neon.
              </div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onCreateProjectClick}
              className="text-primary font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create New Project</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Collapse toggle button */}
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Collapse sidebar"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ml-1"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
          Workspace Views
        </div>

        <nav className="space-y-0.5">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = activeItem === item.key

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelectItem(item.key)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-medium transition-all group",
                  isActive
                    ? "bg-primary/10 text-primary font-semibold dark:bg-primary/20"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge && (
                  <span className="rounded-full bg-blue-500/15 px-1.5 py-0.2 text-[9px] font-semibold text-primary">
                    {item.badge}
                  </span>
                )}

                {item.count && (
                  <span className="text-[10px] text-muted-foreground">
                    {item.count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Database Connection Status Badge */}
      <div className="p-3 border-t border-border/70">
        <div className="rounded-lg border border-border/80 bg-surface/50 p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-semibold text-foreground">Neon PostgreSQL</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">Live</span>
        </div>
      </div>
    </aside>
  )
}
