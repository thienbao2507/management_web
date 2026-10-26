import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/Dialog"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { type ApiTask, api } from "@/services/api"
import { USERS } from "@/data/mockData"

interface CreateTaskModalProps {
  open: boolean
  onClose: () => void
  projectId: string
  defaultStatus?: "backlog" | "todo" | "in_progress" | "done"
  onTaskCreated: (newTask: ApiTask) => void
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  open,
  onClose,
  projectId,
  defaultStatus = "todo",
  onTaskCreated,
}) => {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("Feature")
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium")
  const [status, setStatus] = useState<"backlog" | "todo" | "in_progress" | "done">(defaultStatus)
  const [assigneeKey, setAssigneeKey] = useState<string>("alex")
  const [dueDate, setDueDate] = useState("2026-11-10")
  const [subtasksRaw, setSubtasksRaw] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  React.useEffect(() => {
    setStatus(defaultStatus)
    setErrorMessage(null)
  }, [defaultStatus, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setErrorMessage("Title is required")
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    const selectedUser = USERS[assigneeKey] || USERS.alex
    const subtaskTitles = subtasksRaw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)

    try {
      const created = await api.createTask({
        project_id: projectId,
        title: title.trim(),
        description: description.trim() || undefined,
        category: category.trim() || "Feature",
        status,
        priority,
        due_date: dueDate || undefined,
        assignee_name: selectedUser.name,
        assignee_avatar: selectedUser.avatar,
        assignee_initials: selectedUser.initials,
        subtask_titles: subtaskTitles,
      })

      onTaskCreated(created)
      setTitle("")
      setDescription("")
      setSubtasksRaw("")
      onClose()
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create task on Neon")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Add a new task directly to Neon PostgreSQL. Task keys (e.g. CMD-1) are auto-generated.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="rounded-md border border-red-300 bg-red-50 p-2 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 py-1">
          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-foreground">
              Task Title <span className="text-red-500">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Implement Neon PostgreSQL data layer"
              className="mt-1"
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-foreground">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe acceptance criteria or details..."
              className="mt-1 flex w-full rounded-md border border-border bg-background p-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Grid row: Status & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground">
                Column / Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="mt-1 flex h-8 w-full rounded-md border border-border bg-background px-2.5 text-xs capitalize shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="backlog">Backlog</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="mt-1 flex h-8 w-full rounded-md border border-border bg-background px-2.5 text-xs capitalize shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* Grid row: Assignee & Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground">
                Assignee
              </label>
              <select
                value={assigneeKey}
                onChange={(e) => setAssigneeKey(e.target.value)}
                className="mt-1 flex h-8 w-full rounded-md border border-border bg-background px-2.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {Object.entries(USERS).map(([key, user]) => (
                  <option key={key} value={key}>
                    {user.name} ({user.role.split(" ")[0]})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">
                Due Date
              </label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Subtasks Checklist (one per line) */}
          <div>
            <label className="text-xs font-semibold text-foreground">
              Checklist Items (one per line, optional)
            </label>
            <textarea
              rows={2}
              value={subtasksRaw}
              onChange={(e) => setSubtasksRaw(e.target.value)}
              placeholder="Requirement 1&#10;Requirement 2"
              className="mt-1 flex w-full rounded-md border border-border bg-background p-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isLoading}>
              {isLoading ? "Saving..." : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
