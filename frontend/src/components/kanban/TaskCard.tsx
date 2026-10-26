import React from "react"
import { CheckSquare, MessageSquare, AlertCircle, Calendar } from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { Avatar } from "@/components/ui/Avatar"
import { cn } from "@/lib/utils"
import { type ApiTask } from "@/services/api"

interface TaskCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> {
  task: ApiTask
  onClick?: (task: ApiTask) => void
  isDragging?: boolean
}

export const TaskCard = React.forwardRef<HTMLDivElement, TaskCardProps>(
  ({ task, onClick, isDragging, className, ...props }, ref) => {
    const completedSubtasks = task.subtasks?.filter((st) => st.is_completed).length || 0
    const totalSubtasks = task.subtasks?.length || 0

    const isUrgent = task.priority === "urgent"

    return (
      <div
        ref={ref}
        onClick={() => onClick?.(task)}
        className={cn(
          "group relative flex flex-col rounded-lg border border-border/80 bg-card p-3.5 shadow-xs transition-all duration-150 hover:border-primary/50 hover:shadow-md cursor-grab active:cursor-grabbing select-none",
          task.is_blocked && "border-rose-300/80 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10",
          isDragging && "shadow-xl border-primary ring-2 ring-primary/30 rotate-1 opacity-95",
          className
        )}
        {...props}
      >
        {/* Top row: Key, Category & Priority */}
        <div className="flex items-center justify-between gap-1 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-mono font-semibold text-muted-foreground group-hover:text-primary transition-colors">
              {task.task_key}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground/70">•</span>
            <span className="text-[11px] font-medium text-muted-foreground">
              {task.category}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {task.is_blocked && (
              <Badge variant="blocked" className="h-4 px-1.5 text-[9px] gap-0.5">
                <AlertCircle className="h-2.5 w-2.5" />
                Blocked
              </Badge>
            )}
            <Badge variant={task.priority} className="text-[10px] uppercase font-bold tracking-wider">
              {task.priority}
            </Badge>
          </div>
        </div>

        {/* Optional Thumbnail preview */}
        {task.thumbnail && (
          <div className="relative mb-2.5 h-24 w-full overflow-hidden rounded-md border border-border/60">
            <img
              src={task.thumbnail}
              alt={task.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        )}

        {/* Title */}
        <h4 className="text-xs font-medium text-foreground line-clamp-2 leading-relaxed mb-1.5">
          {task.title}
        </h4>

        {/* Description Snippet */}
        {task.description && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-normal mb-3">
            {task.description}
          </p>
        )}

        {/* Bottom row: Subtasks, Due Date, Assignee */}
        <div className="mt-auto flex items-center justify-between border-t border-border/50 pt-2.5 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            {/* Subtasks Progress */}
            {totalSubtasks > 0 && (
              <span
                className={cn(
                  "flex items-center gap-1 font-medium",
                  completedSubtasks === totalSubtasks
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
                )}
                title={`${completedSubtasks}/${totalSubtasks} checklist items completed`}
              >
                <CheckSquare className="h-3 w-3" />
                <span>{completedSubtasks}/{totalSubtasks}</span>
              </span>
            )}

            {/* Due Date */}
            {task.due_date && (
              <span
                className={cn(
                  "flex items-center gap-1",
                  isUrgent ? "text-red-500 font-semibold" : "text-muted-foreground"
                )}
              >
                <Calendar className="h-3 w-3" />
                <span>{task.due_date.slice(5)}</span>
              </span>
            )}
          </div>

          {/* Assignee Avatar */}
          <div className="flex items-center">
            <Avatar
              src={task.assignee_avatar || undefined}
              fallback={task.assignee_initials || task.assignee_name?.slice(0, 2).toUpperCase() || "ME"}
              size="sm"
              alt={task.assignee_name || "Assignee"}
              title={task.assignee_name ? `Assigned to ${task.assignee_name}` : "Unassigned"}
            />
          </div>
        </div>
      </div>
    )
  }
)
TaskCard.displayName = "TaskCard"
