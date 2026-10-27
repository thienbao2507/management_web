import React, { useState, useEffect } from "react"
import {
  Drawer,
  DrawerContent,
} from "@/components/ui/Drawer"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { DialogTitle, DialogDescription } from "@/components/ui/Dialog"
import { TaskAssigneeAvatar, TaskAssigneeName } from "@/components/identity/TaskIdentity"
import { cn, getTodayDateString } from "@/lib/utils"
import { type ApiTask, type ApiMember, type ApiSubtask, api } from "@/services/api"
import {
  Calendar,
  CheckSquare,
  AlertCircle,
  Tag,
  User as UserIcon,
  Trash2,
  Plus,
  Check,
  X,
} from "lucide-react"

interface TaskDetailDrawerProps {
  task: ApiTask | null
  open: boolean
  onClose: () => void
  onTaskUpdated: (updated: ApiTask) => void
  onTaskDeleted: (taskId: string) => void
  members: ApiMember[]
  membersError: string | null
}

export const TaskDetailDrawer: React.FC<TaskDetailDrawerProps> = ({
  task,
  open,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
  members, membersError,
}) => {
  const [title, setTitle] = useState(task?.title || "")
  const [description, setDescription] = useState(task?.description || "")
  const [status, setStatus] = useState<"backlog" | "todo" | "in_progress" | "done">(task?.status || "todo")
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">(task?.priority || "medium")
  const [dueDate, setDueDate] = useState(task?.due_date || getTodayDateString())
  const [isBlocked, setIsBlocked] = useState(task?.is_blocked || false)
  const [blockerReason, setBlockerReason] = useState(task?.blocker_reason || "")
  const [subtasks, setSubtasks] = useState<ApiSubtask[]>(task?.subtasks || [])
  const [assigneeChoice, setAssigneeChoice] = useState("keep")
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("")

  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null)

  useEffect(() => {
    if (!task) return
    setTitle(task.title)
    setDescription(task.description || "")
    setStatus(task.status)
    setPriority(task.priority)
    setDueDate(task.due_date || getTodayDateString())
    setIsBlocked(task.is_blocked)
    setBlockerReason(task.blocker_reason || "")
    setSubtasks(task.subtasks || [])
    setConfirmDelete(false)
    setNotification(null)
    setAssigneeChoice("keep")
  }, [task])

  if (!task) return null

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 3000)
  }

  // Handle Save
  const handleSave = async () => {
    setIsSaving(true)
    try {
      const updated = await api.updateTask(task.id, {
        ...(assigneeChoice !== "keep" ? { assignee_id: assigneeChoice || null } : {}),
        title,
        description,
        status,
        priority,
        due_date: dueDate || undefined,
        is_blocked: isBlocked,
        blocker_reason: isBlocked ? blockerReason : "",
      })
      onTaskUpdated({ ...updated, subtasks })
      showNotification("success", "Saved to Neon PostgreSQL!")
    } catch (err: any) {
      showNotification("error", err.message || "Failed to update task")
    } finally {
      setIsSaving(false)
    }
  }

  // Handle Delete
  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await api.deleteTask(task.id)
      onTaskDeleted(task.id)
      onClose()
    } catch (err: any) {
      showNotification("error", err.message || "Failed to delete task")
      setIsDeleting(false)
    }
  }

  // Toggle Subtask
  const handleToggleSubtask = async (st: ApiSubtask) => {
    const newStatus = !st.is_completed
    // Optimistic
    setSubtasks((prev) =>
      prev.map((item) => (item.id === st.id ? { ...item, is_completed: newStatus } : item))
    )
    try {
      const updatedSt = await api.toggleSubtask(task.id, st.id, newStatus)
      setSubtasks((prev) =>
        prev.map((item) => (item.id === st.id ? updatedSt : item))
      )
    } catch {
      // Rollback
      setSubtasks((prev) =>
        prev.map((item) => (item.id === st.id ? { ...item, is_completed: !newStatus } : item))
      )
      showNotification("error", "Failed to update checklist item")
    }
  }

  // Add Subtask
  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSubtaskTitle.trim()) return

    try {
      const created = await api.addSubtask(task.id, newSubtaskTitle.trim())
      setSubtasks((prev) => [...prev, created])
      setNewSubtaskTitle("")
    } catch (err: any) {
      showNotification("error", err.message || "Failed to add subtask")
    }
  }

  // Delete Subtask
  const handleDeleteSubtask = async (subtaskId: string) => {
    try {
      await api.deleteSubtask(task.id, subtaskId)
      setSubtasks((prev) => prev.filter((st) => st.id !== subtaskId))
    } catch {
      showNotification("error", "Failed to delete subtask")
    }
  }

  const completedCount = subtasks.filter((s) => s.is_completed).length

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent className="overflow-y-auto">
        <DialogTitle className="sr-only">Task details</DialogTitle>
        <DialogDescription className="sr-only">Edit task fields, project assignment and checklist.</DialogDescription>
        {/* Header with Task Key & Priority */}
        <div className="flex items-center justify-between border-b border-border/80 pb-3 pr-8">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-primary">
              {task.task_key}
            </span>
            <span className="text-muted-foreground">•</span>
            <Badge variant={priority} className="uppercase font-bold text-[10px]">
              {priority}
            </Badge>
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">
            {task.category}
          </span>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div
            className={cn(
              "mt-3 flex items-center gap-2 rounded-md p-2.5 text-xs font-medium animate-in fade-in",
              notification.type === "success"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300"
                : "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-300"
            )}
          >
            {notification.type === "success" ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Blocker Alert Banner / Toggle */}
        <div className="mt-3 rounded-lg border border-border/80 bg-surface/40 p-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={isBlocked}
                onChange={(e) => setIsBlocked(e.target.checked)}
                className="h-3.5 w-3.5 rounded text-rose-600 focus:ring-rose-500"
              />
              <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-3.5 w-3.5" /> Mark as Blocked
              </span>
            </label>
          </div>
          {isBlocked && (
            <input
              type="text"
              value={blockerReason}
              onChange={(e) => setBlockerReason(e.target.value)}
              placeholder="Reason for blocker (e.g. Awaiting API credentials)..."
              className="mt-2 w-full rounded border border-rose-300/80 bg-background px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          )}
        </div>

        {/* Task Title Edit */}
        <div className="mt-4">
          <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-md border border-border/70 bg-background px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Attributes Grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-border/60 bg-surface/40 p-3 text-xs">
          {/* Status selector */}
          <div>
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground mb-1">
              <Tag className="h-3.5 w-3.5" /> Status
            </span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs font-medium capitalize focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="backlog">Backlog</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>

          {/* Priority selector */}
          <div>
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground mb-1">
              <AlertCircle className="h-3.5 w-3.5" /> Priority
            </span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs font-medium capitalize focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Assignee */}
          <div>
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground mb-1">
              <UserIcon className="h-3.5 w-3.5" /> Assignee
            </span>
            <div className="flex items-center gap-2">
              <TaskAssigneeAvatar
                task={task}
                size="sm"
              />
              <span className="text-xs font-medium text-foreground truncate">
                <TaskAssigneeName task={task} />
              </span>
            </div>
            <select aria-label="Reassign task" value={assigneeChoice} onChange={(event) => setAssigneeChoice(event.target.value)} disabled={Boolean(membersError) || isSaving} className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs">
              <option value="keep">Keep current assignment</option>
              <option value="">Unassigned</option>
              {members.filter((member) => member.user.is_active).map(({ user }) => <option key={user.id} value={user.id}>{user.display_name}</option>)}
            </select>
            {membersError && <p role="alert" className="mt-1 text-[10px] text-red-600 dark:text-red-400">{membersError}</p>}
          </div>

          {/* Due Date */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" /> Due Date
              </span>
              <button
                type="button"
                onClick={() => setDueDate(getTodayDateString())}
                className="text-[10px] text-primary hover:underline font-normal cursor-pointer"
              >
                Today
              </button>
            </div>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        {/* Description */}
        <div className="mt-4">
          <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
            Description
          </label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-md border border-border/70 bg-background p-3 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Checklist / Subtasks */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
              <CheckSquare className="h-3.5 w-3.5" />
              Checklist ({completedCount}/{subtasks.length})
            </label>
            <span className="text-[11px] text-muted-foreground">
              {subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0}% completed
            </span>
          </div>

          <div className="space-y-1 rounded-lg border border-border/60 bg-surface/30 p-2.5">
            {subtasks.map((st) => (
              <div
                key={st.id}
                className="group flex items-center justify-between rounded p-1 hover:bg-card text-xs transition-colors"
              >
                <label className="flex items-center gap-2 flex-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={st.is_completed}
                    onChange={() => handleToggleSubtask(st)}
                    className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className={cn(st.is_completed && "line-through text-muted-foreground")}>
                    {st.title}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => handleDeleteSubtask(st.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-500 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            {/* Add new subtask inline */}
            <form onSubmit={handleAddSubtask} className="flex items-center gap-2 pt-2 border-t border-border/40 mt-1">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                placeholder="Add checklist item..."
                className="flex-1 rounded border border-border/60 bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button type="submit" size="sm" variant="outline" className="h-7 px-2">
                <Plus className="h-3 w-3" />
              </Button>
            </form>
          </div>
        </div>

        {/* Footer Actions & Delete Confirmation */}
        <div className="mt-8 flex flex-col gap-3 border-t border-border/80 pt-4">
          {confirmDelete ? (
            <div className="flex flex-col gap-2 rounded-lg border border-red-300 bg-red-50/60 p-3 text-xs dark:bg-red-950/30">
              <span className="font-semibold text-red-700 dark:text-red-300">
                Are you sure you want to permanently delete this task?
              </span>
              <div className="flex items-center gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting ? "Deleting..." : "Confirm Delete"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Task</span>
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>
                  Close
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save to Neon"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
