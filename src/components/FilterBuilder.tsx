import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { Plus, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Move, FilterCondition } from "../types/Move";
import { useGame } from "../contexts/GameContext";
import { gameFilterConfigs } from "../filters/gameFilterConfigs";
import { builtinOperators, operatorById } from "../filters/operators";
import type {
  FieldType,
  FilterOperator,
  FieldConfig,
  GameFilterConfig,
} from "../filters/types";
import { MultiCombobox } from "./ui/multi-combobox";
import { HitLevelMultiCombobox } from "./ui/hitlevel-multi-combobox";
import { Combobox } from "./ui/combobox";

// Re-export FilterCondition for backwards compatibility
export type { FilterCondition } from "../types/Move";

export const ActiveFiltersBadge: React.FC<{
  count: number;
  className?: string;
}> = ({ count, className }) => {
  return (
    <Badge
      variant="outline"
      className={cn("ml-2 text-xs font-normal", className)}
    >
      {count} {count === 1 ? "filter" : "filters"}
    </Badge>
  );
};

interface FilterBuilderProps {
  onFiltersChange: (filters: FilterCondition[]) => void;
  className?: string;
  moves?: Move[];
}

// Use React.memo to prevent re-renders if props haven't changed
export const FilterBuilder = React.memo<FilterBuilderProps>(
  ({ onFiltersChange, className, moves = [] }) => {
    const { selectedGame } = useGame();
    const gameConfig: GameFilterConfig = useMemo(
      () => gameFilterConfigs[selectedGame.id] ?? { fields: [] },
      [selectedGame.id],
    );
    const allOperators: FilterOperator[] = useMemo(() => {
      const customs = gameConfig.customOperators ?? [];
      // Merge by id, allowing custom operators to override
      const map = new Map<string, FilterOperator>();
      for (const op of builtinOperators) map.set(op.id, op);
      for (const op of customs) map.set(op.id, op);
      return Array.from(map.values());
    }, [gameConfig]);
    const operatorsById = useMemo(
      () => operatorById(allOperators),
      [allOperators],
    );
    const fieldMap = useMemo(
      () => new Map(gameConfig.fields.map((f) => [f.id, f as FieldConfig])),
      [gameConfig.fields],
    );
    const [filters, setFilters] = useState<FilterCondition[]>([]);
    const defaultFilterAdded = useRef(false);
    const [fieldRanges, setFieldRanges] = useState<
      Record<string, { min: number; max: number }>
    >({});
    const previousActiveFiltersRef = useRef<string | null>(null); // Ref to store last sent filters

    // Calculate field range values based on actual move data
    useEffect(() => {
      if (moves.length > 0) {
        const ranges: Record<string, { min: number; max: number }> = {};

        // Initialize with default fallback ranges
        const defaultRanges: Record<string, { min: number; max: number }> = {
          impact: { min: 0, max: 500 },
          damage: { min: 0, max: 500 },
          block: { min: -30, max: 500 },
          hit: { min: -30, max: 30 },
          counterHit: { min: -30, max: 30 },
          guardBurst: { min: 0, max: 100 },
        };

        // Start with default ranges
        Object.assign(ranges, defaultRanges);

        // Helper function to get field value from a move
        const getFieldValue = (move: Move, field: string): number | null => {
          switch (field) {
            case "impact":
              return move.Impact ?? null;
            case "damage":
              return move.DamageDec ?? null;
            case "block":
              return move.BlockDec ?? null;
            case "hit":
              return move.HitDec ?? null;
            case "counterHit":
              return move.CounterHitDec ?? null;
            case "guardBurst":
              return move.GuardBurst ?? null;
            default:
              return null;
          }
        };

        // Iterate through numeric fields to find min/max values
        gameConfig.fields.forEach((field) => {
          if (field.type === "number") {
            let min = Number.MAX_SAFE_INTEGER;
            let max = Number.MIN_SAFE_INTEGER;
            let hasValidValues = false;

            // Check each move for this field
            moves.forEach((move) => {
              const value = getFieldValue(move, field.id);
              if (value !== null && value !== undefined && !isNaN(value)) {
                min = Math.min(min, value);
                max = Math.max(max, value);
                hasValidValues = true;
              }
            });

            // Only update if we found valid values
            if (hasValidValues) {
              // Add some padding to the ranges
              const padding = Math.max(1, Math.round((max - min) * 0.1)); // 10% padding
              ranges[field.id] = {
                min: Math.floor(min - padding),
                max: Math.ceil(max + padding),
              };
            }
          }
        });

        setFieldRanges(ranges);
      }
    }, [moves, gameConfig.fields]);

    // --- Helper functions (memoized if necessary, but these are simple lookups) ---
    const getFieldType = useCallback(
      (fieldId: string): FieldType => {
        const field = fieldMap.get(fieldId);
        return field ? field.type : "text";
      },
      [fieldMap],
    );

    const isRangeCondition = useCallback(
      (conditionId: string): boolean => {
        const op = operatorsById.get(conditionId);
        return op ? op.input === "range" : false;
      },
      [operatorsById],
    );

    const getAvailableConditions = (fieldId: string): FilterOperator[] => {
      const field = fieldMap.get(fieldId);
      if (!field) return allOperators;
      const allowed =
        field.allowedOperators && field.allowedOperators.length > 0
          ? new Set(field.allowedOperators)
          : null;
      return allOperators.filter(
        (op) =>
          op.appliesTo.includes(field.type) && (!allowed || allowed.has(op.id)),
      );
    };

    // Memoize the active filter calculation based on the filters state
    const currentActiveFilters = useMemo(() => {
      return filters.filter((filter) => {
        const isRange =
          filter.condition === "between" || filter.condition === "notBetween";
        if (isRange) {
          return (
            filter.value.trim() !== "" &&
            filter.value2 != null &&
            filter.value2.trim() !== ""
          );
        }
        return filter.value.trim() !== "";
      });
    }, [filters]);

    // Notify parent when the active filters have meaningfully changed
    useEffect(() => {
      const currentActiveFiltersString = JSON.stringify(currentActiveFilters);

      if (currentActiveFiltersString !== previousActiveFiltersRef.current) {
        if (typeof React.startTransition === "function") {
          React.startTransition(() => onFiltersChange(currentActiveFilters));
        } else {
          onFiltersChange(currentActiveFilters);
        }
        previousActiveFiltersRef.current = currentActiveFiltersString;
      }
    }, [currentActiveFilters, onFiltersChange]); // Depend on the memoized value & the prop

    // Create a default filter exactly once if none exists
    useEffect(() => {
      if (filters.length === 0 && !defaultFilterAdded.current) {
        addFilter();
        defaultFilterAdded.current = true;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.length]); // Dependency on addFilter removed as it's memoized now

    // --- Memoized Callbacks for filter manipulation ---
    const addFilter = useCallback(() => {
      const desired = "input"; // prefer combined stance+command
      const hasDesired = gameConfig.fields.some((f) => f.id === desired);
      const fallback = "impact";
      const defaultField = hasDesired
        ? desired
        : gameConfig.fields.some((f) => f.id === fallback)
          ? fallback
          : (gameConfig.fields[0]?.id ?? desired);
      const fType = getFieldType(defaultField);
      const available = getAvailableConditions(defaultField);
      const defaultCondition = available[0]?.id ?? "equals";
      const newFilter: FilterCondition = {
        id: `filter-${Date.now()}`,
        field: defaultField,
        numericField: fType === "number" ? defaultField : null,
        condition: defaultCondition,
        value: "",
        value2: "",
      };
      setFilters((prevFilters) => [...prevFilters, newFilter]);
    }, [gameConfig.fields, getFieldType]); // No dependencies

    const removeFilter = useCallback(
      (id: string) => {
        setFilters((currentFilters) => {
          if (currentFilters.length === 1) {
            const desired = "input";
            const hasDesired = gameConfig.fields.some((f) => f.id === desired);
            const fallback = "impact";
            const firstField = hasDesired
              ? desired
              : gameConfig.fields.some((f) => f.id === fallback)
                ? fallback
                : (gameConfig.fields[0]?.id ?? desired);
            const fType = getFieldType(firstField);
            return [
              {
                id: `filter-${Date.now()}`,
                field: firstField,
                numericField: fType === "number" ? firstField : null,
                condition:
                  getAvailableConditions(firstField)[0]?.id ?? "equals",
                value: "",
                value2: "",
              },
            ];
          } else {
            return currentFilters.filter((f) => f.id !== id);
          }
        });
      },
      [gameConfig.fields, getFieldType],
    ); // No dependencies

    // updateFilter depends on helpers
    const updateFilter = useCallback(
      (id: string, property: keyof FilterCondition, value: string) => {
        const doUpdate = () =>
          setFilters((prevFilters) =>
            prevFilters.map((filter) => {
              if (filter.id === id) {
                const updatedFilter = {
                  ...filter,
                  [property]: value,
                };
                const checkIsRange = (cond: string) =>
                  cond === "between" || cond === "notBetween";

                if (property === "field") {
                  // Get types of old and new fields
                  const oldFieldType = getFieldType(filter.field);
                  const newFieldType = getFieldType(value);

                  // Update numericField based on the new field type
                  updatedFilter.numericField =
                    newFieldType === "number" ? value : null;

                  // Check and update condition if needed for the new field type
                  const available = getAvailableConditions(value);
                  if (!available.some((c) => c.id === filter.condition)) {
                    updatedFilter.condition = available[0]?.id || "equals";
                  }

                  // Reset values ONLY if field types are incompatible
                  if (oldFieldType !== newFieldType) {
                    updatedFilter.value = "";
                    updatedFilter.value2 = "";
                  }
                  // If types match, existing values in updatedFilter remain untouched
                } else if (property === "condition") {
                  // Clear value2 if switching away from a range condition
                  if (!checkIsRange(value) && checkIsRange(filter.condition)) {
                    updatedFilter.value2 = "";
                  }
                }
                // No special logic needed when just 'value' or 'value2' changes

                return updatedFilter;
              }
              return filter;
            }),
          );
        // For value/value2 changes, transition to keep input snappy
        if (property === "value" || property === "value2") {
          if (typeof React.startTransition === "function") {
            React.startTransition(doUpdate);
            return;
          }
        }
        doUpdate();
        // Depend only on stable getFieldType
      },
      [getFieldType],
    );

    return (
      <div className={cn("mb-4 custom-filter-builder", className)}>
        <div className="p-4 border rounded-md bg-card space-y-4">
          {/* Filter rows */}
          <div className="space-y-2">
            {filters.map((filter) => {
              const fieldType = getFieldType(filter.field);
              const availableConditions = getAvailableConditions(filter.field);
              const showRange = isRangeCondition(filter.condition);
              const isActive = showRange
                ? filter.value.trim() !== "" &&
                  filter.value2 != null &&
                  filter.value2.trim() !== ""
                : filter.value.trim() !== "";

              return (
                <FilterRow
                  key={filter.id}
                  filter={filter}
                  isActive={isActive}
                  fieldType={fieldType}
                  availableConditions={availableConditions}
                  showRange={showRange}
                  updateFilter={updateFilter} // Pass memoized updateFilter
                  removeFilter={removeFilter} // Pass memoized removeFilter
                  fields={gameConfig.fields}
                />
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex justify-start items-center">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
              onClick={addFilter} // Use memoized callback
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Filter</span>
            </Button>
          </div>
        </div>
      </div>
    );
  },
);

// Explicitly set displayName for React DevTools
FilterBuilder.displayName = "FilterBuilder";

// --- New Memoized FilterRow Component ---
interface FilterRowProps {
  filter: FilterCondition;
  isActive: boolean;
  fieldType: FieldType;
  availableConditions: FilterOperator[];
  showRange: boolean;
  updateFilter: (
    id: string,
    property: keyof FilterCondition,
    value: string,
  ) => void;
  removeFilter: (id: string) => void;
  fields: FieldConfig[];
}

const FilterRow = React.memo<FilterRowProps>(
  ({
    filter,
    isActive,
    fieldType,
    availableConditions,
    showRange,
    updateFilter,
    removeFilter,
    fields,
  }) => {
    const field = fields.find((f) => f.id === filter.field);
    const isEnum = fieldType === "enum";
    const multi =
      availableConditions.find((op) => op.id === filter.condition)?.input ===
      "multi";
    return (
      <div
        className={`flex items-center gap-2 filter-row ${isActive ? "active" : "inactive"}`}
      >
        <Combobox
          value={filter.field}
          onChange={(val) => val && updateFilter(filter.id, "field", val)}
          options={fields.map((f) => ({
            label: f.label,
            value: f.id,
          }))}
          placeholder="Field"
          className="w-[160px]"
        />
        {(() => {
          const disabled = availableConditions.length <= 1;
          return (
            <Select
              value={filter.condition}
              onValueChange={(value) => {
                if (!disabled) updateFilter(filter.id, "condition", value);
              }}
            >
              <SelectTrigger
                className="w-[140px] custom-select-trigger"
                disabled={disabled}
              >
                <SelectValue placeholder="Condition" />
              </SelectTrigger>
              <SelectContent>
                {availableConditions.map((op) => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        })()}
        {showRange ? (
          <div className="flex items-center gap-2">
            <Input
              type={fieldType === "number" ? "number" : "text"}
              value={filter.value}
              onChange={(e) => updateFilter(filter.id, "value", e.target.value)}
              placeholder="Min"
              className="w-[80px] custom-input text-sm h-8"
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type={fieldType === "number" ? "number" : "text"}
              value={filter.value2 || ""}
              onChange={(e) =>
                updateFilter(filter.id, "value2", e.target.value)
              }
              placeholder="Max"
              className="w-[80px] custom-input text-sm h-8"
            />
          </div>
        ) : isEnum ? (
          multi ? (
            field?.id === "hitLevel" ? (
              <HitLevelMultiCombobox
                value={(filter.value || "")
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)}
                onChange={(vals) =>
                  updateFilter(filter.id, "value", vals.join(","))
                }
                options={(field?.options ?? []).map((o) => ({
                  value: o.value,
                }))}
                placeholder="Select..."
              />
            ) : (
              <MultiCombobox
                value={(filter.value || "")
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)}
                onChange={(vals) =>
                  updateFilter(filter.id, "value", vals.join(","))
                }
                options={(field?.options ?? []).map((o) => ({
                  label: o.label ?? o.value,
                  value: o.value,
                }))}
                placeholder="Select..."
              />
            )
          ) : (
            <Select
              value={filter.value}
              onValueChange={(value) => updateFilter(filter.id, "value", value)}
            >
              <SelectTrigger className="w-[180px] custom-select-trigger">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {(field?.options ?? []).map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label ?? opt.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        ) : (
          <Input
            type={fieldType === "number" ? "number" : "text"}
            value={filter.value}
            onChange={(e) => updateFilter(filter.id, "value", e.target.value)}
            placeholder="Value"
            className="w-[180px] custom-input"
          />
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 p-0 hover:bg-destructive/20"
          onClick={() => removeFilter(filter.id)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.filter === next.filter &&
      prev.isActive === next.isActive &&
      prev.fieldType === next.fieldType &&
      prev.showRange === next.showRange &&
      prev.availableConditions === next.availableConditions &&
      prev.fields === next.fields
    );
  },
);
FilterRow.displayName = "FilterRow";
// --- End FilterRow Component ---
