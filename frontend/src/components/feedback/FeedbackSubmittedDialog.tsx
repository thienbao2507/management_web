import React from "react"
import { CircleCheck } from "lucide-react"

import { Button } from "@/components/ui/Button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog"


interface FeedbackSubmittedDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const FeedbackSubmittedDialog: React.FC<FeedbackSubmittedDialogProps> = ({
  open,
  onOpenChange,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader className="items-center text-center sm:text-center">
        <span className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <CircleCheck className="h-7 w-7" aria-hidden="true" />
        </span>
        <DialogTitle>Thank you for your feedback!</DialogTitle>
        <DialogDescription className="max-w-sm leading-relaxed">
          Your feedback has been sent successfully. We appreciate you taking the time to help us improve.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="sm:justify-center">
        <Button type="button" onClick={() => onOpenChange(false)}>Close</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
