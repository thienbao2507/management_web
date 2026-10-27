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
import { type ApiProject, type ApiWorkspace, api } from "@/services/api"

interface CreateProjectModalProps {
  open: boolean
  workspace: ApiWorkspace
  onClose: () => void
  onProjectCreated: (newProj: ApiProject) => void
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  open,
  workspace,
  onClose,
  onProjectCreated,
}) => {
  const [name, setName] = useState("")
  const [key, setKey] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState("high")
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const created = await api.createProject({
        name: name.trim(),
        key: key.trim().toUpperCase() || undefined,
        description: description.trim() || undefined,
        priority,
        workspace_id: workspace.id,
      })

      onProjectCreated(created)
      setName("")
      setKey("")
      setDescription("")
      onClose()
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create project on Neon")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Create a Project inside the selected Workspace. Existing Projects are not moved.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="rounded-md border border-red-300 bg-red-50 p-2 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 py-1">
          <div>
            <label className="text-xs font-semibold text-foreground">Workspace</label>
            <Input value={workspace.name} readOnly disabled className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground">
              Project Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (!key) {
                  // Suggest key
                  const suggested = e.target.value
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 4)
                    .toUpperCase()
                  setKey(suggested)
                }
              }}
              placeholder="e.g., Mobile App Redesign"
              className="mt-1"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground">
              Key Prefix (e.g. MOB, PRJ)
            </label>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              placeholder="Auto-generated if blank"
              maxLength={6}
              className="mt-1 font-mono uppercase"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Project goals and scope..."
              className="mt-1 flex w-full rounded-md border border-border bg-background p-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="mt-1 flex h-8 w-full rounded-md border border-border bg-background px-2.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
