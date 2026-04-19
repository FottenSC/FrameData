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

/**
 * Visual tone of an {@link AdvantagePill}.
 *
 *   - `"advantage"` (default) — bi-polar frame advantage: green when ≥ 0,
 *     rose when < 0, gray when null. Used by Block / Hit / Counter-hit.
 *   - `"guard"` — neutral counter (guard damage etc.) that's always a positive
 *     integer. Rendered in amber so it's visually distinct from frame
 *     advantage cells and still has colour instead of dead gray.
 */
type PillTone = "advantage" | "guard";

interface AdvantagePillProps {
  /** Numeric value, or null when unspecified. */
  advantage: number | null;
  /**
   * Drop the +/- sign from the label. Independent of colour — use `tone` for
   * visual variant. Enabled automatically when `tone="guard"`.
   */
  forceNoSign?: boolean;
  /** Visual variant; see {@link PillTone}. */
  tone?: PillTone;
}

const pillBackground = (advantage: number | null, tone: PillTone): string => {
  // Null = "no numeric data" — uses the project's unified neutral grey.
  // Any tag information (KND / LNC / STN / …) lives in the Properties column
  // with its own stone-600 chip; we deliberately don't echo the raw tag into
  // this pill so players never see the same value styled two different ways.
  if (advantage === null) return "bg-zinc-700";
  // Guard damage is a non-negative counter — colour needs to be visually
  // distinct from advantage pills (so it doesn't read as "positive") without
  // competing for attention. Stone sits between the cool neutral zinc and
  // the outcome-tag chips for a subtle differentiation.
  if (tone === "guard") return "bg-stone-600";
  return advantage >= 0 ? "bg-green-700" : "bg-rose-700";
};

export const AdvantagePill = memo<AdvantagePillProps>(
  ({ advantage, forceNoSign, tone = "advantage" }) => {
    // Guard tone always uses the bare number — signs would be nonsensical
    // (guard damage is a non-negative counter).
    const suppressSign = forceNoSign ?? tone === "guard";
    const hasAdvantage = advantage !== null;

    const label = hasAdvantage
      ? !suppressSign && advantage! > 0
        ? "+" + advantage
        : String(advantage)
      : "—";

    return (
      <Badge
        className={`${pillBackground(
          advantage,
          tone,
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
    // Fallback matches the AdvantagePill null pill so an untagged / unknown
    // outcome chip sits in the same neutral grey as the rest of the app.
    const className =
      (info?.className && info.className.trim()) ||
      badges?.[tag]?.className ||
      "bg-zinc-700 text-white";

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
  ({ value, forceNoSign = false }) => (
    <AdvantagePill advantage={value} forceNoSign={forceNoSign} />
  ),
);
ValueBadge.displayName = "ValueBadge";
