import React, { memo } from "react";
import { Badge } from "./badge";

interface ValueBadgeProps {
  value: number | null;
  text: string | null;
  forceNoSign?: boolean;
  badges?: Record<string, { className: string }>;
}

const ValueBadgeInner: React.FC<ValueBadgeProps> = ({
  value,
  text,
  forceNoSign = false,
  badges,
}) => {
  let displayText: string;
  if (text !== null && text !== undefined) {
    displayText = text;
  } else if (value !== null && value !== undefined) {
    displayText = (!forceNoSign && value > 0 ? "+" : "") + value;
  } else {
    displayText = "—";
  }

  const statusKey = text?.toUpperCase?.();
  if (statusKey && badges && badges[statusKey]) {
    return (
      <Badge
        className={`${badges[statusKey].className} w-12 inline-flex items-center justify-center`}
      >
        {displayText}
      </Badge>
    );
  }

  if (value === null || value === undefined) {
    return (
      <Badge className="bg-gray-500 hover:bg-gray-600 text-white w-12 inline-flex items-center justify-center">
        {displayText}
      </Badge>
    );
  }

  if (value >= 0) {
    return (
      <Badge className="bg-green-700 text-white w-12 inline-flex items-center justify-center">
        {displayText}
      </Badge>
    );
  } else {
    return (
      <Badge className="bg-rose-700 text-white w-12 inline-flex items-center justify-center">
        {displayText}
      </Badge>
    );
  }
};

// Memoize to prevent re-renders during table virtualization transitions
export const ValueBadge = memo(ValueBadgeInner);
