import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "start", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        // The popover width is pinned to the trigger width via Radix's
        // exposed CSS variable. The variable MUST be wrapped in an explicit
        // `var()`: Tailwind v4 dropped v3's habit of auto-wrapping a bare
        // custom property in an arbitrary value, so the unwrapped form
        // compiled to an invalid `width` declaration the browser discarded
        // (leaving the popover content-width). select.tsx pins its width
        // to the trigger the same way.
        "z-50 w-[var(--radix-popover-trigger-width)] min-w-40 rounded-md border border-zinc-800 bg-zinc-950 text-zinc-50 shadow-md outline-hidden p-1",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };
