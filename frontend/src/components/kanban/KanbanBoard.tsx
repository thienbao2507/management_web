import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { normalizeSearch } from "@/lib/utils"
import { DragDropContext, type DropResult } from "@hello-pangea/dnd"
import { type ApiTask } from "@/services/api"
import { KanbanColumn } from "./KanbanColumn"
import { Button } from "@/components/ui/Button"
import { UserAvatar } from "@/components/ui/UserAvatar"
import { useUsers } from "@/context/UserContext"
import { Filter, AlertCircle, Sparkles, ZoomOut, ZoomIn, Maximize2 } from "lucide-react"

const BOARD_ZOOM_KEY = "management_web_board_zoom"
const MIN_ZOOM = 0.5
const MAX_ZOOM = 1.5
const ZOOM_STEP = 0.1

const clampZoom = (value: number, max = MAX_ZOOM) =>
  Math.min(max, Math.max(MIN_ZOOM, Math.round(value * 100) / 100))

const readStoredZoom = () => {
  try {
    const stored = window.localStorage.getItem(BOARD_ZOOM_KEY)
    if (stored === null) return 1
    const parsed = Number(stored)
    return Number.isFinite(parsed) && parsed >= MIN_ZOOM && parsed <= MAX_ZOOM ? parsed : 1
  } catch {
    return 1
  }
}

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
  const { currentUser, usersById } = useUsers()
  // Active Filter state
  const [activeFilter, setActiveFilter] = useState<"all" | "my" | "urgent" | "blocked">("all")
  const [selectedAssignee, setSelectedAssignee] = useState<string>("all")
  const [zoom, setZoom] = useState(readStoredZoom)
  const [isPanning, setIsPanning] = useState(false)
  const viewportRef = useRef<HTMLDivElement>(null)
  const zoomWrapperRef = useRef<HTMLDivElement>(null)
  const panOriginRef = useRef({ pointerId: -1, x: 0, y: 0, left: 0, top: 0 })

  useEffect(() => {
    try {
      window.localStorage.setItem(BOARD_ZOOM_KEY, String(zoom))
    } catch {
      // Storage can be unavailable in restricted or private browser contexts.
    }
  }, [zoom])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const direction = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP
      setZoom((current) => clampZoom(current + direction))
    }

    viewport.addEventListener("wheel", handleWheel, { passive: false })
    return () => viewport.removeEventListener("wheel", handleWheel)
  }, [])

  const changeZoom = (delta: number) => {
    setZoom((current) => clampZoom(current + delta))
  }

  const fitBoard = () => {
    const viewport = viewportRef.current
    const wrapper = zoomWrapperRef.current
    if (!viewport || !wrapper) return

    const previousZoom = wrapper.style.zoom
    wrapper.style.zoom = "1"
    const contentWidth = wrapper.scrollWidth
    wrapper.style.zoom = previousZoom

    const availableWidth = viewport.clientWidth
    const ratio = contentWidth > 0 ? availableWidth / contentWidth : 1
    const fittedZoom = ratio >= 1 ? 1 : Math.floor(ratio * 20) / 20
    setZoom(clampZoom(fittedZoom, 1))
    requestAnimationFrame(() => viewport.scrollTo({ left: 0 }))
  }

  const handlePanStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const target = event.target as Element
    if (target.closest("[data-rbd-draggable-id], [data-rfd-draggable-id], button, a, input, select, textarea, [role=button]")) return

    const viewport = viewportRef.current
    if (!viewport) return
    panOriginRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: viewport.scrollLeft,
      top: viewport.scrollTop,
    }
    viewport.setPointerCapture(event.pointerId)
    setIsPanning(true)
    event.preventDefault()
  }

  const handlePanMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current
    const origin = panOriginRef.current
    if (!isPanning || !viewport || origin.pointerId !== event.pointerId) return
    viewport.scrollLeft = origin.left - (event.clientX - origin.x)
    viewport.scrollTop = origin.top - (event.clientY - origin.y)
  }

  const handlePanEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current
    if (!viewport || panOriginRef.current.pointerId !== event.pointerId) return
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId)
    panOriginRef.current.pointerId = -1
    setIsPanning(false)
  }

  // Extract unique assignees from tasks
  const assignees = Array.from(
    new Set(tasks.map((t) => t.assignee_id ? `user:${t.assignee_id}` : t.assignee_name ? `legacy:${t.assignee_name}` : null).filter(Boolean))
  ) as string[]

  // Search runs at lower priority so typing stays responsive; matching ignores Vietnamese accents.
  const deferredQuery = useDeferredValue(searchQuery)
  const q = normalizeSearch(deferredQuery)
  const searchIndex = useMemo(() => new Map(tasks.map((task) => [task.id, normalizeSearch([
    task.title,
    task.task_key,
    task.category,
    task.assignee_id ? usersById[task.assignee_id]?.display_name : task.assignee_name,
  ].join("\n"))])), [tasks, usersById])

  // Filter tasks based on search, active quick filter and assignee
  const filteredTasks = tasks.filter((task) => {
    if (q && !searchIndex.get(task.id)?.includes(q)) return false

    // Assignee filter
    if (selectedAssignee !== "all" && (task.assignee_id ? `user:${task.assignee_id}` : `legacy:${task.assignee_name}`) !== selectedAssignee) {
      return false
    }

    // Quick filters
    if (activeFilter === "my") {
      return Boolean(currentUser && task.assignee_id === currentUser.id)
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
    { id: "backlog", title: "Backlog", accentColor: "bg-slate-400 dark:bg-neutral-500" },
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
            disabled={!currentUser}
            title={!currentUser ? "Sign in first" : "Tasks assigned to your account"}
            className="gap-1.5"
          >
            <UserAvatar user={currentUser} size="xs" />
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

        {/* Assignee Filter, Board Zoom and Result Count */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {assignees.length > 0 && (
            <select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              className="rounded-md border border-border bg-background px-2.5 py-1 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Assignees</option>
              {assignees.map((name) => (
                <option key={name} value={name}>
                  {name.startsWith("user:") ? usersById[name.slice(5)]?.display_name || "User unavailable" : `${name.slice(7)} (legacy)`}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1" role="group" aria-label="Board zoom controls">
            <Button
              variant="outline"
              size="sm"
              onClick={() => changeZoom(-ZOOM_STEP)}
              disabled={zoom <= MIN_ZOOM}
              aria-label="Zoom out"
              className="px-2"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom(1)}
              aria-label="Reset zoom"
              className="min-w-[54px] px-2 tabular-nums"
            >
              {Math.round(zoom * 100)}%
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => changeZoom(ZOOM_STEP)}
              disabled={zoom >= MAX_ZOOM}
              aria-label="Zoom in"
              className="px-2"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fitBoard}
              aria-label="Fit board"
              className="gap-1 px-2"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span>Fit</span>
            </Button>
          </div>

          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            Showing <strong className="text-foreground">{filteredTasks.length}</strong> tasks
          </span>
        </div>
      </div>

      {/* 4-Column Drag & Drop Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div
          ref={viewportRef}
          data-board-viewport
          className={`flex-1 overflow-auto pt-3.5 pb-2 ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
          onPointerDown={handlePanStart}
          onPointerMove={handlePanMove}
          onPointerUp={handlePanEnd}
          onPointerCancel={handlePanEnd}
        >
          <div
            ref={zoomWrapperRef}
            data-board-zoom-wrapper
            className="flex min-w-max gap-3 sm:gap-4"
            style={{ zoom, height: `calc(100% / ${zoom})` }}
          >
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
        </div>
      </DragDropContext>
    </div>
  )
}
