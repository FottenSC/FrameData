import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChipTooltipContent } from "@/components/ui/chip-tooltip";

/**
 * Text-mode direction chip. Used by notation styles that express directions
 * as letter codes (F / B / UF / UB / …) and therefore don't have SVG artwork
 * per token. Shared between CommandRenderer and NotesRenderer so the same
 * chip shows up identically in a move's command column and inside an inline
 * notes reference like `The :3: after :4: cancels.`
 */
export const DirectionChip = React.memo(
  ({ token, isHeld }: { token: string; isHeld: boolean }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "inline-flex items-center justify-center font-bold align-middle font-sans rounded cursor-default",
            "min-w-5 h-5 px-1 text-[13px] relative z-10 border",
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
          title={isHeld ? `Held ${token}` : `${token} direction`}
          description={
            isHeld ? "Hold the direction until the move comes out." : undefined
          }
        />
      </TooltipContent>
    </Tooltip>
  ),
);
DirectionChip.displayName = "DirectionChip";
