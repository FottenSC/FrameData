import React from "react";
import { ChevronRight } from "lucide-react";
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
    setIsExpanded((prev) => !prev);
  };

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
};
