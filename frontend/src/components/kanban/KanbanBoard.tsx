import React, { useState } from "react"
import { DragDropContext, type DropResult } from "@hello-pangea/dnd"
import { type ApiTask } from "@/services/api"
import { KanbanColumn } from "./KanbanColumn"
import { Button } from "@/components/ui/Button"
import { Avatar } from "@/components/ui/Avatar"
import { Filter, AlertCircle, Sparkles } from "lucide-react"

interface KanbanBoardProps {
  tasks: ApiTask[]
  searchQuery: string
  onTaskClick: (task: ApiTask) => void
  onQuickAdd: (status: "backlog" | "todo" | "in_progress" | "done") => void
  onTaskMove: (taskId: string, newStatus: "backlog" | "todo" | "in_progress" | "done", newPosition: number) => void
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  searchQuery,
  onTaskClick,
  onQuickAdd,
  onTaskMove,
}) => {
  // Active Filter state
  const [activeFilter, setActiveFilter] = useState<"all" | "my" | "urgent" | "blocked">("all")
  const [selectedAssignee, setSelectedAssignee] = useState<string>("all")

  // Extract unique assignees from tasks
  const assignees = Array.from(
    new Set(tasks.map((t) => t.assignee_name).filter(Boolean))
  ) as string[]

  // Filter tasks based on search, active quick filter and assignee
  const filteredTasks = tasks.filter((task) => {
    // Search query matching
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchesTitle = task.title.toLowerCase().includes(q)
      const matchesKey = task.task_key.toLowerCase().includes(q)
      const matchesCategory = task.category.toLowerCase().includes(q)
      const matchesAssignee = task.assignee_name?.toLowerCase().includes(q)
      if (!matchesTitle && !matchesKey && !matchesCategory && !matchesAssignee) {
        return false
      }
    }

    // Assignee filter
    if (selectedAssignee !== "all" && task.assignee_name !== selectedAssignee) {
      return false
    }

    // Quick filters
    if (activeFilter === "my") {
      return task.assignee_name === "Alex Morgan" || task.assignee_name?.includes("Alex")
    }
    if (activeFilter === "urgent") {
      return task.priority === "urgent" || task.priority === "high"
    }
    if (activeFilter === "blocked") {
      return task.is_blocked === true
    }

    return true
  })

  // Handle Drag & Drop end
  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result

    // Dropped outside or no movement
    if (!destination) return
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return
    }

    const newStatus = destination.droppableId as "backlog" | "todo" | "in_progress" | "done"
    const newPosition = destination.index

    onTaskMove(draggableId, newStatus, newPosition)
  }

  // 4 Standard Kanban Columns
  const columns: {
    id: "backlog" | "todo" | "in_progress" | "done"
    title: string
    accentColor: string
  }[] = [
    { id: "backlog", title: "Backlog", accentColor: "bg-slate-400 dark:bg-slate-500" },
    { id: "todo", title: "To Do", accentColor: "bg-blue-500" },
    { id: "in_progress", title: "In Progress", accentColor: "bg-amber-500" },
    { id: "done", title: "Done", accentColor: "bg-emerald-500" },
  ]

  return (
    <div className="flex flex-col h-full flex-1 overflow-hidden p-3 sm:p-4">
      {/* Board Control / Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3.5 border-b border-border/60">
        {/* Quick Filter Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-medium text-muted-foreground mr-1 flex items-center gap-1">
            <Filter className="h-3 w-3" /> Filters:
          </span>

          <Button
            variant={activeFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter("all")}
          >
            All Tasks ({tasks.length})
          </Button>

          <Button
            variant={activeFilter === "my" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter("my")}
            className="gap-1.5"
          >
            <Avatar fallback="AM" size="xs" />
            <span>My Tasks</span>
          </Button>

          <Button
            variant={activeFilter === "urgent" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter("urgent")}
            className="gap-1 text-amber-600 dark:text-amber-400"
          >
            <Sparkles className="h-3 w-3" />
            <span>High & Urgent</span>
          </Button>

          <Button
            variant={activeFilter === "blocked" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter("blocked")}
            className="gap-1 text-rose-600 dark:text-rose-400"
          >
            <AlertCircle className="h-3 w-3" />
            <span>Blocked ({tasks.filter((t) => t.is_blocked).length})</span>
          </Button>
        </div>

        {/* Assignee Filter Dropdown */}
        <div className="flex items-center gap-2">
          {assignees.length > 0 && (
            <select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              className="rounded-md border border-border bg-background px-2.5 py-1 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Assignees</option>
              {assignees.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}

          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            Showing <strong className="text-foreground">{filteredTasks.length}</strong> tasks
          </span>
        </div>
      </div>

      {/* 4-Column Drag & Drop Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex flex-1 gap-3 sm:gap-4 overflow-x-auto pt-3.5 pb-2">
          {columns.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.id)
            return (
              <KanbanColumn
                key={col.id}
                id={col.id}
                title={col.title}
                tasks={colTasks}
                accentColor={col.accentColor}
                onTaskClick={onTaskClick}
                onQuickAdd={onQuickAdd}
              />
            )
          })}
        </div>
      </DragDropContext>
    </div>
  )
}
