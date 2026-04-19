import React from "react";
import { useGame } from "@/contexts/GameContext";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChipTooltipContent } from "@/components/ui/chip-tooltip";

/**
 * Default colour palette used when the game hasn't declared a `className`
 * for a hit level (legacy fallback). Keeps SC6 / T8 presentation identical
 * to what shipped before the tooltip refresh.
 */
const DEFAULT_HIT_LEVEL_BG: Record<string, string> = {
  M: "bg-yellow-500",
  L: "bg-cyan-500",
  H: "bg-pink-500",
  SM: "bg-purple-500",
  SL: "bg-cyan-500",
  SH: "bg-orange-500",
};

export const HitLevelIcon = React.memo(({ level }: { level: string }) => {
  const { hitLevels } = useGame();

  const effectiveLevel = level.toUpperCase();
  const levelInfo = hitLevels[effectiveLevel];
  const bgColor =
    levelInfo?.className ||
    DEFAULT_HIT_LEVEL_BG[effectiveLevel] ||
    "bg-zinc-400";
  const label =
    effectiveLevel.length > 1 && ["SL", "SH", "SM"].includes(effectiveLevel)
      ? effectiveLevel
      : effectiveLevel.charAt(0);

  const icon = (
    <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center p-px ring-1 ring-black">
      <div className="w-full h-full rounded-full bg-white flex items-center justify-center p-px">
        <div
          className={`w-full h-full rounded-full flex items-center justify-center text-xs font-bold text-white ${bgColor}`}
        >
          {label}
        </div>
      </div>
    </div>
  );

  if (!levelInfo) return icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{icon}</TooltipTrigger>
      <TooltipContent>
        <ChipTooltipContent
          code={effectiveLevel}
          title={levelInfo.name || effectiveLevel}
          description={levelInfo.description}
        />
      </TooltipContent>
    </Tooltip>
  );
});
HitLevelIcon.displayName = "HitLevelIcon";
