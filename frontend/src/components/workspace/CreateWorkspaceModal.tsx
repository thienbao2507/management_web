import React, { useEffect, useRef, useState } from "react"
import { useUsers } from "@/context/UserContext"
import { useWorkspace } from "@/context/WorkspaceContext"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog"

interface CreateWorkspaceModalProps {
  open: boolean
  onClose: () => void
}

export function CreateWorkspaceModal({ open, onClose }: CreateWorkspaceModalProps) {
  const { currentUser } = useUsers()
  const { createWorkspace } = useWorkspace()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const saving = useRef(false)

  useEffect(() => {
    if (!open) {
      setName("")
      setDescription("")
      setError(null)
    }
  }, [open])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!currentUser || !name.trim() || saving.current) return
    saving.current = true
    setPending(true)
    setError(null)
    try {
      await createWorkspace({ name: name.trim(), description: description.trim() || null })
      onClose()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không tạo được Workspace")
    } finally {
      saving.current = false
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !pending && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Tạo Workspace</DialogTitle>
          <DialogDescription>Tạo một Workspace cá nhân thuộc tài khoản của bạn.</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
        <form className="space-y-3.5" onSubmit={submit}>
          <label className="block space-y-1 text-xs font-semibold">
            Tài khoản chủ sở hữu
            <Input value={currentUser?.display_name || "Chưa đăng nhập"} readOnly disabled />
          </label>
          <label className="block space-y-1 text-xs font-semibold">
            Tên Workspace <span className="text-red-500">*</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={255} required autoFocus disabled={pending || !currentUser} />
          </label>
          <label className="block space-y-1 text-xs font-semibold">
            Mô tả
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={3} disabled={pending} className="flex w-full rounded-md border border-border bg-background p-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Huỷ</Button>
            <Button type="submit" disabled={pending || !currentUser || !name.trim()}>{pending ? "Đang tạo..." : "Tạo Workspace"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
