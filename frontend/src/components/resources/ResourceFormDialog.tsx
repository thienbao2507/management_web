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
import { resourceTypeLabel, validateResourceUrl } from "./resourceUtils"


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
      return { items, error: "Mỗi từ khoá tối đa 50 ký tự." }
    }

    const seen = new Set(items.map((item) => item.toLocaleLowerCase()))
    const additions = candidates.filter((item) => {
      const key = item.toLocaleLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    if (items.length + additions.length > 20) {
      return { items, error: "Mỗi Resource có tối đa 20 từ khoá." }
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
      setFormError("Vui lòng chọn dự án cho Resource này.")
      return
    }
    if (!trimmedTitle) {
      setFormError("Vui lòng nhập tên Resource.")
      return
    }
    if (trimmedTitle.length > 255) {
      setFormError("Tên Resource không được vượt quá 255 ký tự.")
      return
    }
    const urlError = validateResourceUrl(url)
    if (urlError) {
      setFormError(urlError)
      return
    }
    if (description.trim().length > 2000) {
      setFormError("Mô tả không được vượt quá 2000 ký tự.")
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
      setFormError(error instanceof Error ? error.message : "Không thể lưu Resource.")
    } finally {
      submitInFlight.current = false
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && !pending && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{resource ? "Sửa Resource" : "Thêm Resource"}</DialogTitle>
          <DialogDescription>
            Lưu liên kết tới tài nguyên bên ngoài của dự án. Chỉ chấp nhận liên kết HTTP và HTTPS.
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
              <span>Dự án</span>
              <select
                aria-label="Dự án"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                className={selectClassName}
                disabled={pending || projects.length === 0}
                required
              >
                {projects.length === 0 && <option value="">Chưa có dự án đang hoạt động</option>}
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} ({project.key})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 text-xs font-medium">
              <span>Loại Resource</span>
              <select
                aria-label="Loại Resource"
                value={resourceType}
                onChange={(event) => setResourceType(event.target.value as ResourceType)}
                className={selectClassName}
                disabled={pending}
                required
              >
                {RESOURCE_TYPES.map((type) => (
                  <option key={type} value={type}>{resourceTypeLabel(type)}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block space-y-1.5 text-xs font-medium">
            <span>Tên Resource</span>
            <Input
              aria-label="Tên Resource"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="VD: Tài liệu API"
              maxLength={255}
              disabled={pending}
              required
              autoFocus
            />
          </label>

          <label className="block space-y-1.5 text-xs font-medium">
            <span>Đường dẫn Resource</span>
            <Input
              type="url"
              aria-label="Đường dẫn Resource"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/resource"
              maxLength={2048}
              disabled={pending}
              required
            />
            <span className="block text-[10px] font-normal text-muted-foreground">
              Không đưa mật khẩu, token truy cập hoặc thông tin đăng nhập vào đường dẫn.
            </span>
          </label>

          <label className="block space-y-1.5 text-xs font-medium">
            <span>Mô tả</span>
            <textarea
              aria-label="Mô tả"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Resource này dùng để làm gì..."
              maxLength={2000}
              rows={4}
              disabled={pending}
              className="flex w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>

          <div className="space-y-1.5">
            <label htmlFor={`${formId}-keywords`} className="text-xs font-medium">Từ khoá</label>
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
              placeholder="Nhập từ khoá, ngăn cách bằng dấu ; hoặc nhấn Enter"
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
                      aria-label={`Xoá từ khoá ${keyword}`}
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
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Huỷ</Button>
          <Button type="submit" form={formId} disabled={pending || projects.length === 0} className="gap-1.5">
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {pending ? "Đang lưu..." : resource ? "Lưu thay đổi" : "Thêm Resource"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
