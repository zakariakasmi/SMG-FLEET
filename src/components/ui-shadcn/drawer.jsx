import * as React from "react"
import { cn } from "cn"
import { Drawer as DrawerPrimitive } from "vaul"

function Drawer({
  ...props
}) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />
}

function DrawerTrigger({
  ...props
}) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerPortal({
  ...props
}) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
}

function DrawerClose({
  ...props
}) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerOverlay({
  className,
  ...props
}) {
  return (
    <DrawerPrimitive.Overlay
      data-slot="drawer-overlay"
      className={cn("fixed inset-0 z-50 bg-black/10", className)}
      {...props}
    />
  )
}

function DrawerContent({
  className,
  children,
  ...props
}) {
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        className={cn(
          "group/drawer-content fixed inset-x-0 bottom-0 z-50 flex h-auto flex-col rounded-t-xl border bg-popover",
          className
        )}
        {...props}
      >
        <div className="mx-auto mt-3 h-1 w-8 shrink-0 rounded-full bg-muted" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  )
}

function DrawerHeader({
  className,
  ...props
}) {
  return (
    <div
      data-slot="drawer-header"
      className={cn("grid gap-1.5 p-4", className)}
      {...props}
    />
  )
}

function DrawerFooter({
  className,
  ...props
}) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function DrawerTitle({
  className,
  ...props
}) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("text-base leading-none font-medium", className)}
      {...props}
    />
  )
}

function DrawerDescription({
  className,
  ...props
}) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
}