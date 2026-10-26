import React from "react"
import { Droppable, Draggable } from "@hello-pangea/dnd"
import { Plus, MoreHorizontal } from "lucide-react"
import { type ApiTask } from "@/services/api"
import { TaskCard } from "./TaskCard"
import { EmptyState } from "@/components/ui/EmptyState"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"

interface KanbanColumnProps {
  id: "backlog" | "todo" | "in_progress" | "done"
  title: string
  tasks: ApiTask[]
  accentColor: string
  onTaskClick?: (task: ApiTask) => void
  onQuickAdd?: (status: "backlog" | "todo" | "in_progress" | "done") => void
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  id,
  title,
  tasks,
  accentColor,
  onTaskClick,
  onQuickAdd,
}) => {
  return (
    <div className="flex flex-col h-full min-w-[280px] sm:min-w-[300px] max-w-[340px] flex-1 rounded-xl bg-surface/60 border border-border/70 p-3 select-none">
      {/* Column Header */}
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          {/* Status Color Dot */}
          <span className={cn("h-2.5 w-2.5 rounded-full", accentColor)} />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
            {title}
          </h3>
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground">
            {tasks.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="iconSm"
            onClick={() => onQuickAdd?.(id)}
            title="Quick add task to this column"
            className="text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="iconSm"
            title="Column options"
            className="text-muted-foreground hover:text-foreground"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Droppable Task List container */}
      <Droppable droppableId={id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex flex-1 flex-col gap-2.5 overflow-y-auto pr-1 pb-2 transition-colors rounded-lg",
              snapshot.isDraggingOver && "bg-primary/5 ring-1 ring-primary/30"
            )}
          >
            {tasks.map((task, index) => (
              <Draggable key={task.id} draggableId={task.id} index={index}>
                {(dragProvided, dragSnapshot) => (
                  <TaskCard
                    ref={dragProvided.innerRef}
                    task={task}
                    onClick={onTaskClick}
                    isDragging={dragSnapshot.isDragging}
                    {...dragProvided.draggableProps}
                    {...dragProvided.dragHandleProps}
                  />
                )}
              </Draggable>
            ))}
            {provided.placeholder}

            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <EmptyState
                title="No tasks in this column"
                description="Drag a task here or click + Add Task."
                className="my-auto py-8"
              />
            )}
          </div>
        )}
      </Droppable>

      {/* Bottom Quick Add Footer */}
      <div className="pt-2 border-t border-border/40">
        <button
          type="button"
          onClick={() => onQuickAdd?.(id)}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border/80 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:bg-card hover:text-foreground transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Task</span>
        </button>
      </div>
    </div>
  )
}
