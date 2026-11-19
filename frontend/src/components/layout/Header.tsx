import React from "react"
import {
  Plus,
  UserPlus,
  PanelLeft,
  PanelRight,
  Menu,
} from "lucide-react"
import { SearchInput } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { UserAvatar } from "@/components/ui/UserAvatar"
import { useUsers } from "@/context/UserContext"
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher"
import { type ApiProject, type ApiMember, type ApiWorkspace } from "@/services/api"

interface HeaderProps {
  currentWorkspace: ApiWorkspace | null
  legacyMode: boolean
  currentProject: ApiProject | null
  searchQuery: string
  onSearchChange: (query: string) => void
  onCreateTaskClick: () => void
  onCreateResourceClick: () => void
  createTaskDisabled: boolean
  onToggleSecondarySidebar: () => void
  onToggleRightSidebar: () => void
  onToggleMobileMenu?: () => void
  isSecondaryCollapsed: boolean
  isRightCollapsed: boolean
  isResourcesView: boolean
  members: ApiMember[]
  membersLoading: boolean
  membersError: string | null
  onMembersClick: () => void
  sprintLabel: string
}

export const Header: React.FC<HeaderProps> = ({
  currentWorkspace,
  legacyMode,
  currentProject,
  searchQuery,
  onSearchChange,
  onCreateTaskClick,
  onCreateResourceClick,
  createTaskDisabled,
  onToggleSecondarySidebar,
  onToggleRightSidebar,
  onToggleMobileMenu,
  isSecondaryCollapsed,
  isRightCollapsed,
  isResourcesView,
  members, membersLoading, membersError, onMembersClick, sprintLabel,
}) => {
  const { usersById } = useUsers()
  return (
    <>
    <header className="flex h-13 shrink-0 items-center justify-between border-b border-border/80 bg-card/80 px-3.5 sm:px-4 backdrop-blur-md select-none z-10">
      {/* Left: Mobile Toggle / Breadcrumb / Workspace info */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile menu hamburger */}
        <button
          type="button"
          onClick={onToggleMobileMenu}
          aria-label="Mở thanh điều hướng"
          className="md:hidden flex h-8 w-8 items-center justify-center rounded-md border border-border/70 text-muted-foreground hover:bg-muted"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Sidebar collapse toggle (Desktop) */}
        <button
          type="button"
          onClick={onToggleSecondarySidebar}
          title={isSecondaryCollapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
          className="hidden md:flex h-8 w-8 items-center justify-center rounded-md border border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <PanelLeft className="h-4 w-4" />
        </button>

        {/* Workspace hierarchy breadcrumb */}
        <div className="flex items-center gap-1.5 truncate">
          <span className="text-xs font-bold text-foreground truncate">
            {legacyMode ? "Được chia sẻ với tôi" : currentWorkspace?.name || "Chưa có Workspace"}
          </span>
          {currentProject && (
            <>
              <span className="text-muted-foreground text-xs">/</span>
              <span className="hidden max-w-32 truncate text-[11px] font-semibold text-foreground sm:inline-block">
                {currentProject.name}
              </span>
            </>
          )}
          {(isResourcesView || currentProject) && (
            <>
              <span className="text-muted-foreground text-xs">/</span>
              <span className="hidden sm:inline-block rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary font-mono truncate">
                {isResourcesView ? "Resources" : `${currentProject?.key || "Dự án"} • ${sprintLabel}`}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Center: Search input */}
      <div className={`${isResourcesView ? "hidden sm:flex" : "flex"} flex-1 max-w-xs md:max-w-sm mx-2 sm:mx-4`}>
        <SearchInput
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onClear={() => onSearchChange("")}
          placeholder={isResourcesView ? "Tìm tất cả Resources..." : "Tìm công việc..."}
          aria-label={isResourcesView ? "Tìm tất cả Resources" : "Tìm công việc"}
        />
      </div>

      {/* Right: Team Avatars, Create Task, Theme Switcher */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Team Avatars cluster */}
        <div className={`${isResourcesView ? "hidden" : "hidden lg:flex"} items-center -space-x-1.5 mr-1`}>
          {members.slice(0, 4).map((member) => (
            <UserAvatar
              key={member.user_id}
              user={usersById[member.user_id]}
              size="sm"
              className="ring-2 ring-card"
              title={usersById[member.user_id]?.display_name || "Người dùng không khả dụng"}
            />
          ))}
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-full bg-muted border border-border text-muted-foreground hover:text-foreground text-[10px] font-medium"
            title={membersLoading ? "Đang tải thành viên" : membersError || "Quản lý thành viên dự án"}
            onClick={onMembersClick}
          >
            <UserPlus className="h-3 w-3" />
          </button>
        </div>

        {/* Primary Action: + Create Task */}
        <Button
          size="sm"
          onClick={isResourcesView ? onCreateResourceClick : onCreateTaskClick}
          aria-label={isResourcesView ? "Thêm Resource" : "Tạo công việc"}
          disabled={createTaskDisabled}
          className="gap-1 font-semibold shadow-xs"
        >
          <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
          <span className="hidden sm:inline">{isResourcesView ? "Thêm Resource" : "Tạo công việc"}</span>
        </Button>

        {/* Theme Switcher */}
        <ThemeSwitcher variant="pills" className="hidden sm:inline-flex" />
        <ThemeSwitcher variant="icon" className="sm:hidden" />

        {/* Toggle Right Sidebar button (Desktop) */}
        <button
          type="button"
          onClick={onToggleRightSidebar}
          title={isRightCollapsed ? "Mở rộng panel phải" : "Thu gọn panel phải"}
          className={`${isResourcesView ? "hidden" : "hidden md:flex"} h-8 w-8 items-center justify-center rounded-md border border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors`}
        >
          <PanelRight className="h-4 w-4" />
        </button>
      </div>
    </header>
    </>
  )
}
