import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border font-mono text-[11px] font-bold uppercase tracking-[0.06em] px-2 py-[3px] transition-colors",
  {
    variants: {
      variant: {
        default:  "border-primary/25 bg-primary/10 text-primary",
        buy:      "border-up/25 bg-up/10 text-up",
        sell:     "border-down/25 bg-down/10 text-down",
        live:     "border-live/25 bg-live/10 text-live animate-pulse-live",
        paper:    "border-muted-foreground/15 bg-muted-foreground/10 text-muted-foreground",
        warning:  "border-amber/25 bg-amber/10 text-amber",
        info:     "border-sky/25 bg-sky/10 text-sky",
        destructive: "border-destructive/25 bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
