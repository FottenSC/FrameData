import React from "react";
import { useGame } from "@/contexts/GameContext";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const HitLevelIcon = React.memo(({ level }: { level: string }) => {
  const { hitLevels } = useGame();
  let bgColor = "bg-gray-400";
  let textColor = "text-white";

  const effectiveLevel = level.toUpperCase();
  const levelInfo = hitLevels[effectiveLevel];

  if (levelInfo?.className) {
    bgColor = levelInfo.className;
  } else {
    switch (effectiveLevel) {
      case "M":
        bgColor = "bg-yellow-500";
        break;
      case "L":
        bgColor = "bg-cyan-500";
        break;
      case "H":
        bgColor = "bg-pink-500";
        break;
      case "SM":
        bgColor = "bg-purple-500";
        break;
      case "SL":
        bgColor = "bg-cyan-500";
        break;
      case "SH":
        bgColor = "bg-orange-500";
        break;
    }
  }

  const icon = (
    <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center p-px ring-1 ring-black">
      <div className="w-full h-full rounded-full bg-white flex items-center justify-center p-px">
        <div
          className={`w-full h-full rounded-full flex items-center justify-center text-xs font-bold ${bgColor} ${textColor}`}
        >
          {effectiveLevel.length > 1 &&
          ["SL", "SH", "SM"].includes(effectiveLevel)
            ? effectiveLevel
            : effectiveLevel.charAt(0)}
        </div>
      </div>
    </div>
  );

  if (!levelInfo) return icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{icon}</TooltipTrigger>
      <TooltipContent className="flex flex-col gap-1">
        <p className="font-bold">{levelInfo.name}</p>
        {levelInfo.description && (
          <p className="text-xs text-zinc-400">{levelInfo.description}</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
});
