import React from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { HitLevelIcon } from "./HitLevelIcon";

export const ExpandableHitLevels: React.FC<{
  hitLevelString: string[] | null;
  maxIconsToShow?: number;
}> = ({ hitLevelString, maxIconsToShow = 3 }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const levels = !hitLevelString ? ([] as string[]) : hitLevelString;

  const canExpand = levels.length > maxIconsToShow + 1;
  const handleToggle = () => {
    if (!canExpand) return;
    // Wrap the state flip in `startTransition` so React treats the
    // expand/collapse as a non-urgent update. The click feedback paints
    // immediately, the heavy work — mounting the additional
    // HitLevelIcon + Tooltip subtrees and the virtualizer's row-height
    // remeasure that follows — runs in the background frame and can be
    // interrupted by other input. Without this, expanding a row with
    // 12+ levels in a long virtualised table noticeably stutters.
    React.startTransition(() => {
      setIsExpanded((prev) => !prev);
    });
  };

  if (levels.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  // Always RENDER all icons; just hide the overflow when collapsed via
  // CSS. That way the costly per-icon mount work (Tooltip wrapper,
  // useGame subscription) happens once on row mount — amortised by the
  // virtualizer — instead of all at once on expand. Toggle is then a
  // pure class swap, which is what makes the interaction feel instant.
  //
  // The few rows that have ≤ maxIconsToShow + 1 levels go through the
  // simpler always-visible branch at the bottom of the JSX.
  const trailingChevron = canExpand
    ? isExpanded
      ? "collapse"
      : "expand"
    : null;

  if (!canExpand) {
    // Short list: nothing to expand; render as-is.
    return (
      <div className="flex flex-wrap items-center gap-1">
        {levels.map((level, index) => (
          <div key={`${level}-${index}`}>
            <HitLevelIcon level={level} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-1 cursor-pointer`}
      onClick={handleToggle}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      aria-label={
        isExpanded ? "Collapse hit-level list" : "Expand hit-level list"
      }
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleToggle();
        }
      }}
    >
      {levels.map((level, index) => {
        // Hide the overflow with CSS instead of React-omitting it; the
        // mount work is paid once per row and toggling is free.
        const hidden = !isExpanded && index >= maxIconsToShow;
        return (
          <div
            key={`${level}-${index}`}
            className={hidden ? "hidden" : undefined}
          >
            <HitLevelIcon level={level} />
          </div>
        );
      })}
      {trailingChevron === "expand" && (
        <ChevronRight
          size={16}
          className="text-muted-foreground ml-1"
          aria-hidden
        />
      )}
      {trailingChevron === "collapse" && (
        <ChevronLeft
          size={16}
          className="text-muted-foreground ml-1"
          aria-hidden
        />
      )}
    </div>
  );
};
