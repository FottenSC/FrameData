import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChipTooltipContent } from "@/components/ui/chip-tooltip";
import { MOTION_TITLES } from "@/lib/notation";

interface DirectionChipProps {
  token: string;
  isHeld: boolean;
  /**
   * For motion-shorthand tokens (qcf / qcb / hcf / …), the numpad-direction
   * sequence the shorthand stands for. When present the tooltip shows the
   * expansion so players who don't know the shorthand can still read it.
   * Omit for plain single-direction tokens.
   */
  expansion?: readonly string[];
}

/**
 * Text-mode direction chip. Used by notation styles that express directions
 * as letter codes (F / B / UF / UB / …) and therefore don't have SVG artwork
 * per token. Shared between CommandRenderer and NotesRenderer so the same
 * chip shows up identically in a move's command column and inside an inline
 * notes reference like `The :3: after :4: cancels.`
 *
 * Doubles as the shorthand-motion chip in Tekken-style notation: a token
 * like `qcf` is rendered the same way — one chip — but carries `expansion`
 * so the tooltip spells out the actual directional sequence.
 */
export const DirectionChip = React.memo(
  ({ token, isHeld, expansion }: DirectionChipProps) => {
    const lower = token.toLowerCase();
    const motionTitle = MOTION_TITLES[lower];
    const isMotion = expansion !== undefined || motionTitle !== undefined;

    const title = isHeld
      ? `Held ${token}`
      : motionTitle
        ? motionTitle
        : `${token} direction`;

    const description = isHeld
      ? "Hold the direction until the move comes out."
      : expansion && expansion.length > 0
        ? `Sequence: ${expansion.join(" → ")}`
        : undefined;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center justify-center font-bold align-middle font-sans rounded cursor-default",
              "h-5 text-[13px] relative z-10 border",
              // Motion shorthand needs horizontal breathing room because its
              // label is 2-3 chars ("qcf") not 1-2 ("F" / "UF"). Use px-1.5
              // for those and keep single-direction chips compact at px-1.
              isMotion ? "min-w-6 px-1.5" : "min-w-5 px-1",
              // Visual language mirrors CommandIcon: normal = white pill with
              // black text + border, held = inverted black pill with white
              // text + border. "Held" reads the same way whether the underlying
              // input is a direction (F / UF / 3) or a button (A / K / 2).
              isHeld
                ? "bg-black text-white border-white"
                : "bg-white text-black border-black",
            )}
          >
            {token}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <ChipTooltipContent
            code={token}
            title={title}
            description={description}
          />
        </TooltipContent>
      </Tooltip>
    );
  },
);
DirectionChip.displayName = "DirectionChip";
