import React, { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/Button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog"
import { api, type FeedbackCategory, type MyFeedback } from "@/services/api"


interface FeedbackThankYouProps {
  currentUserId: string
}

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: "Lỗi",
  feature: "Tính năng",
  other: "Khác",
}

function summarize(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim()
  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized
}

export const FeedbackThankYou: React.FC<FeedbackThankYouProps> = ({ currentUserId }) => {
  const [items, setItems] = useState<MyFeedback[]>([])
  const [open, setOpen] = useState(false)
  const loadedUserId = useRef<string | null>(null)
  const acknowledging = useRef(false)

  useEffect(() => {
    if (loadedUserId.current === currentUserId) return
    loadedUserId.current = currentUserId
    api.listFeedbackThankYou().then((result) => {
      if (loadedUserId.current !== currentUserId || result.items.length === 0) return
      setItems(result.items)
      setOpen(true)
    }).catch(() => undefined)
  }, [currentUserId])

  const acknowledgeAndClose = () => {
    if (acknowledging.current) return
    acknowledging.current = true
    const pendingItems = items
    setOpen(false)
    setItems([])
    void Promise.allSettled(pendingItems.map((item) => api.ackFeedbackThankYou(item.id)))
      .finally(() => { acknowledging.current = false })
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) acknowledgeAndClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cảm ơn bạn đã góp ý! 🎉</DialogTitle>
          <DialogDescription>Chúng tôi đã hoàn thành những gì bạn đề xuất:</DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs leading-relaxed">
              <span className="mr-2 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold capitalize text-primary">{CATEGORY_LABELS[item.category]}</span>
              {summarize(item.content)}
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button type="button" onClick={acknowledgeAndClose}>Đã hiểu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
