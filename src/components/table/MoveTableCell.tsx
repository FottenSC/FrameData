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
import { OutcomeBadge, OutcomeTagBadge } from "@/components/ui/ValueBadge";
import type { PropertyInfo } from "@/contexts/GameContext";

// Memoised tooltip content — avoids re-creating nodes during virtualisation.
const StanceTooltipContent = React.memo(
  ({ stanceInfo, s }: { stanceInfo: any; s: string }) => (
    <div className="space-y-1">
      <p className="font-semibold">{stanceInfo.name || s}</p>
      {stanceInfo.description && (
        <p className="text-xs text-muted-foreground whitespace-pre-wrap">
          {stanceInfo.description}
        </p>
      )}
    </div>
  ),
);

const PropertyTooltipContent = React.memo(
  ({ propInfo, p }: { propInfo: any; p: string }) => (
    <div className="space-y-1">
      <p className="font-semibold">{propInfo.name || p}</p>
      {propInfo.description && (
        <p className="text-xs text-muted-foreground whitespace-pre-wrap">
          {propInfo.description}
        </p>
      )}
    </div>
  ),
);

type BadgeMap = Record<string, { className: string }>;

interface MoveTableCellProps {
  move: Move;
  columnId: string;
  renderCommand: (command: string[] | null) => React.ReactNode;
  renderNotes: (note: string | null) => React.ReactNode;
  copyCommand: (move: Move) => void;
  getStanceInfo: (stance: string, characterId: number) => any;
  /**
   * Property / outcome-tag lookup. The same `properties` registry from Game.json
   * drives both the Properties column and the tag chips shown inside outcome
   * cells (KND/LNC/STN/etc).
   */
  getPropertyInfo: (prop: string) => PropertyInfo | null;
  badges?: BadgeMap;
}

export const MoveTableCell: React.FC<MoveTableCellProps> = React.memo(
  ({
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
        if (!move.stance || move.stance.length === 0) return <>—</>;
        return (
          <div className="flex flex-wrap gap-0.5 justify-end">
            {move.stance
              .filter((s) => s && s.trim() !== "")
              .map((s, i) => {
                const stanceInfo = getStanceInfo(s, move.characterId);
                const hasTooltipContent =
                  stanceInfo &&
                  ((stanceInfo.name && stanceInfo.name !== s) ||
                    stanceInfo.description);

                const chip = (
                  <Badge
                    variant="secondary"
                    className="whitespace-nowrap border border-gray-500"
                  >
                    {s}
                  </Badge>
                );
                if (!hasTooltipContent) {
                  return <React.Fragment key={i}>{chip}</React.Fragment>;
                }
                return (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>{chip}</TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <StanceTooltipContent stanceInfo={stanceInfo} s={s} />
                    </TooltipContent>
                  </Tooltip>
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
        return <>{move.damage.total ?? move.damage.raw ?? "—"}</>;

      case "block":
        return (
          <OutcomeBadge
            outcome={move.block}
            badges={badges}
            getTagInfo={getPropertyInfo}
          />
        );

      case "hit":
        return (
          <OutcomeBadge
            outcome={move.hit}
            badges={badges}
            getTagInfo={getPropertyInfo}
          />
        );

      case "counterHit":
        return (
          <OutcomeBadge
            outcome={move.counterHit}
            badges={badges}
            getTagInfo={getPropertyInfo}
          />
        );

      case "guardBurst":
        return (
          <OutcomeBadge
            outcome={{
              advantage: move.guardBurst ?? null,
              tags: [],
              raw: null,
            }}
            forceNoSign
            badges={badges}
          />
        );

      case "properties":
        if (!move.properties.length) return <>—</>;
        return (
          <div className="flex flex-wrap gap-0.5">
            {move.properties.map((prop) => {
              const info = getPropertyInfo(prop);
              return (
                <OutcomeTagBadge
                  key={prop}
                  tag={prop}
                  badges={badges}
                  info={info ?? null}
                />
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
  },
);

MoveTableCell.displayName = "MoveTableCell";
