import React, { memo } from "react";
import { Badge } from "./badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { MoveOutcome } from "@/types/Move";

type BadgeMap = Record<string, { className: string }>;

interface OutcomeBadgeProps {
  /** The full outcome (advantage + tags + raw). */
  outcome: MoveOutcome;
  /**
   * Per-game badge style map keyed by outcome tag (KND, LNC, STN, ...).
   * Used to color the tag chips.
   */
  badges?: BadgeMap;
  /**
   * Tag → descriptive info (name/description) for tooltip rendering.
   * Optional; pass from the game context.
   */
  getTagInfo?: (
    tag: string,
  ) => { name?: string; description?: string; className?: string } | null;
  /** Suppress advantage sign prefix (used for neutral counters like guard burst). */
  forceNoSign?: boolean;
}

/**
 * Small colored chip for a single outcome tag (KND, LNC, STN...).
 *
 * Split out so it can be reused both here and in the properties column.
 */
export const OutcomeTagBadge = memo<{
  tag: string;
  badges?: BadgeMap;
  info?: { name?: string; description?: string; className?: string } | null;
}>(({ tag, badges, info }) => {
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
  const hasTooltip =
    info && ((info.name && info.name !== tag) || info.description);
  if (!hasTooltip) return chip;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <div className="space-y-1">
          <p className="font-semibold">{info!.name || tag}</p>
          {info!.description && (
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
              {info!.description}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
});
OutcomeTagBadge.displayName = "OutcomeTagBadge";

/**
 * Render a structured move outcome: advantage pill + one tag chip per tag.
 *
 * Replaces the older `<ValueBadge value={...} text={...} />` pattern which only
 * displayed one of (advantage OR tag) at a time. Now a move that is e.g.
 * "+28 on hit, knockdown" renders both the "+28" pill *and* a "KND" chip side
 * by side, which is exactly how players think about it.
 */
const OutcomeBadgeInner: React.FC<OutcomeBadgeProps> = ({
  outcome,
  badges,
  getTagInfo,
  forceNoSign = false,
}) => {
  const { advantage, tags, raw } = outcome;
  const hasAdvantage = advantage !== null;
  const hasTags = tags.length > 0;

  if (!hasAdvantage && !hasTags) {
    return (
      <Badge className="bg-gray-700 text-white w-12 inline-flex items-center justify-center">
        {raw ?? "—"}
      </Badge>
    );
  }

  // Advantage pill colour: positive = green, negative = rose, forced-no-sign = neutral.
  const advancePill = hasAdvantage ? (
    <Badge
      className={
        (forceNoSign
          ? "bg-zinc-700"
          : advantage! >= 0
            ? "bg-green-700"
            : "bg-rose-700") +
        " text-white w-12 inline-flex items-center justify-center"
      }
    >
      {!forceNoSign && advantage! > 0 ? "+" + advantage : advantage}
    </Badge>
  ) : null;

  return (
    <div className="flex items-center gap-1 flex-wrap justify-center">
      {advancePill}
      {tags.map((tag) => (
        <OutcomeTagBadge
          key={tag}
          tag={tag}
          badges={badges}
          info={getTagInfo?.(tag) ?? null}
        />
      ))}
    </div>
  );
};

export const OutcomeBadge = memo(OutcomeBadgeInner);

// ---------------------------------------------------------------------------
// Back-compat shim
// ---------------------------------------------------------------------------
//
// Older callers pass `value` + `text` directly. Keep this thin adapter so we
// don't have to rewrite every consumer at once. New code should use
// <OutcomeBadge outcome={...} /> directly.

interface LegacyValueBadgeProps {
  value: number | null;
  text: string | null;
  forceNoSign?: boolean;
  badges?: BadgeMap;
}

export const ValueBadge = memo<LegacyValueBadgeProps>(
  ({ value, text, forceNoSign = false, badges }) => (
    <OutcomeBadge
      outcome={{ advantage: value ?? null, tags: [], raw: text ?? null }}
      forceNoSign={forceNoSign}
      badges={badges}
    />
  ),
);
ValueBadge.displayName = "ValueBadge";
