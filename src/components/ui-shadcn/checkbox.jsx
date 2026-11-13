import * as React from "react"
import { cn } from "cn"
import { Checkbox as CheckboxPrimitive } from "radix-ui"
import { Check } from "@untitledui/icons"

function Checkbox({
  className,
  ...props
}) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer inline-flex size-[18px] shrink-0 items-center justify-center rounded-[4px] border border-input transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-foreground data-[state=checked]:border-foreground data-[state=checked]:text-background aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className="flex items-center justify-center text-current"
      >
        <Check className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }