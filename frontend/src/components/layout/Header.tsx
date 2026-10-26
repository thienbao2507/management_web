import React from "react"
import {
  Bell,
  Plus,
  UserPlus,
  PanelLeft,
  PanelRight,
  Menu,
  Database,
} from "lucide-react"
import { SearchInput } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { Avatar } from "@/components/ui/Avatar"
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu"
import { USERS } from "@/data/mockData"
import { type ApiProject } from "@/services/api"

interface HeaderProps {
  currentProject: ApiProject | null
  searchQuery: string
  onSearchChange: (query: string) => void
  onCreateTaskClick: () => void
  onToggleSecondarySidebar: () => void
  onToggleRightSidebar: () => void
  onToggleMobileMenu?: () => void
  isSecondaryCollapsed: boolean
  isRightCollapsed: boolean
}

export const Header: React.FC<HeaderProps> = ({
  currentProject,
  searchQuery,
  onSearchChange,
  onCreateTaskClick,
  onToggleSecondarySidebar,
  onToggleRightSidebar,
  onToggleMobileMenu,
  isSecondaryCollapsed,
  isRightCollapsed,
}) => {
  return (
    <header className="flex h-13 shrink-0 items-center justify-between border-b border-border/80 bg-card/80 px-3.5 sm:px-4 backdrop-blur-md select-none z-10">
      {/* Left: Mobile Toggle / Breadcrumb / Workspace info */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile menu hamburger */}
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="md:hidden flex h-8 w-8 items-center justify-center rounded-md border border-border/70 text-muted-foreground hover:bg-muted"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Sidebar collapse toggle (Desktop) */}
        <button
          type="button"
          onClick={onToggleSecondarySidebar}
          title={isSecondaryCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden md:flex h-8 w-8 items-center justify-center rounded-md border border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <PanelLeft className="h-4 w-4" />
        </button>

        {/* Project Breadcrumb */}
        <div className="flex items-center gap-1.5 truncate">
          <span className="text-xs font-bold text-foreground truncate">
            {currentProject ? currentProject.name : "Management Web"}
          </span>
          {currentProject && (
            <>
              <span className="text-muted-foreground text-xs">/</span>
              <span className="hidden sm:inline-block rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary font-mono truncate">
                {currentProject.key} • Active Sprint
              </span>
            </>
          )}
        </div>
      </div>

      {/* Center: Search input */}
      <div className="flex flex-1 max-w-xs md:max-w-sm mx-2 sm:mx-4">
        <SearchInput
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onClear={() => onSearchChange("")}
          placeholder="Search Neon tasks..."
        />
      </div>

      {/* Right: Team Avatars, Create Task, Theme Switcher, Notifications, Profile */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Neon Status Indicator */}
        <div className="hidden xl:flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground bg-muted/50 border border-border/60 px-2 py-1 rounded-md">
          <Database className="h-3 w-3 text-emerald-500" />
          <span>Neon PG</span>
        </div>

        {/* Team Avatars cluster */}
        <div className="hidden lg:flex items-center -space-x-1.5 mr-1">
          {Object.values(USERS).slice(0, 4).map((u) => (
            <Avatar
              key={u.id}
              src={u.avatar}
              fallback={u.initials}
              size="sm"
              className="ring-2 ring-card"
              title={u.name}
            />
          ))}
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-full bg-muted border border-border text-muted-foreground hover:text-foreground text-[10px] font-medium"
            title="Invite team member"
          >
            <UserPlus className="h-3 w-3" />
          </button>
        </div>

        {/* Primary Action: + Create Task */}
        <Button
          size="sm"
          onClick={onCreateTaskClick}
          className="gap-1 font-semibold shadow-xs"
        >
          <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
          <span className="hidden sm:inline">Create Task</span>
        </Button>

        {/* Theme Switcher */}
        <ThemeSwitcher variant="pills" className="hidden sm:inline-flex" />
        <ThemeSwitcher variant="icon" className="sm:hidden" />

        {/* Notification Bell */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="relative flex h-8 w-8 items-center justify-center rounded-md border border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-card" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Neon PostgreSQL Connected</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-2">
              <span className="font-semibold text-[11px] text-foreground">
                Database Branch: production
              </span>
              <span className="text-[10px] text-muted-foreground">
                Organization: org-fancy-base-20633937
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Profile Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center rounded-full focus:outline-none ring-offset-background focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Avatar
                src={USERS.alex.avatar}
                fallback={USERS.alex.initials}
                size="sm"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-semibold">{USERS.alex.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {USERS.alex.email}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile & Preferences</DropdownMenuItem>
            <DropdownMenuItem>Workspace Settings</DropdownMenuItem>
            <DropdownMenuItem>Keyboard Shortcuts</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Toggle Right Sidebar button (Desktop) */}
        <button
          type="button"
          onClick={onToggleRightSidebar}
          title={isRightCollapsed ? "Expand right panel" : "Collapse right panel"}
          className="hidden md:flex h-8 w-8 items-center justify-center rounded-md border border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <PanelRight className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
