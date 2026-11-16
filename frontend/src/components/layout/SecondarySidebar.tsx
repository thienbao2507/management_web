import React, { useState } from "react"
import {
  LayoutDashboard,
  Map,
  Kanban,
  LibraryBig,
  AlertCircle,
  Package,
  Users,
  Settings,
  ChevronLeft,
  FolderGit2,
  Plus,
  Check,
  ChevronDown,
  Building2,
  Archive,
  ChevronsUpDown,
} from "lucide-react"
import { UserAvatar } from "@/components/ui/UserAvatar"
import { useUsers } from "@/context/UserContext"
import { ACCENT_COLORS, useTheme } from "@/context/ThemeContext"
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog"
import { cn } from "@/lib/utils"
import { type ApiProject, type ApiWorkspace } from "@/services/api"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu"

export type SecondaryNavKey =
  | "dashboard"
  | "roadmap"
  | "active_sprint"
  | "resources"
  | "issues"
  | "releases"
  | "team"
  | "settings"

// Tạm ẩn các view chưa hoàn thiện; chỉ hiện các tính năng đang dùng thật.
export const VISIBLE_NAV_KEYS: SecondaryNavKey[] = ["active_sprint", "resources"]

interface SecondarySidebarProps {
  currentWorkspace: ApiWorkspace | null
  workspaceLoading: boolean
  workspaceError: string | null
  legacyMode: boolean
  projects: ApiProject[]
  selectedProject: ApiProject | null
  onSelectProject: (proj: ApiProject) => void
  onCreateProjectClick: () => void
  onCreateWorkspaceClick: () => void
  onSelectUnassigned: () => void
  activeItem: SecondaryNavKey
  onSelectItem: (item: SecondaryNavKey) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  tasksCount?: number
  membersCount?: number | null
  className?: string
}

export const SecondarySidebar: React.FC<SecondarySidebarProps> = ({
  currentWorkspace,
  workspaceLoading,
  workspaceError,
  legacyMode,
  projects,
  selectedProject,
  onSelectProject,
  onCreateProjectClick,
  onCreateWorkspaceClick,
  onSelectUnassigned,
  activeItem,
  onSelectItem,
  isCollapsed,
  onToggleCollapse,
  tasksCount = 0,
  membersCount,
  className,
}) => {
  const { currentUser, openIdentity, logout } = useUsers()
  const { accent, setAccent } = useTheme()
  const [feedbackOpen, setFeedbackOpen] = useState(false)

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
    { key: "resources" as SecondaryNavKey, label: "Resources", icon: LibraryBig },
    { key: "releases" as SecondaryNavKey, label: "Releases", icon: Package },
    { key: "team" as SecondaryNavKey, label: "Team Members", icon: Users, count: membersCount == null ? "—" : String(membersCount) },
    { key: "settings" as SecondaryNavKey, label: "Settings", icon: Settings },
  ].filter((item) => VISIBLE_NAV_KEYS.includes(item.key))

  return (
    <aside
      className={cn(
        "relative flex flex-col h-full bg-sidebar-secondary text-sidebar-secondary-foreground border-r border-sidebar-border transition-all duration-200 select-none",
        isCollapsed ? "w-0 overflow-hidden border-none" : "w-56 shrink-0",
        className
      )}
    >
      {/* Actual Workspace context and Project selector */}
      <div className="border-b border-border/70 p-2.5">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {legacyMode ? <Archive className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Workspace</p>
            <p className="truncate text-xs font-semibold" title={workspaceError || undefined}>
              {legacyMode ? "Shared with me" : workspaceLoading ? "Loading..." : currentWorkspace?.name || (workspaceError ? "Unavailable" : "No Workspace")}
            </p>
          </div>
          <button type="button" onClick={onToggleCollapse} title="Collapse sidebar" className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-2 flex gap-1.5">
          {!currentWorkspace && !workspaceLoading && !workspaceError && !legacyMode && (
            <button type="button" onClick={onCreateWorkspaceClick} className="flex flex-1 items-center justify-center gap-1 rounded-md border border-primary/30 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/10">
              <Plus className="h-3 w-3" /> Create Workspace
            </button>
          )}
          <button type="button" onClick={onSelectUnassigned} aria-pressed={legacyMode} className={cn("flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold", legacyMode ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted") }>
            <Archive className="h-3 w-3" /> {legacyMode ? "Back to Workspace" : "Shared"}
          </button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Select project: ${selectedProject?.name || "none"}`}
              className="flex w-full items-center gap-2 min-w-0 text-left rounded-lg border border-border/70 p-1.5 hover:bg-muted/70 transition-colors group"
            >
              <div title={selectedProject?.key} className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/15 px-0.5 text-primary font-bold text-[10px]">
                {selectedProject?.key ? <span className="truncate">{selectedProject.key}</span> : <FolderGit2 className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-foreground truncate">
                    {selectedProject ? selectedProject.name : "Select Project"}
                  </h2>
                  <ChevronDown className="h-3 w-3 text-muted-foreground ml-1" />
                </div>
                <p className="text-[10px] text-muted-foreground truncate font-mono">
                  {selectedProject ? `Key: ${selectedProject.key}` : legacyMode ? "Project shared with you" : "Project in Workspace"}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>{legacyMode ? "Shared Projects" : "Workspace Projects"}</span>
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
                No Projects in this scope.
              </div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onCreateProjectClick}
              disabled={!currentWorkspace || legacyMode}
              className="text-primary font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create New Project</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
          Project Views
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
                aria-current={isActive ? "page" : undefined}
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
                  <span className="rounded-full bg-primary/15 px-1.5 py-0.2 text-[9px] font-semibold text-primary">
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

      {/* User profile menu */}
      <div className="p-3 border-t border-border/70">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="User profile menu"
              className="flex w-full items-center gap-2 rounded-lg border border-border/80 bg-surface/50 p-2 text-left transition-colors hover:bg-muted focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <UserAvatar user={currentUser} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-semibold text-foreground">{currentUser?.display_name || "Not signed in"}</span>
                <span className="block truncate text-[10px] text-muted-foreground">{currentUser?.email || currentUser?.job_title || "Authenticated profile"}</span>
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-semibold">{currentUser?.display_name || "Not signed in"}</span>
                <span className="text-[10px] text-muted-foreground">
                  {currentUser?.job_title || "Authenticated profile"}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {currentUser && <DropdownMenuItem onSelect={() => openIdentity("edit")}>Edit profile</DropdownMenuItem>}
            {currentUser && <DropdownMenuItem onSelect={() => setFeedbackOpen(true)}>Send feedback</DropdownMenuItem>}
            {currentUser && <DropdownMenuItem onSelect={() => void logout()}>Sign out</DropdownMenuItem>}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2">
                <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: ACCENT_COLORS.find((color) => color.key === accent)?.swatch }} />
                Theme
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-40">
                {ACCENT_COLORS.map(({ key, label, swatch }) => (
                  <DropdownMenuItem
                    key={key}
                    onSelect={(event) => { event.preventDefault(); setAccent(key) }}
                    aria-checked={accent === key}
                    role="menuitemradio"
                    className="gap-2"
                  >
                    <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: swatch }} />
                    <span className="flex-1">{label}</span>
                    {accent === key && <Check aria-hidden="true" className="h-3.5 w-3.5 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem>Keyboard Shortcuts</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </aside>
  )
}
