import * as React from "react"
import { Search, X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-8 w-full rounded-md border border-border bg-background px-3 py-1 text-xs shadow-sm transition-colors file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export interface SearchInputProps extends InputProps {
  onClear?: () => void
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, value, onChange, onClear, placeholder = "Search tasks...", ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={cn(
            "flex h-8 w-full rounded-md border border-border/80 bg-surface/50 pl-8 pr-7 py-1 text-xs shadow-sm transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-background",
            className
          )}
          ref={ref}
          {...props}
        />
        {value && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    )
  }
)
SearchInput.displayName = "SearchInput"
