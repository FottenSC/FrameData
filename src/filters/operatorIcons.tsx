import * as React from "react";
import {
  Equal,
  EqualNot,
  Search,
  ChevronsRight,
  ChevronsUp,
  ChevronsDown,
  ArrowLeftRight,
  ArrowLeftRightIcon,
  Layers,
  Layers2,
  CircleSlash,
  Sparkles,
} from "lucide-react";

/**
 * Per-operator icons shown to the left of the label inside the
 * "condition" dropdown. Keyed by the operator's `id` from
 * `src/filters/operators.ts` and `gameFilterConfigs.ts#customOperators`.
 *
 * Why a separate map (instead of putting `icon` on FilterOperator):
 *   - The operator definition is data, the icon is presentation. We
 *     don't want server / data files importing JSX to stay tree-shake
 *     friendly and so the operator predicates can be unit-tested
 *     without React.
 *   - This map can be augmented per-game in the future if a game-
 *     specific operator wants its own glyph.
 *
 * Fallback: anything not listed gets a generic Sparkles icon so the
 * dropdown still has consistent geometry.
 */
type IconCmp = React.ComponentType<{ className?: string }>;

export const OPERATOR_ICONS: Record<string, IconCmp> = {
  // Numeric / scalar
  equals: Equal,
  notEquals: EqualNot,
  greaterThan: ChevronsUp,
  lessThan: ChevronsDown,
  between: ArrowLeftRight,
  notBetween: ArrowLeftRightIcon,

  // Text / freeform
  contains: Search,
  startsWith: ChevronsRight,
  quickContains: Search,

  // Multi-select set ops
  inList: Layers, // "Any of"
  allOf: Layers2, // "All of"
  notIn: CircleSlash, // "Not in"
};

const FallbackIcon: IconCmp = Sparkles;

export const OperatorIcon: React.FC<{
  operatorId: string;
  className?: string;
}> = ({ operatorId, className }) => {
  const Cmp = OPERATOR_ICONS[operatorId] ?? FallbackIcon;
  return <Cmp className={className} />;
};
