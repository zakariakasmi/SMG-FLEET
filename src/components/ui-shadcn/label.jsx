"use client"

import * as React from "react"
import { cn } from "cn"
import { Label as LabelPrimitive } from "radix-ui"

function Label({
  className,
  ...props
}) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none data-disabled:pointer-events-none data-disabled:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }