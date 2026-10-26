import React from "react"
import { LucideIcon, Inbox } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-6 text-center rounded-lg border border-dashed border-border/70 bg-surface/30",
        className
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground mb-3">
        <Icon className="h-5 w-5" />
      </div>
      <h4 className="text-xs font-semibold text-foreground">{title}</h4>
      {description && (
        <p className="mt-1 text-[11px] text-muted-foreground max-w-xs">
          {description}
        </p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
