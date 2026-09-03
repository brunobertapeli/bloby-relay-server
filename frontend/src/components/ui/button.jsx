import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"
import { cn } from "../../lib/utils"

// Buttons are pills. The default is "Morphy material" — the glossy blue of
// the mascot's body — and every variant squashes slightly on press.
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-display font-semibold transition-[transform,background-color,border-color,box-shadow,filter] duration-300 ease-squish focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-x-[1.03] active:scale-y-[0.95] active:duration-75",
  {
    variants: {
      variant: {
        default: "btn-morphy",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:brightness-110 hover:-translate-y-px",
        outline:
          "border border-foreground/10 bg-foreground/[0.04] text-foreground hover:bg-foreground/[0.07] hover:border-sky/35 hover:-translate-y-px",
        secondary:
          "bg-surface-3 text-secondary-foreground hover:bg-surface-3/80 hover:-translate-y-px",
        ghost: "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]",
        link: "text-sky underline-offset-4 hover:underline font-sans font-medium",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 px-3.5 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button, buttonVariants }
