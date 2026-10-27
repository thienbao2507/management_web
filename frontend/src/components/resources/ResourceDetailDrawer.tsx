import React from "react"
import { CalendarDays, ExternalLink, FolderKanban, Pencil, Tag, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Drawer, DrawerContent } from "@/components/ui/Drawer"
import { DialogTitle, DialogDescription } from "@/components/ui/Dialog"
import type { ApiResource } from "@/services/api"
import { formatResourceDate, RESOURCE_TYPE_STYLES } from "./resourceUtils"


interface ResourceDetailDrawerProps {
  resource: ApiResource | null
  open: boolean
  onClose: () => void
  onEdit: (resource: ApiResource) => void
  onDelete: (resource: ApiResource) => void
}

export const ResourceDetailDrawer: React.FC<ResourceDetailDrawerProps> = ({
  resource,
  open,
  onClose,
  onEdit,
  onDelete,
}) => {
  if (!resource) return null
  const typeStyle = RESOURCE_TYPE_STYLES[resource.resource_type]
  const Icon = typeStyle.icon

  return (
    <Drawer open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DrawerContent className="overflow-y-auto sm:max-w-lg">
        <div className="pr-8">
          <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${typeStyle.className}`}>
            <Icon className="h-5 w-5" />
          </div>
          <DialogTitle className="text-lg font-bold leading-tight">{resource.title}</DialogTitle>
          <DialogDescription className="sr-only">Resource metadata and link for {resource.project_name}.</DialogDescription>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{resource.resource_type}</Badge>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <FolderKanban className="h-3.5 w-3.5" /> {resource.project_name}
            </span>
          </div>
        </div>

        <div className="mt-6 space-y-5 text-xs">
          <section>
            <h3 className="mb-1.5 font-semibold text-foreground">Description</h3>
            <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
              {resource.description || "No description provided."}
            </p>
          </section>

          <section>
            <h3 className="mb-1.5 font-semibold text-foreground">Full URL</h3>
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block break-all rounded-md border border-border bg-muted/40 p-2.5 text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {resource.url}
            </a>
          </section>

          <section>
            <h3 className="mb-1.5 inline-flex items-center gap-1 font-semibold text-foreground">
              <Tag className="h-3.5 w-3.5" /> Keywords
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {resource.keywords.length > 0 ? resource.keywords.map((keyword) => (
                <Badge key={keyword.toLocaleLowerCase()} variant="secondary">{keyword}</Badge>
              )) : <span className="text-muted-foreground">No keywords.</span>}
            </div>
          </section>

          <section className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-2">
            <div>
              <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Created</span>
              <p className="mt-1 flex items-center gap-1 font-medium">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                <time dateTime={resource.created_at} title={resource.created_at}>{formatResourceDate(resource.created_at, true)}</time>
              </p>
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Last updated</span>
              <p className="mt-1 flex items-center gap-1 font-medium">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                <time dateTime={resource.updated_at} title={resource.updated_at}>{formatResourceDate(resource.updated_at, true)}</time>
              </p>
            </div>
          </section>
          <p className="text-[10px] text-muted-foreground">Times shown in Asia/Ho_Chi_Minh (UTC+7).</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
          <Button onClick={() => onEdit(resource)} variant="outline" className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button onClick={() => onDelete(resource)} variant="destructive" className="gap-1.5">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Open Link <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
