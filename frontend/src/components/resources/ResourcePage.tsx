import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FolderKanban,
  LibraryBig,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card, CardContent } from "@/components/ui/Card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu"
import { EmptyState } from "@/components/ui/EmptyState"
import { SearchInput } from "@/components/ui/Input"
import {
  api,
  RESOURCE_TYPES,
  type ApiProject,
  type ApiResource,
  type ResourcePayload,
  type ResourceType,
} from "@/services/api"
import { ResourceDetailDrawer } from "./ResourceDetailDrawer"
import { ResourceFormDialog } from "./ResourceFormDialog"
import { formatResourceDate, RESOURCE_TYPE_STYLES } from "./resourceUtils"


interface ResourcePageProps {
  workspaceId?: string
  unassigned: boolean
  scopeKey: string
  projects: ApiProject[]
  selectedProject: ApiProject | null
  searchQuery: string
  onSearchChange: (query: string) => void
  addRequestId: number
}

interface ToastState {
  id: number
  message: string
  tone: "success" | "error"
}

const PAGE_SIZE = 12
const selectClassName =
  "flex h-8 rounded-md border border-border bg-background px-2.5 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"

export const ResourcePage: React.FC<ResourcePageProps> = ({
  workspaceId,
  unassigned,
  scopeKey,
  projects,
  selectedProject,
  searchQuery,
  onSearchChange,
  addRequestId,
}) => {
  const [resources, setResources] = useState<ApiResource[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(0)
  const [page, setPage] = useState(1)
  const [projectId, setProjectId] = useState("")
  const [resourceType, setResourceType] = useState<ResourceType | "">("")
  const [createdFrom, setCreatedFrom] = useState("")
  const [createdTo, setCreatedTo] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery.trim())
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [formOpen, setFormOpen] = useState(false)
  const [editingResource, setEditingResource] = useState<ApiResource | null>(null)
  const [detailResource, setDetailResource] = useState<ApiResource | null>(null)
  const [deleteResource, setDeleteResource] = useState<ApiResource | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const requestSequence = useRef(0)
  const previousAddRequest = useRef(addRequestId)
  const saveInFlight = useRef(false)
  const deleteInFlight = useRef(false)
  const activeScope = useRef(scopeKey)
  useLayoutEffect(() => { activeScope.current = scopeKey }, [scopeKey])

  const dateRangeError = createdFrom && createdTo && createdFrom > createdTo
    ? "From date cannot be after To date."
    : null

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timeoutId)
  }, [searchQuery])

  useEffect(() => {
    if (addRequestId !== previousAddRequest.current) {
      previousAddRequest.current = addRequestId
      setEditingResource(null)
      setFormOpen(true)
    }
  }, [addRequestId])

  useEffect(() => {
    if (!toast) return
    const timeoutId = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  useEffect(() => {
    ++requestSequence.current
    setResources([])
    setTotal(0)
    setPages(0)
    setPage(1)
    setProjectId("")
    setFormOpen(false)
    setEditingResource(null)
    setDetailResource(null)
    setDeleteResource(null)
    setToast(null)
  }, [scopeKey])

  useEffect(() => {
    const sequence = ++requestSequence.current
    if (dateRangeError) {
      setIsLoading(false)
      return
    }
    const controller = new AbortController()
    setIsLoading(true)
    setLoadError(null)

    api.getResources(
      {
        q: debouncedSearch || undefined,
        project_id: projectId || undefined,
        workspace_id: workspaceId,
        unassigned,
        resource_type: resourceType || undefined,
        created_from: createdFrom || undefined,
        created_to: createdTo || undefined,
        page,
        page_size: PAGE_SIZE,
      },
      controller.signal
    ).then((result) => {
      if (sequence !== requestSequence.current) return
      setResources(result.items)
      setTotal(result.total)
      setPages(result.pages)
      if (page > Math.max(1, result.pages)) setPage(Math.max(1, result.pages))
    }).catch((error: unknown) => {
      if (controller.signal.aborted || sequence !== requestSequence.current) return
      setLoadError(error instanceof Error ? error.message : "Unable to load resources.")
    }).finally(() => {
      if (sequence === requestSequence.current) setIsLoading(false)
    })

    return () => controller.abort()
  }, [createdFrom, createdTo, dateRangeError, debouncedSearch, page, projectId, refreshKey, resourceType, scopeKey, unassigned, workspaceId])

  const groupedResources = useMemo(() => {
    const groups = new Map<string, ApiResource[]>()
    resources.forEach((resource) => {
      const existing = groups.get(resource.project_id) || []
      existing.push(resource)
      groups.set(resource.project_id, existing)
    })
    return Array.from(groups.entries())
  }, [resources])

  const hasFilters = Boolean(
    debouncedSearch || projectId || resourceType || createdFrom || createdTo
  )

  const showToast = (message: string, tone: ToastState["tone"]) => {
    setToast({ id: Date.now(), message, tone })
  }

  const resetFilters = () => {
    onSearchChange("")
    setDebouncedSearch("")
    setProjectId("")
    setResourceType("")
    setCreatedFrom("")
    setCreatedTo("")
    setPage(1)
  }

  const openCreateForm = () => {
    setEditingResource(null)
    setFormOpen(true)
  }

  const openEditForm = (resource: ApiResource) => {
    setDetailResource(null)
    setEditingResource(resource)
    setFormOpen(true)
  }

  const handleSave = async (payload: ResourcePayload) => {
    if (saveInFlight.current) return
    saveInFlight.current = true
    setIsSaving(true)
    const startedScope = scopeKey
    try {
      if (editingResource) {
        await api.updateResource(editingResource.id, payload)
        showToast(`Updated “${payload.title}”.`, "success")
      } else {
        await api.createResource(payload)
        showToast(`Added “${payload.title}”.`, "success")
      }
      if (activeScope.current !== startedScope) return
      setFormOpen(false)
      setEditingResource(null)
      if (!editingResource && page !== 1) setPage(1)
      else setRefreshKey((value) => value + 1)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save resource."
      if (activeScope.current === startedScope) showToast(message, "error")
      throw error
    } finally {
      if (activeScope.current === startedScope) setIsSaving(false)
      saveInFlight.current = false
    }
  }

  const handleDelete = async () => {
    if (!deleteResource || deleteInFlight.current) return
    deleteInFlight.current = true
    setIsDeleting(true)
    setDeleteError(null)
    const startedScope = scopeKey
    try {
      await api.deleteResource(deleteResource.id)
      if (activeScope.current !== startedScope) return
      showToast(`Deleted “${deleteResource.title}”.`, "success")
      setDeleteResource(null)
      setDetailResource(null)
      if (resources.length === 1 && page > 1) setPage((value) => value - 1)
      else setRefreshKey((value) => value + 1)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete resource."
      if (activeScope.current === startedScope) {
        setDeleteError(message)
        showToast(message, "error")
      }
    } finally {
      if (activeScope.current === startedScope) setIsDeleting(false)
      deleteInFlight.current = false
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Project Resources</h1>
            <p className="mt-1 text-xs text-muted-foreground">{unassigned ? "Resources attached to unassigned legacy Projects." : "Resources limited to the selected Workspace."}</p>
          </div>
          <Button onClick={openCreateForm} className="gap-1.5 self-start sm:hidden" disabled={projects.length === 0}>
            <Plus className="h-4 w-4" /> Add Resource
          </Button>
        </div>

        <div className="mt-4 sm:hidden">
          <SearchInput aria-label="Search all resources" placeholder="Search all resources..." value={searchQuery} onChange={(event) => onSearchChange(event.target.value)} onClear={() => onSearchChange("")} />
        </div>

        <section aria-label="Resource filters" className="mt-5 rounded-lg border border-border bg-card p-3 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-44 flex-1 space-y-1 text-[11px] font-medium sm:max-w-xs">
              <span>Project</span>
              <select
                aria-label="Project"
                value={projectId}
                onChange={(event) => { setProjectId(event.target.value); setPage(1) }}
                className={`${selectClassName} w-full`}
              >
                <option value="">All projects</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </label>

            <label className="min-w-40 space-y-1 text-[11px] font-medium">
              <span>Resource Type</span>
              <select
                aria-label="Resource Type"
                value={resourceType}
                onChange={(event) => { setResourceType(event.target.value as ResourceType | ""); setPage(1) }}
                className={`${selectClassName} w-full`}
              >
                <option value="">All types</option>
                {RESOURCE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>

            <label className="space-y-1 text-[11px] font-medium">
              <span>From</span>
              <input
                type="date"
                aria-label="From"
                value={createdFrom}
                onChange={(event) => { setCreatedFrom(event.target.value); setPage(1) }}
                className={selectClassName}
              />
            </label>

            <label className="space-y-1 text-[11px] font-medium">
              <span>To</span>
              <input
                type="date"
                aria-label="To"
                value={createdTo}
                onChange={(event) => { setCreatedTo(event.target.value); setPage(1) }}
                className={selectClassName}
              />
            </label>

            <Button variant="outline" size="sm" onClick={resetFilters} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
          </div>
          {dateRangeError && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">{dateRangeError}</p>}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3 text-[11px] text-muted-foreground">
            <span>{isLoading ? "Updating results..." : `${total} resource${total === 1 ? "" : "s"}`}</span>
            <span>Search covers project, resource, description, keywords, and type. Dates: UTC+7.</span>
          </div>
        </section>

        {loadError ? (
          <EmptyState
            icon={AlertCircle}
            title="Could not load resources"
            description={loadError}
            className="mt-5 flex-1"
            action={<Button variant="outline" onClick={() => setRefreshKey((value) => value + 1)} className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Retry</Button>}
          />
        ) : isLoading && resources.length === 0 ? (
          <div className="flex flex-1 items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading project resources...
          </div>
        ) : total === 0 ? (
          <EmptyState
            icon={LibraryBig}
            title={hasFilters ? "No resources match these filters" : "No project resources yet"}
            description={hasFilters ? "Reset or adjust the search and filters to see more results." : "Add the first shared link to build your project resource library."}
            className="mt-5 flex-1"
            action={hasFilters ? (
              <Button variant="outline" onClick={resetFilters}>Reset filters</Button>
            ) : (
              <Button onClick={openCreateForm} disabled={projects.length === 0} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add Resource</Button>
            )}
          />
        ) : (
          <div className="mt-5 space-y-6">
            {groupedResources.map(([projectIdentity, items]) => (
              <section key={projectIdentity} aria-labelledby={`project-${items[0].project_id}`}>
                <div className="mb-2 flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-primary" />
                  <h2 id={`project-${items[0].project_id}`} className="text-xs font-bold">{items[0].project_name}</h2>
                  <span className="text-[10px] text-muted-foreground">{items.length} on this page</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {items.map((resource) => {
                    const typeStyle = RESOURCE_TYPE_STYLES[resource.resource_type]
                    const Icon = typeStyle.icon
                    return (
                      <Card key={resource.id} className="group hover:border-primary/35 hover:shadow-md">
                        <CardContent className="flex h-full flex-col p-4">
                          <div className="flex items-start gap-3">
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${typeStyle.className}`}>
                              <Icon className="h-4.5 w-4.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() => setDetailResource(resource)}
                                className="block max-w-full truncate text-left text-sm font-semibold hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              >
                                {resource.title}
                              </button>
                              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{resource.project_name}</p>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button type="button" aria-label={`Actions for ${resource.title}`} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setDetailResource(resource)}>View details</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEditForm(resource)} className="gap-2"><Pencil className="h-3.5 w-3.5" /> Edit</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setDeleteError(null); setDeleteResource(resource) }} className="gap-2 text-red-600 dark:text-red-400"><Trash2 className="h-3.5 w-3.5" /> Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <p className="mt-3 line-clamp-2 min-h-8 text-xs leading-relaxed text-muted-foreground">
                            {resource.description || "No description provided."}
                          </p>

                          <div className="mt-3 flex min-h-6 flex-wrap gap-1">
                            {resource.keywords.slice(0, 4).map((keyword) => <Badge className="max-w-full break-all" key={keyword.toLocaleLowerCase()} variant="secondary">{keyword}</Badge>)}
                            {resource.keywords.length > 4 && <Badge variant="outline">+{resource.keywords.length - 4}</Badge>}
                          </div>

                          <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{resource.resource_type}</Badge>
                              <span className="text-[10px] text-muted-foreground">{formatResourceDate(resource.created_at)}</span>
                            </div>
                            <a
                              href={resource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                              Open Link <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {pages > 1 && !loadError && (
          <nav aria-label="Resource pagination" className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <span className="text-[11px] text-muted-foreground">Page {page} of {pages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || isLoading} className="gap-1"><ChevronLeft className="h-3.5 w-3.5" /> Previous</Button>
              <Button variant="outline" size="sm" onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={page >= pages || isLoading} className="gap-1">Next <ChevronRight className="h-3.5 w-3.5" /></Button>
            </div>
          </nav>
        )}
      </div>

      <ResourceFormDialog
        open={formOpen}
        resource={editingResource}
        projects={projects}
        suggestedProjectId={selectedProject?.id}
        pending={isSaving}
        onClose={() => { setFormOpen(false); setEditingResource(null) }}
        onSubmit={handleSave}
      />

      <ResourceDetailDrawer
        resource={detailResource}
        open={Boolean(detailResource)}
        onClose={() => setDetailResource(null)}
        onEdit={openEditForm}
        onDelete={(resource) => { setDetailResource(null); setDeleteError(null); setDeleteResource(resource) }}
      />

      <Dialog open={Boolean(deleteResource)} onOpenChange={(nextOpen) => !nextOpen && !isDeleting && setDeleteResource(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{deleteResource?.title}”?</DialogTitle>
            <DialogDescription>
              This removes only this resource record. It will not delete the project or the external document.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">{deleteError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteResource(null)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting} className="gap-1.5">
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              {isDeleting ? "Deleting..." : "Delete Resource"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {toast && (
        <div key={toast.id} role="status" aria-live="polite" className={`fixed bottom-4 right-4 z-[80] max-w-sm rounded-lg border px-4 py-3 text-xs font-medium shadow-xl ${toast.tone === "success" ? "border-emerald-500/30 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "border-red-500/30 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"}`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
