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
import { ChipTooltipContent } from "@/components/ui/chip-tooltip";
import type { PropertyInfo } from "@/contexts/GameContext";

type BadgeMap = Record<string, { className: string }>;

interface MoveTableCellProps {
  move: Move;
  columnId: string;
  renderCommand: (command: string[][] | null) => React.ReactNode;
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
 * Render the contents of a single outcome cell (Block / Hit / Counter-Hit).
 * Centralised so all three channels share identical rules:
 *
 *   1. If there's a numeric advantage, show the AdvantagePill.
 *   2. Else if there are tags UNIQUE to this outcome (not already a
 *      move-wide property), show them as PropertyChips. Anything that's
 *      also in `move.properties` is filtered out here — it's already
 *      covered by the Properties column, so duplicating it on the outcome
 *      cell just clutters the row. Example: a move with UA in properties
 *      and KND in hit.tags renders as just "KND" in the Hit cell.
 *   3. Else, neutral "—".
 */
function renderOutcomeCell(
  advantage: number | null,
  tags: string[],
  moveProperties: string[],
  sources: PropertySources,
  getPropertyInfo: (prop: string) => PropertyInfo | null,
  badges: BadgeMap | undefined,
): React.ReactNode {
  if (advantage !== null) {
    return <AdvantagePill advantage={advantage} />;
  }
  // Strip out tags that are already represented as move-wide properties.
  // UA, for instance, is echoed into every outcome's tags array by the
  // data pipeline so per-channel filters work — but the Properties column
  // is where it belongs visually.
  const propertySet = new Set(moveProperties);
  const outcomeOnlyTags = tags.filter((t) => !propertySet.has(t));
  if (outcomeOnlyTags.length > 0) {
    return (
      <div className="flex flex-wrap gap-0.5 justify-center">
        {outcomeOnlyTags.map((tag) => (
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
  return <AdvantagePill advantage={null} />;
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
                const hasTooltip =
                  !!stanceInfo &&
                  ((stanceInfo.name && stanceInfo.name !== s) ||
                    !!stanceInfo.description);

                const chip = (
                  <Badge
                    variant="secondary"
                    className="whitespace-nowrap border border-zinc-500"
                  >
                    {s}
                  </Badge>
                );
                if (!hasTooltip) {
                  return <React.Fragment key={i}>{chip}</React.Fragment>;
                }
                return (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>{chip}</TooltipTrigger>
                    <TooltipContent>
                      <ChipTooltipContent
                        code={s}
                        title={stanceInfo.name || s}
                        description={stanceInfo.description}
                      />
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

      // --- Outcome columns ---
      //
      //   has advantage  → numeric pill (green / rose / zinc).
      //   no advantage,
      //   has tags       → the tag(s) rendered via PropertyChip, so the
      //                    chip looks IDENTICAL to its counterpart in the
      //                    Properties column. Outcome-cell chips carry
      //                    only their own channel in `sources`, so the
      //                    tooltip still confirms e.g. "Applies on: hit".
      //   nothing at all → neutral "—" pill.
      //
      // Players keep a quick visual for pure-tag outcomes (e.g. "KND on
      // hit, no number"), without any cross-column colour mismatch.
      case "block":
        return renderOutcomeCell(
          move.block.advantage,
          move.block.tags,
          move.properties,
          { onBlock: true },
          getPropertyInfo,
          badges,
        );

      case "hit":
        return renderOutcomeCell(
          move.hit.advantage,
          move.hit.tags,
          move.properties,
          { onHit: true },
          getPropertyInfo,
          badges,
        );

      case "counterHit":
        return renderOutcomeCell(
          move.counterHit.advantage,
          move.counterHit.tags,
          move.properties,
          { onCounterHit: true },
          getPropertyInfo,
          badges,
        );

      case "guardBurst":
        return (
          <AdvantagePill advantage={move.guardBurst ?? null} tone="guard" />
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
