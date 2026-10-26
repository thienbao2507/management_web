import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-ring",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20",
        outline: "text-foreground border-border",
        // Specific priority variants
        low: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300",
        medium: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/50 dark:text-blue-300",
        high: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/50 dark:text-amber-300",
        urgent: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/50 dark:text-red-300 font-semibold",
        blocked: "border-rose-300 bg-rose-100/80 text-rose-800 dark:border-rose-900 dark:bg-rose-950/80 dark:text-rose-300 font-semibold animate-pulse",
        success: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/50 dark:text-emerald-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}
