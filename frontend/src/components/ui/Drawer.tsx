import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export const Drawer = DialogPrimitive.Root
export const DrawerTrigger = DialogPrimitive.Trigger
export const DrawerPortal = DialogPrimitive.Portal
export const DrawerClose = DialogPrimitive.Close

export const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DrawerOverlay.displayName = DialogPrimitive.Overlay.displayName

interface DrawerContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  side?: "right" | "left"
}

export const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DrawerContentProps
>(({ className, children, side = "right", ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-50 flex h-full flex-col border-border bg-card p-6 shadow-2xl transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out duration-300",
        side === "right" &&
          "inset-y-0 right-0 w-full sm:max-w-md md:max-w-xl border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
        side === "left" &&
          "inset-y-0 left-0 w-full sm:max-w-xs border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm p-1 opacity-70 ring-offset-background transition-opacity hover:opacity-100 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DrawerPortal>
))
DrawerContent.displayName = "DrawerContent"
