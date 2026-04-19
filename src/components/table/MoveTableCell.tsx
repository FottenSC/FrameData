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
import {
  AdvantagePill,
  PropertyChip,
  type PropertySources,
} from "@/components/ui/ValueBadge";
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

/**
 * Aggregate the four possible sources of "this move has property X" into a
 * single ordered list of chip descriptors. A property that appears on, say,
 * both hit and counter-hit is collapsed into ONE chip whose tooltip lists
 * both channels.
 *
 * Order: move-wide properties first (so UA / BA / GI etc. stay stable at the
 * left), then outcome-only tags in insertion order.
 */
function aggregateProperties(move: Move): Array<{
  tag: string;
  sources: PropertySources;
}> {
  const map = new Map<string, PropertySources>();

  for (const p of move.properties) {
    const prev = map.get(p) ?? {};
    map.set(p, { ...prev, asMoveProperty: true });
  }
  for (const t of move.hit.tags) {
    const prev = map.get(t) ?? {};
    map.set(t, { ...prev, onHit: true });
  }
  for (const t of move.counterHit.tags) {
    const prev = map.get(t) ?? {};
    map.set(t, { ...prev, onCounterHit: true });
  }
  for (const t of move.block.tags) {
    const prev = map.get(t) ?? {};
    map.set(t, { ...prev, onBlock: true });
  }

  return Array.from(map.entries()).map(([tag, sources]) => ({ tag, sources }));
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

      // --- Outcome columns: advantage number only. Any tag information
      // ---   (KND / LNC / STN / …) lives in the Properties column so we
      // ---   don't render the same chip twice.
      case "block":
        return (
          <AdvantagePill
            advantage={move.block.advantage}
            fallbackText={move.block.raw}
          />
        );

      case "hit":
        return (
          <AdvantagePill
            advantage={move.hit.advantage}
            fallbackText={move.hit.raw}
          />
        );

      case "counterHit":
        return (
          <AdvantagePill
            advantage={move.counterHit.advantage}
            fallbackText={move.counterHit.raw}
          />
        );

      case "guardBurst":
        return (
          <AdvantagePill advantage={move.guardBurst ?? null} forceNoSign />
        );

      // --- Properties column: one chip per unique property. Chips aggregate
      // ---   move-wide properties (UA / BA / GI / …) AND outcome tags from
      // ---   hit / counter-hit / block. A chip's tooltip tells you which
      // ---   channel(s) the tag fires on.
      case "properties": {
        const entries = aggregateProperties(move);
        if (entries.length === 0) return <>—</>;
        return (
          <div className="flex flex-wrap gap-0.5">
            {entries.map(({ tag, sources }) => (
              <PropertyChip
                key={tag}
                tag={tag}
                info={getPropertyInfo(tag) ?? null}
                badges={badges}
                sources={sources}
              />
            ))}
          </div>
        );
      }

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
