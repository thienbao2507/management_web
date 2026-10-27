import React from "react"
import {
  ChevronRight,
  Clock,
  AlertTriangle,
  Calendar as CalendarIcon,
} from "lucide-react"
import { MiniCalendar } from "@/components/widgets/MiniCalendar"
import { UserAvatar } from "@/components/ui/UserAvatar"
import { TaskAssigneeAvatar, TaskAssigneeName } from "@/components/identity/TaskIdentity"
import { useUsers } from "@/context/UserContext"
import { Badge } from "@/components/ui/Badge"
import { cn } from "@/lib/utils"
import { type ApiTask } from "@/services/api"

interface RightSidebarProps {
  tasks: ApiTask[]
  loading?: boolean
  error?: string | null
  isCollapsed: boolean
  onToggleCollapse: () => void
  onTaskClick?: (task: ApiTask) => void
  className?: string
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  tasks,
  loading, error,
  isCollapsed,
  onToggleCollapse,
  onTaskClick,
  className,
}) => {
  const { currentUser } = useUsers()
  // Extract upcoming deadlines from actual tasks
  const upcomingTasks = tasks
    .filter((t) => t.due_date && t.status !== "done")
    .sort((a, b) => (a.due_date! > b.due_date! ? 1 : -1))
    .slice(0, 5)

  // Blocked tasks from actual tasks
  const blockedTasks = tasks.filter((t) => t.is_blocked)

  const taskDates = tasks
    .map((t) => t.due_date)
    .filter(Boolean) as string[]

  return (
    <aside
      className={cn(
        "relative flex flex-col h-full bg-card border-l border-border/80 transition-all duration-200 select-none z-20",
        isCollapsed ? "w-0 overflow-hidden border-none" : "w-72 shrink-0",
        className
      )}
    >
      {/* Right Sidebar Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-border/70">
        <div className="flex items-center gap-2">
          <UserAvatar
            user={currentUser}
            size="sm"
          />
          <div>
            <h3 className="text-xs font-semibold text-foreground">
              {currentUser?.display_name || "No identity selected"}
            </h3>
            <p className="text-[10px] text-muted-foreground">{currentUser?.job_title || "Workspace profile"}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleCollapse}
          title="Collapse right sidebar"
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Content Scroll Container */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {loading || error ? <p role={error ? "alert" : "status"} className="text-xs text-muted-foreground">{error || "Loading project tasks..."}</p> : <>
        {/* Widget 1: Interactive Mini Calendar */}
        <div>
          <div className="flex items-center gap-1.5 mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <CalendarIcon className="h-3.5 w-3.5" />
            <span>Schedule & Milestones</span>
          </div>
          <MiniCalendar taskDueDates={taskDates} />
        </div>

        {/* Widget 2: Upcoming Deadlines */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Upcoming Deadlines</span>
            </div>
            <span className="text-[10px] font-semibold text-primary">
              {upcomingTasks.length} tasks
            </span>
          </div>

          <div className="space-y-2">
            {upcomingTasks.length > 0 ? (
              upcomingTasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => onTaskClick?.(t)}
                  className="group flex flex-col rounded-lg border border-border/60 bg-surface/40 p-2.5 transition-all hover:border-primary/40 hover:bg-card cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-mono text-[10px] font-bold text-muted-foreground group-hover:text-primary transition-colors">
                      {t.task_key}
                    </span>
                    <Badge
                      variant={t.priority === "urgent" ? "urgent" : "secondary"}
                      className="text-[9px] py-0 px-1.5"
                    >
                      {t.due_date}
                    </Badge>
                  </div>
                  <h4 className="text-xs font-medium text-foreground line-clamp-1">
                    {t.title}
                  </h4>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <TaskAssigneeAvatar
                        task={t}
                        size="xs"
                      />
                      <span><TaskAssigneeName task={t} /></span>
                    </span>
                    <span className="capitalize">{t.status.replace("_", " ")}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border/70 p-3 text-center text-xs text-muted-foreground">
                No upcoming deadlines in this project.
              </div>
            )}
          </div>
        </div>

        {/* Widget 3: Blocker / Attention Alert */}
        {blockedTasks.length > 0 && (
          <div className="rounded-lg border border-rose-300/80 bg-rose-50/70 dark:border-rose-900/60 dark:bg-rose-950/30 p-3 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-rose-800 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4" />
              <span>{blockedTasks.length} Blocked Task(s)</span>
            </div>
            <div className="mt-1.5 space-y-1.5">
              {blockedTasks.slice(0, 2).map((bt) => (
                <div key={bt.id} className="text-[11px] text-rose-700 dark:text-rose-400/90 leading-tight">
                  <strong className="font-mono">{bt.task_key}:</strong> {bt.blocker_reason || bt.title}
                </div>
              ))}
            </div>
          </div>
        )}
        </>}
      </div>
    </aside>
  )
}
