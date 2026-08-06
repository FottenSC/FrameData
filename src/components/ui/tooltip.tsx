import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

interface InteractiveTooltipProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Keeps the usual hover/focus tooltip behavior, and adds tap-to-toggle for
 * devices that do not have a hover-capable pointer.
 */
const InteractiveTooltip: React.FC<InteractiveTooltipProps> = ({
  trigger,
  children,
}) => {
  const [open, setOpen] = React.useState(false);

  const handleClick = () => {
    if (window.matchMedia("(hover: none)").matches) {
      setOpen((current) => !current);
    }
  };

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex appearance-none border-0 bg-transparent p-0 text-inherit"
          onClick={handleClick}
          aria-expanded={open}
        >
          {trigger}
        </button>
      </TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  );
};

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> & {
    /** Render a small matching arrow pointing at the trigger. Defaults to true. */
    withArrow?: boolean;
  }
>(
  (
    { className, sideOffset = 6, withArrow = true, children, ...props },
    ref,
  ) => (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          // Base visuals — slightly wider padding, stronger shadow, subtle
          // ring so tooltips read cleanly above busy table rows.
          "z-50 max-w-xs rounded-md border border-zinc-700/80 bg-zinc-900/95 backdrop-blur-sm",
          "px-3 py-2 text-sm text-zinc-50 shadow-lg shadow-black/40",
          "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className,
        )}
        {...props}
      >
        {children}
        {withArrow && (
          <TooltipPrimitive.Arrow
            className="fill-zinc-900 drop-shadow"
            width={10}
            height={5}
          />
        )}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  ),
);
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  InteractiveTooltip,
};
