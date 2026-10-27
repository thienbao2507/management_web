import React, { useEffect, useId, useRef, useState } from "react"
import { Loader2, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/Button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog"
import { Input } from "@/components/ui/Input"
import {
  RESOURCE_TYPES,
  type ApiProject,
  type ApiResource,
  type ResourcePayload,
  type ResourceType,
} from "@/services/api"
import { validateResourceUrl } from "./resourceUtils"


interface ResourceFormDialogProps {
  open: boolean
  resource: ApiResource | null
  projects: ApiProject[]
  suggestedProjectId?: string
  pending: boolean
  onClose: () => void
  onSubmit: (payload: ResourcePayload) => Promise<void>
}

const selectClassName =
  "flex h-8 w-full rounded-md border border-border bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"

export const ResourceFormDialog: React.FC<ResourceFormDialogProps> = ({
  open,
  resource,
  projects,
  suggestedProjectId,
  pending,
  onClose,
  onSubmit,
}) => {
  const formId = useId()
  const [projectId, setProjectId] = useState("")
  const [title, setTitle] = useState("")
  const [url, setUrl] = useState("")
  const [resourceType, setResourceType] = useState<ResourceType>("Website")
  const [description, setDescription] = useState("")
  const [keywords, setKeywords] = useState<string[]>([])
  const [keywordInput, setKeywordInput] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const submitInFlight = useRef(false)

  useEffect(() => {
    if (!open) return
    setProjectId(
      resource?.project_id ||
        (suggestedProjectId && projects.some((project) => project.id === suggestedProjectId)
          ? suggestedProjectId
          : projects[0]?.id || "")
    )
    setTitle(resource?.title || "")
    setUrl(resource?.url || "")
    setResourceType(resource?.resource_type || "Website")
    setDescription(resource?.description || "")
    setKeywords(resource?.keywords || [])
    setKeywordInput("")
    setFormError(null)
  }, [open, projects, resource, suggestedProjectId])

  const mergeKeywords = (items: string[], value: string) => {
    const candidates = value
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)

    if (candidates.length === 0) return { items, error: null }
    if (candidates.some((item) => item.length > 50)) {
      return { items, error: "Each keyword can contain at most 50 characters." }
    }

    const seen = new Set(items.map((item) => item.toLocaleLowerCase()))
    const additions = candidates.filter((item) => {
      const key = item.toLocaleLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    if (items.length + additions.length > 20) {
      return { items, error: "A resource can have at most 20 keywords." }
    }
    return {
      items: additions.length > 0 ? [...items, ...additions] : items,
      error: null,
    }
  }

  const commitKeyword = () => {
    const result = mergeKeywords(keywords, keywordInput)
    if (result.error) {
      setFormError(result.error)
      return
    }
    if (result.items !== keywords) setKeywords(result.items)
    setKeywordInput("")
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (pending || submitInFlight.current) return
    setFormError(null)

    const trimmedTitle = title.trim()
    if (!projectId) {
      setFormError("Select a project for this resource.")
      return
    }
    if (!trimmedTitle) {
      setFormError("Resource Name is required.")
      return
    }
    if (trimmedTitle.length > 255) {
      setFormError("Resource Name cannot exceed 255 characters.")
      return
    }
    const urlError = validateResourceUrl(url)
    if (urlError) {
      setFormError(urlError)
      return
    }
    if (description.trim().length > 2000) {
      setFormError("Description cannot exceed 2000 characters.")
      return
    }

    const keywordResult = mergeKeywords(keywords, keywordInput)
    if (keywordResult.error) {
      setFormError(keywordResult.error)
      return
    }
    const finalKeywords = keywordResult.items
    setKeywords(finalKeywords)
    setKeywordInput("")

    submitInFlight.current = true
    try {
      await onSubmit({
        project_id: projectId,
        title: trimmedTitle,
        url: url.trim(),
        resource_type: resourceType,
        description: description.trim() || null,
        keywords: finalKeywords,
      })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save resource.")
    } finally {
      submitInFlight.current = false
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && !pending && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{resource ? "Edit Resource" : "Add Resource"}</DialogTitle>
          <DialogDescription>
            Save a link to an external project resource. Only HTTP and HTTPS links are accepted.
          </DialogDescription>
        </DialogHeader>

        <form id={formId} onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              {formError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-medium">
              <span>Project</span>
              <select
                aria-label="Project"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                className={selectClassName}
                disabled={pending || projects.length === 0}
                required
              >
                {projects.length === 0 && <option value="">No active projects</option>}
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} ({project.key})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 text-xs font-medium">
              <span>Resource Type</span>
              <select
                aria-label="Resource Type"
                value={resourceType}
                onChange={(event) => setResourceType(event.target.value as ResourceType)}
                className={selectClassName}
                disabled={pending}
                required
              >
                {RESOURCE_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block space-y-1.5 text-xs font-medium">
            <span>Resource Name</span>
            <Input
              aria-label="Resource Name"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="API documentation"
              maxLength={255}
              disabled={pending}
              required
              autoFocus
            />
          </label>

          <label className="block space-y-1.5 text-xs font-medium">
            <span>Resource URL</span>
            <Input
              type="url"
              aria-label="Resource URL"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/resource"
              maxLength={2048}
              disabled={pending}
              required
            />
            <span className="block text-[10px] font-normal text-muted-foreground">
              Do not include passwords, access tokens, or embedded credentials.
            </span>
          </label>

          <label className="block space-y-1.5 text-xs font-medium">
            <span>Description</span>
            <textarea
              aria-label="Description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What this resource is used for..."
              maxLength={2000}
              rows={4}
              disabled={pending}
              className="flex w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>

          <div className="space-y-1.5">
            <label htmlFor={`${formId}-keywords`} className="text-xs font-medium">Keywords</label>
            <Input
              id={`${formId}-keywords`}
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  commitKeyword()
                }
              }}
              onBlur={commitKeyword}
              placeholder="Type keywords separated by ; or press Enter"
              disabled={pending || keywords.length >= 20}
            />
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {keywords.map((keyword) => (
                  <span key={keyword.toLocaleLowerCase()} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px]">
                    {keyword}
                    <button
                      type="button"
                      onClick={() => setKeywords((current) => current.filter((item) => item !== keyword))}
                      disabled={pending}
                      aria-label={`Remove keyword ${keyword}`}
                      className="rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" form={formId} disabled={pending || projects.length === 0} className="gap-1.5">
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {pending ? "Saving..." : resource ? "Save Changes" : "Add Resource"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
