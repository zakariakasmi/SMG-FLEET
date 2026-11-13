import * as React from "react"
import { cn } from "cn"
import { Dialog as SheetPrimitive } from "radix-ui"

import { Button } from "@/components/ui-shadcn/button"
import { XClose } from "@untitledui/icons"

function Sheet({
  ...props
}) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-popover p-4 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none duration-100",
          side === "top" &&
            "inset-x-0 top-0 h-auto border-b data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top",
          side === "right" &&
            "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
          side === "bottom" &&
            "inset-x-0 bottom-0 h-auto border-t data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
          side === "left" &&
            "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close data-slot="sheet-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-2 right-2"
              size="icon-sm"
            >
              <XClose
              />
              <span className="sr-only">Close</span>
            </Button>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({
  className,
  ...props
}) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function SheetFooter({
  className,
  ...props
}) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "-mx-4 -mb-4 mt-auto flex flex-col-reverse gap-2 border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-base leading-none font-medium", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn(
        "text-sm text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
}