import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Channel a property / tag applies on. Also covers the degenerate "move-wide"
 * case for properties (UA / BA / GI / …) that aren't tied to an outcome.
 */
export type SourceChannel = "hit" | "counterHit" | "block" | "move";

const CHANNEL_META: Record<
  SourceChannel,
  { label: string; className: string; dot: string }
> = {
  hit: {
    label: "Hit",
    className: "bg-green-500/15 text-green-300 ring-green-500/30",
    dot: "bg-green-400",
  },
  counterHit: {
    label: "Counter-hit",
    className: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    dot: "bg-amber-400",
  },
  block: {
    label: "Block",
    className: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
    dot: "bg-sky-400",
  },
  move: {
    label: "Move property",
    className: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30",
    dot: "bg-zinc-400",
  },
};

/** Tiny channel pill used inside tooltips. */
export const ChannelBadge: React.FC<{ channel: SourceChannel }> = React.memo(
  ({ channel }) => {
    const meta = CHANNEL_META[channel];
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ring-1",
          meta.className,
        )}
      >
        <span
          className={cn("h-1.5 w-1.5 rounded-full", meta.dot)}
          aria-hidden
        />
        {meta.label}
      </span>
    );
  },
);
ChannelBadge.displayName = "ChannelBadge";

interface ChipTooltipContentProps {
  /**
   * Short code (the text on the chip face itself, e.g. "KND"). Rendered as a
   * small pill in the header. Omit when it would just duplicate the title.
   */
  code?: string;
  /** Human-readable name (e.g. "Knockdown"). Primary tooltip heading. */
  title: string;
  /** Optional paragraph description. Whitespace is preserved. */
  description?: string;
  /**
   * Source channels this value applies on. Rendered as pill-row under a thin
   * divider when non-empty. Used by PropertyChip.
   */
  sources?: SourceChannel[];
}

/**
 * Unified tooltip body used by PropertyChip, HitLevelIcon, stance chips, and
 * preset buttons. Structure:
 *
 *   ┌──────────────────────────────┐
 *   │ [CODE] Title                  │
 *   │                               │
 *   │ Description paragraph.        │
 *   │ ─────────────────             │
 *   │ [Hit] [Counter-hit]           │
 *   └──────────────────────────────┘
 *
 * All sections are optional except `title`. Tooltip callers only need to pass
 * the fields they have, keeping the surrounding call sites simple.
 */
export const ChipTooltipContent: React.FC<ChipTooltipContentProps> = ({
  code,
  title,
  description,
  sources,
}) => {
  const showCodePill = code && code !== title;
  const hasSources = sources && sources.length > 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        {showCodePill && (
          <span className="inline-flex h-5 items-center rounded bg-white/10 px-1.5 font-mono text-[11px] font-semibold tracking-wide text-zinc-100">
            {code}
          </span>
        )}
        <p className="text-[13px] font-semibold leading-none">{title}</p>
      </div>
      {description && (
        <p className="whitespace-pre-wrap text-[12px] leading-snug text-zinc-300">
          {description}
        </p>
      )}
      {hasSources && (
        <>
          <div className="my-0.5 h-px w-full bg-white/10" aria-hidden />
          <div className="flex flex-wrap items-center gap-1">
            {sources!.map((c) => (
              <ChannelBadge key={c} channel={c} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
