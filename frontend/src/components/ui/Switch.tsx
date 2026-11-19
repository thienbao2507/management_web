import * as React from "react"
import { cn } from "@/lib/utils"

export interface SwitchProps {
  checked: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  "aria-label"?: string
  className?: string
  size?: "sm" | "md"
  title?: string
  onClick?: React.MouseEventHandler<HTMLButtonElement>
}

const SWITCH_STYLES = `
@keyframes mw-switch-squish {
  0% { transform: translateX(var(--mw-switch-x)) translateY(0) scaleX(1); }
  30% { transform: translateX(var(--mw-switch-x)) translateY(-2px) scaleX(1.35); }
  65% { transform: translateX(var(--mw-switch-x)) translateY(0) scaleX(0.9); }
  100% { transform: translateX(var(--mw-switch-x)) translateY(0) scaleX(1); }
}
.mw-switch-thumb {
  transform: translateX(var(--mw-switch-x));
  transition: transform 450ms cubic-bezier(.68,-0.6,.32,1.6);
}
.mw-switch-thumb[data-animating="true"] {
  animation: mw-switch-squish 450ms ease-out;
}
@media (prefers-reduced-motion: reduce) {
  .mw-switch-thumb { transition: none; }
  .mw-switch-thumb[data-animating="true"] { animation: none; }
}
`

const SIZES = {
  sm: { track: "h-5 w-9", thumb: "h-4 w-4", travel: "1rem" },
  md: { track: "h-6 w-11", thumb: "h-5 w-5", travel: "1.25rem" },
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onCheckedChange,
  disabled = false,
  className,
  size = "md",
  onClick,
  title,
  ...props
}) => {
  const [animating, setAnimating] = React.useState(false)
  const previous = React.useRef(checked)
  const dimensions = SIZES[size]

  React.useEffect(() => {
    if (previous.current === checked) return
    previous.current = checked
    setAnimating(true)
    const timeoutId = window.setTimeout(() => setAnimating(false), 460)
    return () => window.clearTimeout(timeoutId)
  }, [checked])

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={props["aria-label"]}
      title={title}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event)
        if (!disabled) onCheckedChange?.(!checked)
      }}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full p-0.5 transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-muted",
        dimensions.track,
        className
      )}
    >
      <style>{SWITCH_STYLES}</style>
      <span
        aria-hidden="true"
        data-animating={animating}
        style={{ "--mw-switch-x": checked ? dimensions.travel : "0px" } as React.CSSProperties}
        className={cn("mw-switch-thumb pointer-events-none block rounded-full bg-white shadow", dimensions.thumb)}
      />
    </button>
  )
}
