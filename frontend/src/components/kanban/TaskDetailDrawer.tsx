import React, { useState, useEffect, useRef } from "react"
import {
  Drawer,
  DrawerContent,
} from "@/components/ui/Drawer"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { DialogTitle, DialogDescription } from "@/components/ui/Dialog"
import { TaskAssigneeAvatar, useTaskIdentity } from "@/components/identity/TaskIdentity"
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
  Type,
  AlignLeft,
} from "lucide-react"

const fieldClass =
  "w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground hover:border-muted-foreground/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-60"

const labelClass =
  "flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"

const PRIORITY_LABELS: Record<string, string> = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
  urgent: "Khẩn cấp",
}

const AssigneeKeepOption: React.FC<{ task: ApiTask }> = ({ task }) => {
  const { name } = useTaskIdentity(task)
  return <option value="keep">Hiện tại: {name}</option>
}

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

  const descriptionRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = descriptionRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.5)}px`
  }, [description, open])

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
      showNotification("success", "Đã lưu!")
    } catch (err: any) {
      showNotification("error", err.message || "Không cập nhật được công việc")
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
      showNotification("error", err.message || "Không xoá được công việc")
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
      showNotification("error", "Không cập nhật được mục trong danh sách việc")
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
      showNotification("error", err.message || "Không thêm được mục việc")
    }
  }

  // Delete Subtask
  const handleDeleteSubtask = async (subtaskId: string) => {
    try {
      await api.deleteSubtask(task.id, subtaskId)
      setSubtasks((prev) => prev.filter((st) => st.id !== subtaskId))
    } catch {
      showNotification("error", "Không xoá được mục việc")
    }
  }

  const completedCount = subtasks.filter((s) => s.is_completed).length

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent className="overflow-y-auto">
        <DialogTitle className="sr-only">Chi tiết công việc</DialogTitle>
        <DialogDescription className="sr-only">Sửa thông tin công việc, người phụ trách và danh sách việc.</DialogDescription>
        {/* Header with Task Key & Priority */}
        <div className="flex items-center justify-between border-b border-border/80 pb-3 pr-8">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-primary">
              {task.task_key}
            </span>
            <span className="text-muted-foreground">•</span>
            <Badge variant={priority} className="uppercase font-bold text-[10px]">
              {PRIORITY_LABELS[priority]}
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
        <div className="mt-4 rounded-lg border border-border/80 bg-surface/40 p-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={isBlocked}
                onChange={(e) => setIsBlocked(e.target.checked)}
                className="h-3.5 w-3.5 rounded text-rose-600 focus:ring-rose-500"
              />
              <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-3.5 w-3.5" /> Đánh dấu bị chặn
              </span>
            </label>
          </div>
          {isBlocked && (
            <input
              type="text"
              value={blockerReason}
              onChange={(e) => setBlockerReason(e.target.value)}
              placeholder="Lý do bị chặn (VD: Đang chờ thông tin truy cập API)..."
              className={cn(fieldClass, "mt-2 border-rose-300/80 focus:border-rose-500 focus:ring-rose-500/30")}
            />
          )}
        </div>

        {/* Task Title Edit */}
        <div className="mt-6">
          <label className={cn(labelClass, "mb-1.5")}>
            <Type className="h-3.5 w-3.5" />
            Tiêu đề
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={cn(fieldClass, "font-semibold text-base")}
          />
        </div>

        {/* Attributes Grid */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 rounded-lg border border-border/60 bg-surface/40 p-4 text-xs">
          {/* Status selector */}
          <div>
            <label className={cn(labelClass, "mb-1.5")}>
              <Tag className="h-3.5 w-3.5" /> Trạng thái
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className={cn(fieldClass, "capitalize")}
            >
              <option value="backlog">Backlog</option>
              <option value="todo">Cần làm</option>
              <option value="in_progress">Đang làm</option>
              <option value="done">Hoàn thành</option>
            </select>
          </div>

          {/* Priority selector */}
          <div>
            <label className={cn(labelClass, "mb-1.5")}>
              <AlertCircle className="h-3.5 w-3.5" /> Độ ưu tiên
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className={cn(fieldClass, "capitalize")}
            >
              <option value="low">Thấp</option>
              <option value="medium">Trung bình</option>
              <option value="high">Cao</option>
              <option value="urgent">Khẩn cấp</option>
            </select>
          </div>

          {/* Assignee */}
          <div>
            <label className={cn(labelClass, "mb-1.5")}>
              <UserIcon className="h-3.5 w-3.5" /> Người phụ trách
            </label>
            <div className="flex items-center gap-2">
              <TaskAssigneeAvatar
                task={task}
                size="sm"
                className="shrink-0"
              />
              <select
                aria-label="Giao lại công việc"
                value={assigneeChoice}
                onChange={(event) => setAssigneeChoice(event.target.value)}
                disabled={Boolean(membersError) || isSaving}
                className={cn(fieldClass, "flex-1 min-w-0")}
              >
                <AssigneeKeepOption task={task} />
                <option value="">Chưa giao</option>
                {members
                  .filter((member) => member.user.is_active)
                  .map(({ user }) => (
                    <option key={user.id} value={user.id}>
                      {user.display_name}
                    </option>
                  ))}
              </select>
            </div>
            {membersError && (
              <p role="alert" className="mt-1 text-[10px] text-red-600 dark:text-red-400">
                {membersError}
              </p>
            )}
          </div>

          {/* Due Date */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelClass}>
                <Calendar className="h-3.5 w-3.5" /> Hạn chót
              </label>
              <button
                type="button"
                onClick={() => setDueDate(getTodayDateString())}
                className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
              >
                Hôm nay
              </button>
            </div>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={cn(fieldClass, "h-9")}
            />
          </div>
        </div>

        {/* Description */}
        <div className="mt-6">
          <label className={cn(labelClass, "mb-1.5")}>
            <AlignLeft className="h-3.5 w-3.5" />
            Mô tả
          </label>
          <textarea
            ref={descriptionRef}
            rows={8}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={cn(fieldClass, "p-3 leading-relaxed min-h-[160px] max-h-[50vh] resize-y")}
          />
        </div>

        {/* Checklist / Subtasks */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <label className={labelClass}>
              <CheckSquare className="h-3.5 w-3.5" />
              Danh sách việc ({completedCount}/{subtasks.length})
            </label>
            <span className="text-[11px] text-muted-foreground">
              {subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0}% hoàn thành
            </span>
          </div>

          <div className="space-y-1 rounded-lg border border-border/60 bg-surface/30 p-3">
            {subtasks.length === 0 ? (
              <p className="text-xs text-muted-foreground italic px-1 py-1">
                Chưa có mục việc nào.
              </p>
            ) : (
              subtasks.map((st) => (
                <div
                  key={st.id}
                  className="group flex items-center justify-between rounded py-1.5 px-2 hover:bg-muted/60 text-sm transition-colors"
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
              ))
            )}

            {/* Add new subtask inline */}
            <form
              onSubmit={handleAddSubtask}
              className={cn(
                "flex items-center gap-2",
                subtasks.length > 0 && "border-t border-border/60 pt-2 mt-1"
              )}
            >
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                placeholder="Thêm mục việc..."
                className={cn(fieldClass, "flex-1")}
              />
              <Button type="submit" size="sm" variant="outline" className="h-9 w-9 p-0 shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>

        {/* Footer Actions & Delete Confirmation */}
        <div className="mt-8 flex flex-col gap-3 border-t border-border/80 pt-4">
          {confirmDelete ? (
            <div className="flex flex-col gap-2 rounded-lg border border-red-300 bg-red-50/60 p-3 text-xs dark:bg-red-950/30">
              <span className="font-semibold text-red-700 dark:text-red-300">
                Bạn có chắc muốn xoá vĩnh viễn công việc này?
              </span>
              <div className="flex items-center gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
                  Huỷ
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting ? "Đang xoá..." : "Xác nhận xoá"}
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
                <span>Xoá công việc</span>
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>
                  Đóng
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Đang lưu..." : "Lưu"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
