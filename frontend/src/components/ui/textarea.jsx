import * as React from "react"
import { cn } from "../../lib/utils"

const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-2xl border border-input bg-background/60 px-4 py-3 text-sm shadow-[inset_0_2px_6px_-2px_hsl(228_40%_2%/0.5)] transition-[border-color,box-shadow] duration-200 text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-sky/60 focus-visible:ring-4 focus-visible:ring-sky/15 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
