import React from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChipTooltipContent } from "@/components/ui/chip-tooltip";

interface CommandIconProps {
  input: string;
  isHeld: boolean;
  isSlide: boolean;
  /**
   * Only meaningful when `isSlide` is true. When set, the slide pill pulls
   * its right-hand neighbour ~half a slide-width leftward so the two overlap.
   * Should only be passed when the caller has confirmed the next element is
   * a regular button — otherwise (slide-next-to-slide, trailing slide, slide
   * before a separator) we leave them side-by-side.
   */
  overlapNext?: boolean;
}

/** Human-readable description of what a given button variant means. */
function tooltipCopy(
  code: string,
  isSlide: boolean,
  isHeld: boolean,
): { title: string; description?: string } {
  if (isSlide && isHeld) {
    return {
      title: `Slide ${code} (held)`,
      description:
        "Fast, held secondary input. Lowercase + parentheses in the source " +
        "notation. Leads straight into the next press.",
    };
  }
  if (isSlide) {
    return {
      title: `Slide ${code}`,
      description:
        "Slide input — a quick secondary tap that chains directly into the " +
        "button that follows. Shown here at reduced size and overlapping " +
        "the next pill.",
    };
  }
  if (isHeld) {
    return {
      title: `Held ${code}`,
      description:
        "Hold the button until the move comes out. Release to commit.",
    };
  }
  return { title: `${code} button` };
}

export const CommandIcon: React.FC<CommandIconProps> = ({
  input,
  isHeld,
  isSlide,
  overlapNext = false,
}) => {
  const baseClasses = "border border-black bg-white text-black rounded";
  const heldClasses = "bg-black text-white border border-white rounded";
  // Slide inputs (lowercase letters in the source) render at a smaller size
  // so they read as a secondary / chained input next to regular button pills.
  const sizeClasses = isSlide
    ? "w-3.5 h-3.5 text-[11px]"
    : "w-5 h-5 text-[16px]";
  // Negative right-margin pulls the next element ~half a slide-width to the
  // left so they overlap. Only applied when caller confirmed the next thing
  // is a regular button; a slide followed by another slide stays tidy.
  const marginClasses = isSlide ? (overlapNext ? "-mr-2" : "") : "mx-0.25";
  // Slides render ABOVE their overlapping normal neighbour so the full slide
  // pill stays visible — the normal button's left edge sits underneath the
  // slide's right edge, not vice versa.
  const zClasses = isSlide ? "z-20" : "z-10";

  const code = input.toUpperCase();
  const { title, description } = tooltipCopy(code, isSlide, isHeld);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "inline-flex items-center justify-center font-bold align-middle font-sans cursor-default",
            sizeClasses,
            marginClasses,
            isSlide ? "self-end" : "",
            "button-icon",
            "relative",
            zClasses,
            isHeld ? heldClasses : baseClasses,
          )}
        >
          {code}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <ChipTooltipContent
          code={code}
          title={title}
          description={description}
        />
      </TooltipContent>
    </Tooltip>
  );
};
