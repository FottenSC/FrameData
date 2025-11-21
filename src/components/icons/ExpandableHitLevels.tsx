import React from "react";
import { ChevronRight } from "lucide-react";
import { HitLevelIcon } from "./HitLevelIcon";

export const ExpandableHitLevels = React.memo(
  ({
    hitLevelString,
    maxIconsToShow = 3,
  }: {
    hitLevelString: string | null;
    maxIconsToShow?: number;
  }) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const levels = React.useMemo(() => {
      if (!hitLevelString) return [] as string[];
      return hitLevelString
        .split(/:+/)
        .map((level) => level.trim())
        .filter(Boolean);
    }, [hitLevelString]);

    const canExpand = levels.length > maxIconsToShow + 1;
    const handleToggle = React.useCallback(() => {
      if (!canExpand) return;
      setIsExpanded((prev) => !prev);
    }, [canExpand]);

    if (levels.length === 0) {
      return <span className="text-muted-foreground">—</span>;
    }

    let iconsToShow: number;
    if (levels.length <= maxIconsToShow + 1) {
      iconsToShow = levels.length;
    } else {
      iconsToShow = isExpanded ? levels.length : maxIconsToShow;
    }

    const showEllipsis = canExpand && !isExpanded;
    return (
      <div
        className={`flex flex-wrap items-center gap-1 ${
          canExpand ? "cursor-pointer" : ""
        }`}
        onClick={canExpand ? handleToggle : undefined}
      >
        {levels.slice(0, iconsToShow).map((level, index) => (
          <div key={`${level}-${index}`}>
            <HitLevelIcon level={level} />
          </div>
        ))}

        {showEllipsis && (
          <ChevronRight size={16} className="text-muted-foreground ml-1" />
        )}
      </div>
    );
  },
);
