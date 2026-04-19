import React, { memo } from "react";
import { Badge } from "./badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChipTooltipContent,
  type SourceChannel,
} from "@/components/ui/chip-tooltip";

type BadgeMap = Record<string, { className: string }>;

// ---------------------------------------------------------------------------
// Advantage pill
// ---------------------------------------------------------------------------
//
// Numeric-only pill shown inside Block / Hit / Counter-Hit cells. Outcome
// tags (KND, LNC, STN, …) used to be rendered alongside the pill; they've
// since been moved to the Properties column where the whole "what does this
// move do" vocabulary lives together. That leaves these cells with a single
// job: show the frame advantage.

interface AdvantagePillProps {
  /** Numeric frame advantage, or null when unspecified. */
  advantage: number | null;
  /**
   * Fallback string shown when there's no numeric advantage (e.g. moves
   * authored as "KND" with no number). Typically `outcome.raw`.
   */
  fallbackText?: string | null;
  /** Drop the +/- sign (for counters like guard burst). */
  forceNoSign?: boolean;
}

const pillClass = (advantage: number | null, forceNoSign: boolean): string => {
  if (advantage === null) return "bg-gray-700";
  if (forceNoSign) return "bg-zinc-700";
  return advantage >= 0 ? "bg-green-700" : "bg-rose-700";
};

export const AdvantagePill = memo<AdvantagePillProps>(
  ({ advantage, fallbackText, forceNoSign = false }) => {
    const hasAdvantage = advantage !== null;

    const label = hasAdvantage
      ? !forceNoSign && advantage! > 0
        ? "+" + advantage
        : String(advantage)
      : (fallbackText ?? "—");

    return (
      <Badge
        className={`${pillClass(
          advantage,
          forceNoSign,
        )} text-white w-12 inline-flex items-center justify-center`}
      >
        {label}
      </Badge>
    );
  },
);
AdvantagePill.displayName = "AdvantagePill";

// ---------------------------------------------------------------------------
// Property chip
// ---------------------------------------------------------------------------
//
// Small colored chip used in the Properties column for both move-wide
// properties (UA, BA, GI, …) and on-outcome tags (KND, LNC, STN, …).
//
// When a tag is attached to a specific outcome channel — i.e. it fires on hit,
// on counter-hit, or on block — the tooltip tells you which. A single chip
// therefore carries three pieces of info:
//   1. the tag code on the chip face
//   2. the registry-declared name + description (from Game.json `properties`)
//   3. the channels it applies on

export interface PropertySources {
  /** True when this tag is listed in move.properties (move-wide). */
  asMoveProperty?: boolean;
  /** True when this tag appears in move.hit.tags. */
  onHit?: boolean;
  /** True when this tag appears in move.counterHit.tags. */
  onCounterHit?: boolean;
  /** True when this tag appears in move.block.tags. */
  onBlock?: boolean;
}

interface PropertyChipProps {
  /** The tag code, e.g. "KND". */
  tag: string;
  /** Descriptor from Game.json#properties, if any. */
  info?: { name?: string; description?: string; className?: string } | null;
  /** Per-game quick-style map (fallback if info.className is absent). */
  badges?: BadgeMap;
  /** Which channel(s) this tag came from on the current move. */
  sources: PropertySources;
}

function sourceChannels(sources: PropertySources): SourceChannel[] {
  // Move-wide properties (UA / BA / GI / ...) are by definition true across
  // every outcome channel. The data pipeline echoes UA into each outcome's
  // tag list so per-channel filters still work — but in the tooltip we
  // collapse to a single "Move property" pill to avoid a noisy row of four
  // nearly-identical chips that all say the same thing.
  if (sources.asMoveProperty) return ["move"];

  const out: SourceChannel[] = [];
  if (sources.onHit) out.push("hit");
  if (sources.onCounterHit) out.push("counterHit");
  if (sources.onBlock) out.push("block");
  return out;
}

export const PropertyChip = memo<PropertyChipProps>(
  ({ tag, info, badges, sources }) => {
    const className =
      (info?.className && info.className.trim()) ||
      badges?.[tag]?.className ||
      "bg-gray-700 text-white";

    const chip = (
      <Badge
        className={`whitespace-nowrap border text-xs font-semibold inline-flex items-center justify-center ${className}`}
      >
        {tag}
      </Badge>
    );

    const channels = sourceChannels(sources);
    const hasName = !!(info?.name && info.name !== tag);
    const hasDescription = !!info?.description;
    const hasTooltip = hasName || hasDescription || channels.length > 0;

    if (!hasTooltip) return chip;

    return (
      <Tooltip>
        <TooltipTrigger asChild>{chip}</TooltipTrigger>
        <TooltipContent>
          <ChipTooltipContent
            code={tag}
            title={info?.name || tag}
            description={info?.description}
            sources={channels}
          />
        </TooltipContent>
      </Tooltip>
    );
  },
);
PropertyChip.displayName = "PropertyChip";

// Legacy export kept so other call sites can still import it. `OutcomeTagBadge`
// is a thin pass-through to PropertyChip (no source annotation), useful when
// rendering a tag chip outside the move-row context.
export const OutcomeTagBadge = memo<{
  tag: string;
  badges?: BadgeMap;
  info?: { name?: string; description?: string; className?: string } | null;
}>(({ tag, badges, info }) => (
  <PropertyChip tag={tag} badges={badges} info={info} sources={{}} />
));
OutcomeTagBadge.displayName = "OutcomeTagBadge";

// ---------------------------------------------------------------------------
// Legacy ValueBadge shim (for any remaining callers). New code should prefer
// AdvantagePill directly.
// ---------------------------------------------------------------------------

interface LegacyValueBadgeProps {
  value: number | null;
  text: string | null;
  forceNoSign?: boolean;
  badges?: BadgeMap;
}

export const ValueBadge = memo<LegacyValueBadgeProps>(
  ({ value, text, forceNoSign = false }) => (
    <AdvantagePill
      advantage={value}
      fallbackText={text}
      forceNoSign={forceNoSign}
    />
  ),
);
ValueBadge.displayName = "ValueBadge";
