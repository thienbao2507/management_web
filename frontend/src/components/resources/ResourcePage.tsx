import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  Calendar,
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
  shared: boolean
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
  shared,
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
        shared,
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
  }, [createdFrom, createdTo, dateRangeError, debouncedSearch, page, projectId, refreshKey, resourceType, scopeKey, shared, workspaceId])

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
            <p className="mt-1 text-xs text-muted-foreground">{shared ? "Resources from Projects shared with you." : "Resources limited to your personal Workspace."}</p>
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
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                From
              </span>
              <input
                type="date"
                aria-label="From"
                value={createdFrom}
                onChange={(event) => { setCreatedFrom(event.target.value); setPage(1) }}
                className={`${selectClassName} [color-scheme:light] dark:[color-scheme:dark] cursor-pointer`}
              />
            </label>

            <label className="space-y-1 text-[11px] font-medium">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                To
              </span>
              <input
                type="date"
                aria-label="To"
                value={createdTo}
                onChange={(event) => { setCreatedTo(event.target.value); setPage(1) }}
                className={`${selectClassName} [color-scheme:light] dark:[color-scheme:dark] cursor-pointer`}
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
                <div className="mb-2 flex min-w-0 items-center gap-2">
                  <FolderKanban className="h-4 w-4 shrink-0 text-primary" />
                  <h2 id={`project-${items[0].project_id}`} title={items[0].project_name} className="min-w-0 truncate text-xs font-bold">{items[0].project_name}</h2>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{items.length} on this page</span>
                </div>
                <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-card" style={{ containerType: "inline-size" }}>
                  <table aria-label={`${items[0].project_name} resources`} className="w-full table-fixed border-collapse text-left">
                    <thead className="bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <tr className="h-9">
                        <th scope="col" className="pl-14 pr-3">Name</th>
                        <th scope="col" className="hidden w-[17%] px-3 [@container(min-width:40rem)]:table-cell">Project</th>
                        <th scope="col" className="w-24 px-2 [@container(min-width:40rem)]:w-28">Type</th>
                        <th scope="col" className="hidden w-[20%] px-3 [@container(min-width:52rem)]:table-cell">Tags</th>
                        <th scope="col" className="hidden w-28 px-3 [@container(min-width:52rem)]:table-cell">Updated</th>
                        <th scope="col" className="w-[4.5rem] px-2 text-right [@container(min-width:40rem)]:w-28">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((resource) => {
                        const typeStyle = RESOURCE_TYPE_STYLES[resource.resource_type]
                        const Icon = typeStyle.icon
                        return (
                          <tr
                            key={resource.id}
                            onClick={() => setDetailResource(resource)}
                            className="group h-14 cursor-pointer border-t border-border/60 transition-colors hover:bg-muted/50 focus-within:bg-muted/50"
                          >
                            <td className="px-3">
                              <button
                                type="button"
                                aria-label={`View details for ${resource.title}`}
                                title={resource.title}
                                onClick={(event) => { event.stopPropagation(); setDetailResource(resource) }}
                                className="flex h-12 w-full min-w-0 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              >
                                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${typeStyle.className}`}>
                                  <Icon aria-hidden="true" className="h-4 w-4" />
                                </span>
                                <span className="truncate text-xs font-semibold text-foreground group-hover:text-primary">{resource.title}</span>
                              </button>
                            </td>
                            <td className="hidden px-3 [@container(min-width:40rem)]:table-cell">
                              <span title={resource.project_name} className="block truncate text-[11px] text-muted-foreground">{resource.project_name}</span>
                            </td>
                            <td className="px-2">
                              <Badge variant="outline" className="max-w-full whitespace-nowrap px-1.5 text-[10px]" title={resource.resource_type}>
                                <span className="truncate">{resource.resource_type}</span>
                              </Badge>
                            </td>
                            <td className="hidden px-3 [@container(min-width:52rem)]:table-cell">
                              <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden">
                                {resource.keywords.slice(0, 2).map((keyword) => (
                                  <Badge className="min-w-0 max-w-28 flex-1 whitespace-nowrap" title={keyword} key={keyword.toLocaleLowerCase()} variant="secondary">
                                    <span className="truncate">{keyword}</span>
                                  </Badge>
                                ))}
                                {resource.keywords.length > 2 && <Badge className="shrink-0 whitespace-nowrap" title={resource.keywords.slice(2).join("; ")} variant="outline">+{resource.keywords.length - 2}</Badge>}
                                {resource.keywords.length === 0 && <span className="text-[11px] text-muted-foreground">—</span>}
                              </div>
                            </td>
                            <td className="hidden px-3 [@container(min-width:52rem)]:table-cell">
                              <time dateTime={resource.updated_at} title={formatResourceDate(resource.updated_at, true)} className="block truncate whitespace-nowrap text-[11px] text-muted-foreground">{formatResourceDate(resource.updated_at)}</time>
                            </td>
                            <td className="px-2">
                              <div className="flex items-center justify-end gap-1">
                                <a
                                  href={resource.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Open link for ${resource.title}`}
                                  title="Open Link"
                                  onClick={(event) => event.stopPropagation()}
                                  className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-md px-1.5 text-[11px] font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                >
                                  <span className="hidden whitespace-nowrap [@container(min-width:40rem)]:inline">Open Link</span>
                                  <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                                </a>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button type="button" aria-label={`Actions for ${resource.title}`} onClick={(event) => event.stopPropagation()} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                                    <DropdownMenuItem onClick={() => setDetailResource(resource)}>View details</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openEditForm(resource)} className="gap-2"><Pencil className="h-3.5 w-3.5" /> Edit</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => { setDeleteError(null); setDeleteResource(resource) }} className="gap-2 text-red-600 dark:text-red-400"><Trash2 className="h-3.5 w-3.5" /> Delete</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
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
