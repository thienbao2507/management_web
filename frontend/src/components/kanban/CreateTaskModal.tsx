import React, { useState } from "react"
import { Calendar } from "lucide-react"
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
import { getTodayDateString } from "@/lib/utils"
import { type ApiTask, type ApiMember, api } from "@/services/api"

interface CreateTaskModalProps {
  open: boolean
  onClose: () => void
  projectId: string
  sprintId?: string | null
  members: ApiMember[]
  membersError: string | null
  membersLoading: boolean
  defaultStatus?: "backlog" | "todo" | "in_progress" | "done"
  onTaskCreated: (newTask: ApiTask) => void
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  open,
  onClose,
  projectId,
  sprintId, members, membersError, membersLoading,
  defaultStatus = "todo",
  onTaskCreated,
}) => {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("Feature")
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium")
  const [status, setStatus] = useState<"backlog" | "todo" | "in_progress" | "done">(defaultStatus)
  const [assigneeKey, setAssigneeKey] = useState<string>("")
  const [dueDate, setDueDate] = useState(getTodayDateString())
  const [subtasksRaw, setSubtasksRaw] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  React.useEffect(() => {
    setStatus(defaultStatus)
    setDueDate(getTodayDateString())
    setErrorMessage(null)
  }, [defaultStatus, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setErrorMessage("Vui lòng nhập tiêu đề")
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    const subtaskTitles = subtasksRaw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)

    try {
      const created = await api.createTask({
        project_id: projectId,
        sprint_id: sprintId || null,
        title: title.trim(),
        description: description.trim() || undefined,
        category: category.trim() || "Feature",
        status,
        priority,
        due_date: dueDate || undefined,
        assignee_id: assigneeKey || null,
        subtask_titles: subtaskTitles,
      })

      onTaskCreated(created)
      setTitle("")
      setDescription("")
      setDueDate(getTodayDateString())
      setSubtasksRaw("")
      onClose()
    } catch (err: any) {
      setErrorMessage(err.message || "Không tạo được công việc")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Tạo công việc mới</DialogTitle>
          <DialogDescription>
            Thêm công việc mới vào dự án. Mã công việc (VD: CMD-1) được tạo tự động.
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
              Tiêu đề công việc <span className="text-red-500">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Thiết kế trang đăng nhập"
              className="mt-1"
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-foreground">
              Mô tả
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả tiêu chí nghiệm thu hoặc chi tiết..."
              className="mt-1 flex w-full rounded-md border border-border bg-background p-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Grid row: Status & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground">
                Cột / Trạng thái
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="mt-1 flex h-8 w-full rounded-md border border-border bg-background px-2.5 text-xs capitalize shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="backlog">Backlog</option>
                <option value="todo">Cần làm</option>
                <option value="in_progress">Đang làm</option>
                <option value="done">Hoàn thành</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">
                Độ ưu tiên
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="mt-1 flex h-8 w-full rounded-md border border-border bg-background px-2.5 text-xs capitalize shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="low">Thấp</option>
                <option value="medium">Trung bình</option>
                <option value="high">Cao</option>
                <option value="urgent">Khẩn cấp</option>
              </select>
            </div>
          </div>

          {/* Grid row: Assignee & Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground">
                Người phụ trách
              </label>
              <select
                aria-label="Người phụ trách"
                value={assigneeKey}
                onChange={(e) => setAssigneeKey(e.target.value)}
                disabled={membersLoading || Boolean(membersError) || isLoading}
                className="mt-1 flex h-8 w-full rounded-md border border-border bg-background px-2.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Chưa giao</option>
                {members.filter((member) => member.user.is_active).map(({ user }) => (
                  <option key={user.id} value={user.id}>
                    {user.display_name}
                  </option>
                ))}
              </select>
              {membersError ? <p role="alert" className="mt-1 text-[10px] text-red-600 dark:text-red-400">{membersError}</p> : !membersLoading && members.length === 0 ? <p className="mt-1 text-[10px] text-muted-foreground">Dự án chưa có thành viên. Công việc mới có thể để chưa giao.</p> : null}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  Hạn chót
                </label>
                <button
                  type="button"
                  onClick={() => setDueDate(getTodayDateString())}
                  className="text-[10px] text-primary hover:underline font-normal cursor-pointer"
                >
                  Hôm nay
                </button>
              </div>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Subtasks Checklist (one per line) */}
          <div>
            <label className="text-xs font-semibold text-foreground">
              Danh sách việc (mỗi dòng một việc, không bắt buộc)
            </label>
            <textarea
              rows={2}
              value={subtasksRaw}
              onChange={(e) => setSubtasksRaw(e.target.value)}
              placeholder="Việc 1&#10;Việc 2"
              className="mt-1 flex w-full rounded-md border border-border bg-background p-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
              Huỷ
            </Button>
            <Button type="submit" size="sm" disabled={isLoading}>
              {isLoading ? "Đang lưu..." : "Tạo công việc"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
