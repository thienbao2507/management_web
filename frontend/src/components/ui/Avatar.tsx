import * as React from "react"
import { cn } from "@/lib/utils"

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string
  alt?: string
  fallback: string
  size?: "xs" | "sm" | "md" | "lg"
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = "",
  fallback,
  size = "md",
  className,
  ...props
}) => {
  const [imageError, setImageError] = React.useState(false)

  const sizeClasses = {
    xs: "h-5 w-5 text-[9px]",
    sm: "h-6 w-6 text-[10px]",
    md: "h-8 w-8 text-xs",
    lg: "h-10 w-10 text-sm",
  }[size]

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden border border-border/80 bg-muted font-medium text-muted-foreground select-none",
        sizeClasses,
        className
      )}
      {...props}
    >
      {src && !imageError ? (
        <img
          src={src}
          alt={alt}
          onError={() => setImageError(true)}
          className="aspect-square h-full w-full object-cover"
        />
      ) : (
        <span className="font-semibold">{fallback}</span>
      )}
    </div>
  )
}
