import React from "react";
import { Move } from "@/types/Move";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Copy } from "lucide-react";
import { ExpandableHitLevels } from "@/components/icons/ExpandableHitLevels";
import { ValueBadge } from "@/components/ui/ValueBadge";

interface MoveTableCellProps {
  move: Move;
  columnId: string;
  renderCommand: (command: string[] | null) => React.ReactNode;
  renderNotes: (note: string | null) => React.ReactNode;
  copyCommand: (move: Move) => void;
  getStanceInfo: (stance: string, characterId: number) => any;
  getPropertyInfo: (prop: string) => any;
  badges?: Record<string, { className: string }>;
}

export const MoveTableCell: React.FC<MoveTableCellProps> = ({
  move,
  columnId,
  renderCommand,
  renderNotes,
  copyCommand,
  getStanceInfo,
  getPropertyInfo,
  badges,
}) => {
  switch (columnId) {
    case "character":
      return <>{move.characterName || "—"}</>;
    case "stance":
      if (!move.stance || move.stance.length === 0) {
        return <>—</>;
      }
      return (
        <div className="flex flex-wrap gap-0.5 justify-end">
          {move.stance.filter((s) => s && s.trim() !== "").map((s, i) => {
            const stanceInfo = getStanceInfo(s, move.characterId);
            const hasTooltipContent =
              stanceInfo &&
              ((stanceInfo.name && stanceInfo.name !== s) ||
                stanceInfo.description);

            if (hasTooltipContent) {
              return (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="secondary"
                      className="whitespace-nowrap border border-gray-500"
                    >
                      {s}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="space-y-1">
                      <p className="font-semibold">{stanceInfo.name || s}</p>
                      {stanceInfo.description && (
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                          {stanceInfo.description}
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Badge
                key={i}
                variant="secondary"
                className="whitespace-nowrap border border-gray-500"
              >
                {s}
              </Badge>
            );
          })}
        </div>
      );
    case "command":
      return (
        <div className="flex items-center justify-between gap-2">
          <span className="flex-1">{renderCommand(move.command)}</span>
          <button
            onClick={() => copyCommand(move)}
            className="flex-shrink-0 p-1 rounded hover:bg-muted transition-colors opacity-50 hover:opacity-100"
            title="Copy command"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      );
    case "rawCommand":
      return <>{move.stringCommand || "—"}</>;
    case "hitLevel":
      return (
        <ExpandableHitLevels
          hitLevelString={move.hitLevel}
          maxIconsToShow={3}
        />
      );
    case "impact":
      return <>{move.impact ?? "—"}</>;
    case "damage":
      return <>{move.damageDec ?? "—"}</>;
    case "block":
      return (
        <ValueBadge value={move.blockDec} text={move.block} badges={badges} />
      );
    case "hit":
      return <ValueBadge value={move.hitDec} text={move.hit} badges={badges} />;
    case "counterHit":
      return (
        <ValueBadge
          value={move.counterHitDec}
          text={move.counterHit}
          badges={badges}
        />
      );
    case "guardBurst":
      return (
        <ValueBadge
          value={move.guardBurst}
          text={null}
          forceNoSign
          badges={badges}
        />
      );
    case "properties":
      if (!move.properties || move.properties.length === 0) {
        return <>—</>;
      }
      return (
        <div className="flex flex-wrap gap-0.5">
          {move.properties.map((prop) => {
            const propInfo = getPropertyInfo(prop);
            const className = propInfo?.className || "";

            const badge = (
              <Badge
                variant="default"
                className={`whitespace-nowrap border text-xs w-8 font-semibold inline-flex items-center justify-center ${className}`}
              >
                {prop}
              </Badge>
            );

            const hasTooltipContent =
              (propInfo?.name && propInfo.name !== prop) ||
              propInfo?.description;

            return (
              <Tooltip key={prop}>
                <TooltipTrigger asChild>{badge}</TooltipTrigger>
                {hasTooltipContent && (
                  <TooltipContent className="max-w-xs">
                    <div className="space-y-1">
                      <p className="font-semibold">{propInfo?.name || prop}</p>
                      {propInfo?.description && (
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                          {propInfo.description}
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </div>
      );
    case "notes":
      return (
        <div className="max-w-full truncate overflow-x-hidden overflow-y-visible">
          {renderNotes(move.notes)}
        </div>
      );
    default:
      return <>—</>;
  }
};
