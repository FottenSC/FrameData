import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { X, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
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
import {
  Move,
  FilterCondition,
  FilterGroup,
  FilterItem,
  FilterGroupOperator,
} from "../types/Move";
import { useGame } from "../contexts/GameContext";
import { getGameFilterConfig } from "../filters/gameFilterConfigs";
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

export type {
  FilterCondition,
  FilterGroup,
  FilterItem,
  FilterGroupOperator,
} from "../types/Move";

interface FilterBuilderProps {
  onFiltersChange: (filters: FilterItem[]) => void;
  className?: string;
}

export const FilterBuilder: React.FC<FilterBuilderProps> = ({
  onFiltersChange,
  className,
}) => {
  const { selectedGame, hitLevels, applyNotation } = useGame();
  
  const gameConfig: GameFilterConfig = useMemo(() => 
    getGameFilterConfig(selectedGame.id, hitLevels),
    [selectedGame.id, hitLevels]
  );

  const allOperators: FilterOperator[] = useMemo(() => {
    const customs = gameConfig.customOperators ?? [];
    const map = new Map<string, FilterOperator>();
    for (const op of builtinOperators) map.set(op.id, op);
    for (const op of customs) map.set(op.id, op);
    return Array.from(map.values());
  }, [gameConfig]);

  const operatorsById = useMemo(() => operatorById(allOperators), [allOperators]);
  
  const fieldMap = useMemo(() => new Map(
    gameConfig.fields.map((f) => [f.id, f as FieldConfig]),
  ), [gameConfig]);

  const [filters, setFilters] = useState<FilterItem[]>([]);
  const [rootOperator, setRootOperator] = useState<FilterGroupOperator>("and");
  const [isExpanded, setIsExpanded] = useState(false);
  const [quickSearchValue, setQuickSearchValue] = useState("");
  const defaultFilterAdded = useRef(false);
  const previousActiveFiltersRef = useRef<string | null>(null);

  // Sync quickSearchValue with the first 'input' filter found at root
  useEffect(() => {
    const inputFilter = filters.find(f => f.type === 'condition' && f.field === 'input') as FilterCondition | undefined;
    if (inputFilter) {
      setQuickSearchValue(inputFilter.value);
    } else {
      setQuickSearchValue("");
    }
  }, [filters]);

  const getFieldType = useCallback(
    (fieldId: string): FieldType => {
      const field = fieldMap.get(fieldId);
      return field?.type ?? "text";
    },
    [fieldMap],
  );

  const getAvailableConditions = useCallback(
    (fieldId: string): FilterOperator[] => {
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
    },
    [allOperators, fieldMap],
  );

  const isRangeCondition = useCallback(
    (conditionId: string): boolean => {
      const op = operatorsById.get(conditionId);
      return op ? op.input === "range" : false;
    },
    [operatorsById],
  );

  const isItemActive = useCallback(
    (item: FilterItem): boolean => {
      if (item.type === "group") {
        return item.filters.some(isItemActive);
      }
      const showRange = isRangeCondition(item.condition);
      if (showRange) {
        return (
          item.value.trim() !== "" &&
          item.value2 != null &&
          item.value2.trim() !== ""
        );
      }
      return item.value.trim() !== "";
    },
    [isRangeCondition],
  );

  const getActiveFilters = useCallback(
    (items: FilterItem[]): FilterItem[] => {
      return items
        .map((item) => {
          if (item.type === "group") {
            const activeSubFilters = getActiveFilters(item.filters);
            if (activeSubFilters.length === 0) return null;
            return { ...item, filters: activeSubFilters };
          }
          return isItemActive(item) ? item : null;
        })
        .filter((item): item is FilterItem => item !== null);
    },
    [isItemActive],
  );

  useEffect(() => {
    const active = getActiveFilters(filters);
    
    // If rootOperator is 'or', we wrap the active filters in an OR group
    // so that FrameDataTable (which ANDs the top-level array) will OR them.
    const finalFilters = rootOperator === 'or' && active.length > 1
      ? [{ id: 'root-group', type: 'group', operator: 'or', filters: active } as FilterItem]
      : active;

    const activeString = JSON.stringify(finalFilters);

    if (activeString !== previousActiveFiltersRef.current) {
      if (typeof React.startTransition === "function") {
        React.startTransition(() => onFiltersChange(finalFilters));
      } else {
        onFiltersChange(finalFilters);
      }
      previousActiveFiltersRef.current = activeString;
    }
  }, [filters, rootOperator, getActiveFilters, onFiltersChange]);

  const createDefaultCondition = useCallback((): FilterCondition => {
    const desired = "input";
    const hasDesired = gameConfig.fields.some((f) => f.id === desired);
    const fallback = "impact";
    const defaultField = hasDesired
      ? desired
      : gameConfig.fields.some((f) => f.id === fallback)
        ? fallback
        : (gameConfig.fields[0]?.id ?? desired);
    const available = getAvailableConditions(defaultField);
    const defaultCondition = available[0]?.id ?? "equals";

    return {
      id: `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: "condition",
      field: defaultField,
      condition: defaultCondition,
      value: "",
      value2: "",
    };
  }, [gameConfig.fields, getAvailableConditions]);

  useEffect(() => {
    if (filters.length === 0 && !defaultFilterAdded.current) {
      setFilters([createDefaultCondition()]);
      defaultFilterAdded.current = true;
    }
  }, [filters.length, createDefaultCondition]);

  const updateItemRecursive = (
    items: FilterItem[],
    id: string,
    updater: (item: FilterItem) => FilterItem | FilterItem[] | null,
  ): FilterItem[] => {
    const result: FilterItem[] = [];
    for (const item of items) {
      if (item.id === id) {
        const updated = updater(item);
        if (updated === null) continue;
        if (Array.isArray(updated)) {
          result.push(...updated);
        } else {
          result.push(updated);
        }
      } else if (item.type === "group") {
        result.push({
          ...item,
          filters: updateItemRecursive(item.filters, id, updater),
        });
      } else {
        result.push(item);
      }
    }
    return result;
  };

  const handleUpdateCondition = (
    id: string,
    property: keyof FilterCondition,
    value: any,
  ) => {
    const doUpdate = () => {
      setFilters((prev) =>
        updateItemRecursive(prev, id, (item) => {
          if (item.type === "group") return item;
          const updated = { ...item, [property]: value };

          if (property === "field") {
            const oldType = getFieldType(item.field);
            const newType = getFieldType(value);
            const available = getAvailableConditions(value);
            if (!available.some((c) => c.id === updated.condition)) {
              updated.condition = available[0]?.id || "equals";
            }
            if (oldType !== newType) {
              updated.value = "";
              updated.value2 = "";
            }
          } else if (property === "condition") {
            if (!isRangeCondition(value) && isRangeCondition(item.condition)) {
              updated.value2 = "";
            }
          }
          return updated;
        }) as FilterItem[],
      );
    };

    if (property === "value" || property === "value2") {
      if (typeof React.startTransition === "function") {
        React.startTransition(doUpdate);
        return;
      }
    }
    doUpdate();
  };

  const handleUpdateGroup = (id: string, operator: FilterGroupOperator) => {
    if (id === "root") {
      setRootOperator(operator);
      return;
    }
    setFilters((prev) =>
      updateItemRecursive(prev, id, (item) => {
        if (item.type !== "group") return item;
        return { ...item, operator };
      }) as FilterItem[],
    );
  };

  const handleRemoveItem = (id: string) => {
    setFilters((prev) => {
      const updated = updateItemRecursive(prev, id, () => null);
      if (updated.length === 0) {
        return [createDefaultCondition()];
      }
      return updated;
    });
  };

  const handleAddItem = (parentId: string | null, type: "condition" | "group") => {
    const newItem: FilterItem =
      type === "group"
        ? {
            id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: "group",
            operator: "and",
            filters: [createDefaultCondition()],
          }
        : createDefaultCondition();

    if (!parentId) {
      setFilters((prev) => [...prev, newItem]);
    } else {
      setFilters((prev) =>
        updateItemRecursive(prev, parentId, (item) => {
          if (item.type !== "group") return item;
          return { ...item, filters: [...item.filters, newItem] };
        }) as FilterItem[],
      );
    }
  };

  const handleIndent = (id: string) => {
    setFilters((prev) =>
      updateItemRecursive(prev, id, (item) => {
        return {
          id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "group",
          operator: "and",
          filters: [item],
        };
      }) as FilterItem[],
    );
  };

  const handleOutdent = (id: string) => {
    setFilters((prev) => {
      // We need to find the parent group and move the item out of it
      const findAndRemove = (items: FilterItem[]): [FilterItem[], FilterItem | null] => {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type === "group") {
            const targetIdx = item.filters.findIndex((f) => f.id === id);
            if (targetIdx !== -1) {
              const target = item.filters[targetIdx];
              const newFilters = [...item.filters];
              newFilters.splice(targetIdx, 1);
              const newItems = [...items];
              newItems[i] = { ...item, filters: newFilters };
              return [newItems, target];
            }
            const [newSubFilters, found] = findAndRemove(item.filters);
            if (found) {
              const newItems = [...items];
              newItems[i] = { ...item, filters: newSubFilters };
              return [newItems, found];
            }
          }
        }
        return [items, null];
      };

      const [newFilters, target] = findAndRemove(prev);
      if (target) {
        // Find where to insert the target. For simplicity, we'll just add it to the root
        // or we could try to find the parent of the parent.
        // Let's just add it after the group it was in.
        const insertAfterGroup = (items: FilterItem[], targetItem: FilterItem): FilterItem[] => {
          const result: FilterItem[] = [];
          for (const item of items) {
            result.push(item);
            if (item.type === "group") {
              // If this group was the one that contained the item (now removed), 
              // we should have inserted it already or we do it here.
              // This logic is a bit complex for a simple outdent.
            }
          }
          return result;
        };
        return [...newFilters, target];
      }
      return prev;
    });
  };

  const handleQuickSearchChange = (val: string) => {
    setQuickSearchValue(val);
    setFilters((prev) => {
      const existingIdx = prev.findIndex(
        (f) => f.type === "condition" && f.field === "input",
      );
      if (existingIdx !== -1) {
        const newFilters = [...prev];
        newFilters[existingIdx] = {
          ...newFilters[existingIdx],
          value: val,
        } as FilterCondition;
        return newFilters;
      } else {
        const newFilter: FilterCondition = {
          id: `filter-quick-${Date.now()}`,
          type: "condition",
          field: "input",
          condition: "contains",
          value: val,
          value2: "",
        };
        return [newFilter, ...prev];
      }
    });
  };

  const activeCount = getActiveFilters(filters).length;

  return (
    <div className={cn("mb-1 custom-search-builder pt-2", className)}>
      <div className="py-2 mb-2">
        <Input
          placeholder="Quick search (Stance + Command)..."
          value={quickSearchValue}
          onChange={(e) => handleQuickSearchChange(e.target.value)}
          className="w-full h-10 text-base border-primary/20 focus:border-primary focus-visible:border-primary focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
      <div 
        className="flex items-center gap-2 mb-1 cursor-pointer select-none hover:text-primary transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <ChevronDown className={cn(
          "h-4 w-4 transition-transform duration-300",
          !isExpanded && "-rotate-90"
        )} />
        <h3 className="text-sm font-medium">
          Filter builder ({activeCount}):
        </h3>
      </div>

      <div className={cn(
        "grid transition-all duration-300 ease-in-out",
        isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      )}>
        <div className="overflow-hidden">
          <div className="space-y-2 pt-1">
            <FilterGroupRow
              group={{
                id: "root",
                type: "group",
                operator: rootOperator,
                filters: filters,
              }}
              fields={gameConfig.fields}
              getFieldType={getFieldType}
              getAvailableConditions={getAvailableConditions}
              isRangeCondition={isRangeCondition}
              onUpdateCondition={handleUpdateCondition}
              onUpdateGroup={handleUpdateGroup}
              onRemove={handleRemoveItem}
              onAdd={handleAddItem}
              onIndent={handleIndent}
              onOutdent={handleOutdent}
              depth={0}
              isRoot={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

interface BaseFilterProps {
  fields: FieldConfig[];
  getFieldType: (id: string) => FieldType;
  getAvailableConditions: (id: string) => FilterOperator[];
  isRangeCondition: (id: string) => boolean;
  onUpdateCondition: (id: string, property: keyof FilterCondition, value: any) => void;
  onUpdateGroup: (id: string, operator: FilterGroupOperator) => void;
  onRemove: (id: string) => void;
  onAdd: (parentId: string | null, type: "condition" | "group") => void;
  onIndent: (id: string) => void;
  onOutdent: (id: string) => void;
  depth: number;
}

interface FilterItemComponentProps extends BaseFilterProps {
  item: FilterItem;
}

interface FilterGroupRowProps extends BaseFilterProps {
  group: FilterGroup;
  isRoot: boolean;
}

interface FilterRowProps extends BaseFilterProps {
  filter: FilterCondition;
}

const FilterItemComponent: React.FC<FilterItemComponentProps> = (props) => {
  const { item } = props;

  if (item.type === "group") {
    return <FilterGroupRow {...props} group={item} isRoot={false} />;
  }

  return <FilterRow {...props} filter={item} />;
};

const FilterGroupRow: React.FC<FilterGroupRowProps> = (props) => {
  const { group, onUpdateGroup, onRemove, onAdd, depth, isRoot } = props;

  const content = (
    <div className="space-y-2 flex-1">
      {group.filters.map((subItem) => (
        <FilterItemComponent
          {...props}
          key={subItem.id}
          item={subItem}
          depth={depth + 1}
        />
      ))}
      {!isRoot && (
        <Button
          variant="secondary"
          size="sm"
          className="h-8 text-xs bg-muted/30 hover:bg-muted/50"
          onClick={() => onAdd(group.id, "condition")}
        >
          Add Condition
        </Button>
      )}
      {isRoot && group.filters.length === 0 && (
        <Button
          variant="secondary"
          size="sm"
          className="h-8 text-xs bg-muted/30 hover:bg-muted/50"
          onClick={() => onAdd(null as any, "condition")}
        >
          Add Condition
        </Button>
      )}
    </div>
  );

  if (isRoot) {
    return (
      <div className="flex gap-0">
        <div 
          className="flex flex-col items-center justify-center bg-muted/20 border-l border-y rounded-l-md px-1.5 cursor-pointer hover:bg-muted/30 transition-colors min-w-[32px]"
          onClick={() => onUpdateGroup(group.id, group.operator === 'and' ? 'or' : 'and')}
        >
          <span className="text-[10px] font-bold uppercase select-none" style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}>
            {group.operator}
          </span>
        </div>
        <div className="flex-1 border rounded-r-md p-3 bg-muted/5">
          {content}
          {isRoot && (
            <div className="mt-2">
              <Button
                variant="secondary"
                size="sm"
                className="h-8 text-xs bg-muted/30 hover:bg-muted/50"
                onClick={() => onAdd(null as any, "condition")}
              >
                Add Condition
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-0 group-container">
      <div 
        className="flex flex-col items-center justify-center bg-muted/20 border-l border-y rounded-l-md px-1.5 cursor-pointer hover:bg-muted/30 transition-colors min-w-[32px]"
        onClick={() => onUpdateGroup(group.id, group.operator === 'and' ? 'or' : 'and')}
      >
        <span className="text-[10px] font-bold uppercase select-none" style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}>
          {group.operator}
        </span>
      </div>
      <div className="flex-1 border-y border-r rounded-r-md p-3 bg-muted/5 relative">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 absolute top-1 right-1 hover:bg-destructive/20"
          onClick={() => onRemove(group.id)}
        >
          <X className="h-3 w-3" />
        </Button>
        {content}
      </div>
    </div>
  );
};

const FilterRow: React.FC<FilterRowProps> = ({
  filter,
  fields,
  getFieldType,
  getAvailableConditions,
  isRangeCondition,
  onUpdateCondition,
  onRemove,
  onIndent,
  onOutdent,
  depth
}) => {
  const fieldType = getFieldType(filter.field);
  const availableConditions = getAvailableConditions(filter.field);
  const showRange = isRangeCondition(filter.condition);
  const field = fields.find((f) => f.id === filter.field);
  const isEnum = fieldType === "enum";
  const multi = availableConditions.find((op) => op.id === filter.condition)?.input === "multi";

  return (
    <div className="flex items-center justify-between gap-2 group/row">
      <div className="flex items-center gap-2 flex-1">
        <Combobox
          value={filter.field}
          onChange={(val) => val && onUpdateCondition(filter.id, "field", val)}
          options={fields.map((f) => ({
            label: f.label,
            value: f.id,
          }))}
          placeholder="Data"
          className="w-[160px] border-red-500/50 focus:border-red-500 focus:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
        />

        <Select
          value={filter.condition}
          onValueChange={(value) => onUpdateCondition(filter.id, "condition", value)}
        >
          <SelectTrigger className="w-[140px] h-8 border-green-500/50 focus:border-green-500 focus:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0" disabled={availableConditions.length <= 1}>
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

        {showRange ? (
          <div className="flex items-center gap-2">
            <Input
              type={fieldType === "number" ? "number" : "text"}
              value={filter.value}
              onChange={(e) => onUpdateCondition(filter.id, "value", e.target.value)}
              placeholder="Min"
              className="w-[80px] h-8 text-sm border-blue-500/50 focus:border-blue-500 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:bg-transparent"
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type={fieldType === "number" ? "number" : "text"}
              value={filter.value2 || ""}
              onChange={(e) => onUpdateCondition(filter.id, "value2", e.target.value)}
              placeholder="Max"
              className="w-[80px] h-8 text-sm border-blue-500/50 focus:border-blue-500 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:bg-transparent"
            />
          </div>
        ) : isEnum ? (
          multi ? (
            field?.id === "hitLevel" ? (
              <HitLevelMultiCombobox
                value={(filter.value || "").split(",").map((s) => s.trim()).filter(Boolean)}
                onChange={(vals) => onUpdateCondition(filter.id, "value", vals.join(","))}
                options={(field?.options ?? []).map((o) => ({ value: o.value }))}
                placeholder="Value"
                className="border-blue-500/50 focus:border-blue-500 focus:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            ) : (
              <MultiCombobox
                value={(filter.value || "").split(",").map((s) => s.trim()).filter(Boolean)}
                onChange={(vals) => onUpdateCondition(filter.id, "value", vals.join(","))}
                options={(field?.options ?? []).map((o) => ({
                  label: o.label ?? o.value,
                  value: o.value,
                }))}
                placeholder="Value"
                className="border-blue-500/50 focus:border-blue-500 focus:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            )
          ) : (
            <Select
              value={filter.value}
              onValueChange={(value) => onUpdateCondition(filter.id, "value", value)}
            >
              <SelectTrigger className="w-[180px] h-8 border-blue-500/50 focus:border-blue-500 focus:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0">
                <SelectValue placeholder="Value" />
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
            onChange={(e) => onUpdateCondition(filter.id, "value", e.target.value)}
            placeholder="Value"
            className="w-[180px] h-8 text-sm border-blue-500/50 focus:border-blue-500 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:bg-transparent"
          />
        )}
      </div>

      <div className="flex items-center gap-1">
        {depth > 1 && (
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-muted/50 hover:bg-muted"
            onClick={() => onOutdent(filter.id)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8 bg-muted/50 hover:bg-muted"
          onClick={() => onIndent(filter.id)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8 bg-muted/50 hover:bg-muted hover:text-destructive"
          onClick={() => onRemove(filter.id)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
