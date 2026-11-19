import React, { useEffect, useState } from "react"
import { Loader2, MessageSquareText, Plus } from "lucide-react"

import { Button } from "@/components/ui/Button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog"
import { api, type FeedbackCategory, type FeedbackStatus, type MyFeedback } from "@/services/api"


const statusClasses: Record<FeedbackStatus, string> = {
  new: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  in_progress: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  done: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  rejected: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
}

const categoryClasses: Record<FeedbackCategory, string> = {
  bug: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  feature: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  other: "border-border bg-muted text-muted-foreground",
}

const statusLabels: Record<FeedbackStatus, string> = {
  new: "New",
  in_progress: "In progress",
  done: "Done",
  rejected: "Rejected",
}

interface MyFeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateNew: () => void
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value))
}

export const MyFeedbackDialog: React.FC<MyFeedbackDialogProps> = ({ open, onOpenChange, onCreateNew }) => {
  const [items, setItems] = useState<MyFeedback[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    const loadingTimer = window.setTimeout(() => {
      setLoading(true)
      setError(null)
    }, 0)
    api.listMyFeedback(controller.signal).then((result) => {
      setItems(result.items)
    }).catch((reason: unknown) => {
      if (controller.signal.aborted) return
      setItems([])
      setError(reason instanceof Error ? reason.message : "Unable to load your feedback.")
    }).finally(() => {
      window.clearTimeout(loadingTimer)
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => {
      window.clearTimeout(loadingTimer)
      controller.abort()
    }
  }, [open, refreshKey])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <div className="flex items-start justify-between gap-3 pr-8">
          <DialogHeader>
            <DialogTitle>My feedback</DialogTitle>
            <DialogDescription>Track the suggestions and reports you have sent.</DialogDescription>
          </DialogHeader>
          <Button type="button" size="sm" className="shrink-0 gap-1.5" onClick={onCreateNew}>
            <Plus className="h-3.5 w-3.5" />
            New feedback
          </Button>
        </div>

        {error && (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            <span>{error}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => setRefreshKey((value) => value + 1)}>Retry</Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-xs text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading your feedback...</div>
        ) : !error && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><MessageSquareText className="h-6 w-6" /></span>
            <p className="text-xs text-muted-foreground">You haven't sent any feedback yet.</p>
          </div>
        ) : items.length > 0 ? (
          <div className="space-y-2">
            {items.map((item) => (
              <article key={item.id} className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${categoryClasses[item.category]}`}>{item.category}</span>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClasses[item.status]}`}>{statusLabels[item.status]}</span>
                  </div>
                  <time dateTime={item.created_at} className="text-[10px] text-muted-foreground">{formatDate(item.created_at)}</time>
                </div>
                <p className="mt-2 line-clamp-3 whitespace-pre-line text-xs leading-relaxed">{item.content}</p>
              </article>
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
