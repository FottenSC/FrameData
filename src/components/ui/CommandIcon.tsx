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
  // Visible pill size. Slides render at a reduced size so they read as
  // a secondary / chained input next to regular button pills. Normal
  // pills use min-w + px-1 (matching DirectionChip) so two-letter codes
  // like "BT" expand the pill instead of clipping out of a fixed 20px box.
  const pillSizeClasses = isSlide
    ? "w-3.5 h-3.5 text-[11px]"
    : "min-w-5 h-5 px-1 text-[16px]";
  // Negative right-margin pulls the next element ~half a slide-width
  // to the left so they overlap. Only applied when caller confirmed
  // the next thing is a regular button.
  const overlapMargin = isSlide && overlapNext ? "-mr-2" : "";
  // Slides render ABOVE their overlapping normal neighbour so the full
  // slide pill stays visible — the normal button's left edge sits
  // underneath the slide's right edge, not vice versa.
  const zClasses = isSlide ? "z-20" : "z-10";

  const code = input.toUpperCase();
  const { title, description } = tooltipCopy(code, isSlide, isHeld);

  // The visible pill. For both variants we use the same inner shape;
  // the OUTER wrapper (below for slides, the pill itself for normals)
  // is what the parent flex container sees.
  //
  // `leading-none` collapses the line box to the font's em height so
  // flex centering aligns on the actual glyph rather than on the
  // inflated default line-height (without it, bold capitals like K/G
  // land a pixel high in the box). The inner span wraps the glyph in a
  // block so per-letter side-bearing skew doesn't shift it
  // horizontally.
  const pill = (
    <div
      className={cn(
        "inline-flex items-center justify-center font-bold font-sans cursor-default leading-none text-center",
        pillSizeClasses,
        "button-icon",
        isHeld ? heldClasses : baseClasses,
      )}
    >
      <span className="block translate-y-[-0.5px]">{code}</span>
    </div>
  );

  // Normal buttons: pill IS the trigger. Margin/z/positioning live on
  // the pill itself.
  if (!isSlide) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center justify-center align-middle relative mx-0.25",
              zClasses,
            )}
          >
            {pill}
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
  }

  // Slides: wrap the small pill in an outer h-5 box (same height as
  // normal buttons) with the pill anchored at the bottom via
  // `items-end`. The outer box is only the pill's WIDTH so the
  // overlap math (-mr-2 for overlapNext) and `+`-compound layout
  // (a+b → K) keep working — the wrapper takes the same horizontal
  // space the bare slide pill used to take, just with extra
  // (transparent) headroom above. Net effect: slide bottoms always
  // share a baseline with adjacent normal-button bottoms, regardless
  // of which flex alignment the parent uses, so we never need
  // `self-end` or special parent items-end any more.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "inline-flex items-end justify-center align-middle relative",
            "w-3.5 h-5", // pill width × normal button height
            overlapMargin,
            zClasses,
          )}
        >
          {pill}
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
