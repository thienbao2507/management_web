import * as React from "react"
import { cn } from "@/lib/utils"

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string
  fallbackSrc?: string
  identityKey?: string
  alt?: string
  fallback: string
  size?: "xs" | "sm" | "md" | "lg"
}

const AvatarImage: React.FC<AvatarProps> = ({
  src,
  fallbackSrc,
  identityKey,
  alt = "",
  fallback,
  size = "md",
  className,
  ...props
}) => {
  const signature = JSON.stringify([identityKey, src, fallbackSrc])
  const [failures, setFailures] = React.useState<{ signature: string; urls: string[] }>({ signature, urls: [] })
  const failed = failures.signature === signature ? failures.urls : []
  const resolvedSrc = [src, fallbackSrc].find((url) => url && !failed.includes(url))

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
      {resolvedSrc ? (
        <img
          key={resolvedSrc}
          src={resolvedSrc}
          alt={alt}
          onError={() => setFailures((previous) => ({ signature, urls: [...(previous.signature === signature ? previous.urls : []), resolvedSrc] }))}
          className="aspect-square h-full w-full object-cover"
        />
      ) : (
        <span className="font-semibold">{fallback}</span>
      )}
    </div>
  )
}

export const Avatar: React.FC<AvatarProps> = (props) => (
  <AvatarImage key={JSON.stringify([props.identityKey, props.src, props.fallbackSrc])} {...props} />
)
