import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { DebouncedInput } from "./ui/debounced-input";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { cn } from "@/lib/utils";
import {
  FilterCondition,
  FilterGroup,
  FilterGroupOperator,
  FilterItem,
} from "../types/Move";
import { useGame } from "../contexts/GameContext";
import { getGameFilterConfig } from "../filters/gameFilterConfigs";
import { builtinOperators, operatorById } from "../filters/operators";
import type {
  FieldConfig,
  FieldType,
  FilterOperator,
  GameFilterConfig,
} from "../filters/types";
import { MultiCombobox } from "./ui/multi-combobox";
import { HitLevelMultiCombobox } from "./ui/hitlevel-multi-combobox";
import { Combobox } from "./ui/combobox";

export type {
  FilterCondition,
  FilterGroup,
  FilterGroupOperator,
  FilterItem,
} from "../types/Move";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const uniqueId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Walk the filter tree and apply `updater` to the item whose id matches.
 * Updater may return a single replacement, an array (to splice in multiple),
 * or null to remove the item entirely. Groups are recursed into.
 */
function mapTree(
  items: FilterItem[],
  id: string,
  updater: (item: FilterItem) => FilterItem | FilterItem[] | null,
): FilterItem[] {
  const out: FilterItem[] = [];
  for (const item of items) {
    if (item.id === id) {
      const next = updater(item);
      if (next === null) continue;
      if (Array.isArray(next)) out.push(...next);
      else out.push(next);
    } else if (item.type === "group") {
      out.push({ ...item, filters: mapTree(item.filters, id, updater) });
    } else {
      out.push(item);
    }
  }
  return out;
}

/**
 * Outdent: find `id`'s parent group and lift `id` out into that parent's
 * parent (or the root if the parent is at root). Empty groups left behind are
 * removed automatically. Returns a new tree; `items` is treated as the
 * implicit root, so items at depth 1 cannot be outdented further.
 *
 * This is a proper two-level tree edit — the old implementation silently
 * punted and just pushed the item to the root list, which was wrong.
 */
function outdentInTree(items: FilterItem[], id: string): FilterItem[] {
  // Returns the new array at this level and, if the target was found and
  // removed from a group at THIS level, the removed item itself — so the
  // caller (i.e. the parent level) can splice it in after the group it came
  // from.
  function recurse(level: FilterItem[]): {
    next: FilterItem[];
    lifted: FilterItem | null;
  } {
    const out: FilterItem[] = [];
    let lifted: FilterItem | null = null;

    for (const item of level) {
      if (item.type !== "group") {
        out.push(item);
        continue;
      }

      const idx = item.filters.findIndex((f) => f.id === id);
      if (idx !== -1) {
        // Found the target directly inside this group — lift it up.
        const target = item.filters[idx];
        const remaining = item.filters.filter((_, i) => i !== idx);
        if (remaining.length === 0) {
          // Group becomes empty — drop it and put the lifted item in its slot.
          out.push(target);
        } else {
          out.push({ ...item, filters: remaining });
          out.push(target);
        }
        // Target is now at THIS level; we're done — no further propagation.
        lifted = null;
      } else {
        // Recurse into the group.
        const sub = recurse(item.filters);
        if (sub.lifted) {
          // Lifted item bubbled up — place it right after the group.
          const filtered =
            sub.next.length > 0 ? sub.next : sub.next; /* empty check below */
          if (filtered.length === 0) {
            // Group becomes empty; drop it and place lifted in its slot.
            out.push(sub.lifted);
          } else {
            out.push({ ...item, filters: filtered });
            out.push(sub.lifted);
          }
        } else {
          out.push({ ...item, filters: sub.next });
        }
      }
    }

    return { next: out, lifted };
  }

  return recurse(items).next;
}

/**
 * Predicate: does this condition, after user input, actually filter anything?
 * Used so "empty" placeholder rows in the builder don't constrain the dataset.
 */
function isConditionActive(cond: FilterCondition, isRange: boolean): boolean {
  const v = cond.value?.trim?.() ?? "";
  if (!isRange) return v !== "";
  const v2 = cond.value2?.trim?.() ?? "";
  return v !== "" && v2 !== "";
}

/**
 * Produce the subset of the filter tree whose conditions are actually filled
 * in. Empty groups collapse away.
 */
function pruneInactive(
  items: FilterItem[],
  isRange: (conditionId: string) => boolean,
): FilterItem[] {
  const out: FilterItem[] = [];
  for (const item of items) {
    if (item.type === "group") {
      const kids = pruneInactive(item.filters, isRange);
      if (kids.length > 0) out.push({ ...item, filters: kids });
    } else if (isConditionActive(item, isRange(item.condition))) {
      out.push(item);
    }
  }
  return out;
}

function countActive(
  items: FilterItem[],
  isRange: (conditionId: string) => boolean,
): number {
  let n = 0;
  for (const item of items) {
    if (item.type === "group") n += countActive(item.filters, isRange);
    else if (isConditionActive(item, isRange(item.condition))) n += 1;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Preset chips
// ---------------------------------------------------------------------------

interface PresetSpec {
  /** Short label shown on the chip. */
  label: string;
  /** Tooltip text. */
  title: string;
  /** Produce the condition to add (or to toggle off if already present). */
  build: () => FilterCondition;
}

/**
 * Common player queries, exposed as one-click chips above the builder.
 * Clicking a preset toggles the corresponding condition on/off.
 *
 * Presets intentionally produce root-level conditions — they compose with
 * whatever the user already has in place via the root AND/OR operator.
 */
// Tag-field presets use the multi-select "inList" operator (legacy id for
// "Any of") so they're compatible with the enum typing on those fields.
const tagPreset = (
  presetLabel: string,
  presetTitle: string,
  idPrefix: string,
  field: "hitTags" | "counterHitTags" | "blockTags" | "properties",
  tag: string,
): PresetSpec => ({
  label: presetLabel,
  title: presetTitle,
  build: () => ({
    id: uniqueId(idPrefix),
    type: "condition",
    field,
    condition: "inList",
    value: tag,
    value2: "",
  }),
});

const PRESETS: PresetSpec[] = [
  tagPreset(
    "Launchers (hit)",
    "Moves that launch on hit",
    "preset-lnc-hit",
    "hitTags",
    "LNC",
  ),
  tagPreset(
    "Launchers (CH)",
    "Moves that launch on counter-hit",
    "preset-lnc-ch",
    "counterHitTags",
    "LNC",
  ),
  tagPreset(
    "Knockdown (hit)",
    "Moves that knock down on hit",
    "preset-knd-hit",
    "hitTags",
    "KND",
  ),
  tagPreset(
    "Stun (hit)",
    "Moves that stun on hit",
    "preset-stn-hit",
    "hitTags",
    "STN",
  ),
  {
    label: "Plus on block",
    title: "Moves at +1 or better on block",
    build: () => ({
      id: uniqueId("preset-plus-block"),
      type: "condition",
      field: "block",
      condition: "greaterThan",
      value: "0",
      value2: "",
    }),
  },
  {
    label: "Punishable (−10+)",
    title: "Moves at -10 or worse on block",
    build: () => ({
      id: uniqueId("preset-punishable"),
      type: "condition",
      field: "block",
      condition: "lessThan",
      value: "-9",
      value2: "",
    }),
  },
  {
    label: "i12 or faster",
    title: "Moves with impact 12 or lower",
    build: () => ({
      id: uniqueId("preset-fast"),
      type: "condition",
      field: "impact",
      condition: "lessThan",
      value: "13",
      value2: "",
    }),
  },
];

// A filter is "the same preset" as another when it matches field + condition
// + value. This lets a second click on the same chip toggle it off.
function presetMatches(p: PresetSpec, item: FilterItem): boolean {
  if (item.type !== "condition") return false;
  const sample = p.build();
  return (
    item.field === sample.field &&
    item.condition === sample.condition &&
    item.value === sample.value
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface FilterBuilderProps {
  onFiltersChange: (filters: FilterItem[]) => void;
  className?: string;
}

/**
 * Id used for the pinned quick-search row. The builder always keeps an item
 * with this id at the top of the filter list — it's the same condition whose
 * value the "Quick search" input at the top of the builder edits.
 */
const PINNED_QUICK_SEARCH_ID = "__pinned_quick_search__";

const makePinnedQuickSearch = (): FilterCondition => ({
  id: PINNED_QUICK_SEARCH_ID,
  type: "condition",
  field: "input",
  condition: "quickContains",
  value: "",
  value2: "",
});

export const FilterBuilder: React.FC<FilterBuilderProps> = ({
  onFiltersChange,
  className,
}) => {
  const {
    selectedGame,
    selectedCharacterId,
    hitLevels,
    gameStances,
    characterStances,
    gameProperties,
    characters,
  } = useGame();

  // Scope character-specific stances to just what's relevant for the current
  // view. When viewing a single character (Siegfried), the stance dropdown
  // should only list game-level stances + Siegfried's own stances — not
  // every character's stance set. When viewing All Characters we fall back
  // to the full map so every possible stance is offered.
  const relevantCharacterStances = useMemo(() => {
    if (selectedCharacterId == null || selectedCharacterId === -1) {
      return characterStances;
    }
    const only = characterStances[selectedCharacterId];
    return only ? { [selectedCharacterId]: only } : {};
  }, [characterStances, selectedCharacterId]);

  // Pass every registry the config factory knows how to use — that's how
  // stance / properties / *Tags / character fields get their "In list"
  // option population without any manual plumbing per field.
  const gameConfig: GameFilterConfig = useMemo(
    () =>
      getGameFilterConfig(
        selectedGame.id,
        hitLevels,
        gameStances,
        relevantCharacterStances,
        gameProperties,
        characters,
      ),
    [
      selectedGame.id,
      hitLevels,
      gameStances,
      relevantCharacterStances,
      gameProperties,
      characters,
    ],
  );

  const allOperators: FilterOperator[] = useMemo(() => {
    const map = new Map<string, FilterOperator>();
    for (const op of builtinOperators) map.set(op.id, op);
    for (const op of gameConfig.customOperators ?? []) map.set(op.id, op);
    return Array.from(map.values());
  }, [gameConfig]);

  const operatorsById = useMemo(
    () => operatorById(allOperators),
    [allOperators],
  );

  const fieldMap = useMemo(
    () => new Map(gameConfig.fields.map((f) => [f.id, f as FieldConfig])),
    [gameConfig],
  );

  // Seed state with the pinned quick-search row. It lives at index 0 of
  // `filters` for its entire lifetime — the top "Quick search" input and the
  // first row in the advanced tree are two views into this one item.
  const [filters, setFilters] = useState<FilterItem[]>(() => [
    makePinnedQuickSearch(),
  ]);
  const [rootOperator, setRootOperator] = useState<FilterGroupOperator>("and");
  const [isExpanded, setIsExpanded] = useState(false);

  // Convenience view into the pinned row's current value for the top input.
  const pinnedQuickSearch = useMemo<FilterCondition | null>(() => {
    const first = filters[0];
    return first && first.type === "condition" && first.id === PINNED_QUICK_SEARCH_ID
      ? first
      : null;
  }, [filters]);
  const quickSearch = pinnedQuickSearch?.value ?? "";

  const lastSentRef = useRef<string | null>(null);

  const getFieldType = useCallback(
    (fieldId: string): FieldType => fieldMap.get(fieldId)?.type ?? "text",
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

  const isRange = useCallback(
    (conditionId: string): boolean =>
      operatorsById.get(conditionId)?.input === "range",
    [operatorsById],
  );

  // Factory for "Add condition" — lands on impact so every new row is a
  // blank slate that doesn't collide with the pinned quick-search row.
  const createDefaultCondition = useCallback((): FilterCondition => {
    const preferred = ["impact", "damage", "hit", "block", "counterHit"];
    const defaultField =
      preferred.find((id) => gameConfig.fields.some((f) => f.id === id)) ??
      gameConfig.fields[0]?.id ??
      "impact";
    const available = getAvailableConditions(defaultField);
    return {
      id: uniqueId("filter"),
      type: "condition",
      field: defaultField,
      condition: available[0]?.id ?? "equals",
      value: "",
      value2: "",
    };
  }, [gameConfig.fields, getAvailableConditions]);

  // Safety-net: if something ever drops the pinned row (e.g. the switcher
  // hands us a fresh filters array from elsewhere), put it back at index 0.
  useEffect(() => {
    if (
      filters.length === 0 ||
      filters[0].type !== "condition" ||
      filters[0].id !== PINNED_QUICK_SEARCH_ID
    ) {
      setFilters((prev) => {
        const pinned = prev.find(
          (f) => f.type === "condition" && f.id === PINNED_QUICK_SEARCH_ID,
        ) as FilterCondition | undefined;
        const head = pinned ?? makePinnedQuickSearch();
        const rest = prev.filter(
          (f) => f.type !== "condition" || f.id !== PINNED_QUICK_SEARCH_ID,
        );
        return [head, ...rest];
      });
    }
  }, [filters]);

  // The pinned quick-search is just the first filter item, so we just ship
  // `filters` (pruned of empty rows) upstream — one unified pipeline.

  const effectiveFilters = useMemo<FilterItem[]>(() => {
    const pruned = pruneInactive(filters, isRange);
    if (pruned.length === 0) return [];
    if (rootOperator === "or" && pruned.length > 1) {
      return [
        {
          id: "root-group",
          type: "group",
          operator: "or",
          filters: pruned,
        },
      ];
    }
    return pruned;
  }, [filters, rootOperator, isRange]);

  useEffect(() => {
    const serialised = JSON.stringify(effectiveFilters);
    if (serialised === lastSentRef.current) return;
    lastSentRef.current = serialised;
    if (typeof React.startTransition === "function") {
      React.startTransition(() => onFiltersChange(effectiveFilters));
    } else {
      onFiltersChange(effectiveFilters);
    }
  }, [effectiveFilters, onFiltersChange]);

  // Count of actually-narrowing filter rows — pinned quick-search included
  // naturally because it's a filter item itself (and `pruneInactive` /
  // `countActive` treat it like any other row).
  const activeCount = useMemo(
    () => countActive(filters, isRange),
    [filters, isRange],
  );

  // ---- Tree mutations ----------------------------------------------------

  const updateCondition = useCallback(
    (id: string, property: keyof FilterCondition, value: any) => {
      setFilters((prev) =>
        mapTree(prev, id, (item) => {
          if (item.type === "group") return item;
          const next = { ...item, [property]: value };
          if (property === "field") {
            const oldType = getFieldType(item.field);
            const newType = getFieldType(value);
            const available = getAvailableConditions(value);
            if (!available.some((c) => c.id === next.condition)) {
              next.condition = available[0]?.id ?? "equals";
            }
            if (oldType !== newType) {
              next.value = "";
              next.value2 = "";
            }
          } else if (property === "condition") {
            if (!isRange(value) && isRange(item.condition)) {
              next.value2 = "";
            }
          }
          return next;
        }),
      );
    },
    [getAvailableConditions, getFieldType, isRange],
  );

  const updateGroup = useCallback(
    (id: string, operator: FilterGroupOperator) => {
      if (id === "root") {
        setRootOperator(operator);
        return;
      }
      setFilters((prev) =>
        mapTree(prev, id, (item) =>
          item.type === "group" ? { ...item, operator } : item,
        ),
      );
    },
    [],
  );

  const removeItem = useCallback((id: string) => {
    // Pinned quick-search row is never removable; clicking its × instead
    // empties its value. Regular rows delete as before.
    if (id === PINNED_QUICK_SEARCH_ID) {
      setFilters((prev) =>
        mapTree(prev, id, (item) =>
          item.type === "condition"
            ? { ...item, value: "", value2: "" }
            : item,
        ),
      );
      return;
    }
    setFilters((prev) => mapTree(prev, id, () => null));
  }, []);

  const addItem = useCallback(
    (parentId: string | null, type: "condition" | "group") => {
      const newItem: FilterItem =
        type === "group"
          ? {
              id: uniqueId("group"),
              type: "group",
              operator: "and",
              filters: [createDefaultCondition()],
            }
          : createDefaultCondition();
      if (!parentId) {
        setFilters((prev) => [...prev, newItem]);
      } else {
        setFilters((prev) =>
          mapTree(prev, parentId, (item) =>
            item.type === "group"
              ? { ...item, filters: [...item.filters, newItem] }
              : item,
          ),
        );
      }
    },
    [createDefaultCondition],
  );

  const indent = useCallback((id: string) => {
    setFilters((prev) =>
      mapTree(prev, id, (item) => ({
        id: uniqueId("group"),
        type: "group",
        operator: "and",
        filters: [item],
      })),
    );
  }, []);

  const outdent = useCallback((id: string) => {
    setFilters((prev) => outdentInTree(prev, id));
  }, []);

  const clearAll = useCallback(() => {
    setRootOperator("and");
    // Keep the pinned quick-search row (emptied); drop everything else.
    setFilters([makePinnedQuickSearch()]);
  }, []);

  // Preset toggle: if an equivalent condition already exists at root,
  // remove it; otherwise, append one. Presets always sit AFTER the pinned
  // quick-search row (filter rows[0] is reserved).
  const togglePreset = useCallback((preset: PresetSpec) => {
    setFilters((prev) => {
      const match = prev.find(
        (f) => f.id !== PINNED_QUICK_SEARCH_ID && presetMatches(preset, f),
      );
      if (match) return mapTree(prev, match.id, () => null);
      return [...prev, preset.build()];
    });
  }, []);

  const isPresetActive = useCallback(
    (preset: PresetSpec) => filters.some((f) => presetMatches(preset, f)),
    [filters],
  );

  // ---- Render ------------------------------------------------------------

  return (
    <div className={cn("mb-1 custom-search-builder pt-2", className)}>
      {/*
        Quick search input = a view into the pinned filter row's value.
        Typing here and editing the first row in the advanced tree are the
        same action: both mutate the PINNED_QUICK_SEARCH_ID condition.
      */}
      <div className="py-2 mb-2 flex items-center gap-2">
        <DebouncedInput
          placeholder="Quick search"
          value={quickSearch}
          onDebouncedChange={(v) =>
            updateCondition(PINNED_QUICK_SEARCH_ID, "value", v)
          }
          className="flex-1 h-10 text-base border-primary/20 focus-visible:border-primary focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
          aria-label="Quick search (stance + command)"
        />
        {activeCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            className="h-10 whitespace-nowrap"
            onClick={clearAll}
            aria-label="Clear all filters"
          >
            <X className="h-4 w-4 mr-1" />
            Clear ({activeCount})
          </Button>
        )}
      </div>

      {/* Preset chips */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {PRESETS.map((preset) => {
          const active = isPresetActive(preset);
          return (
            <Tooltip key={preset.label}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => togglePreset(preset)}
                  aria-pressed={active}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                    active
                      ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/30"
                      : "bg-muted/30 hover:bg-muted/60 border-border text-foreground/80",
                  )}
                >
                  {preset.label}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-[240px] text-[12px] leading-snug">
                  {preset.title}
                </p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* Collapsible advanced builder */}
      <div
        className="flex items-center gap-2 mb-1 cursor-pointer select-none hover:text-primary transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform duration-300",
            !isExpanded && "-rotate-90",
          )}
        />
        <h3 className="text-sm font-medium">Advanced filters</h3>
        {activeCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {activeCount} active
          </span>
        )}
      </div>

      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isExpanded
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-2 pt-1">
            <FilterGroupRow
              group={{
                id: "root",
                type: "group",
                operator: rootOperator,
                filters,
              }}
              fields={gameConfig.fields}
              getFieldType={getFieldType}
              getAvailableConditions={getAvailableConditions}
              isRange={isRange}
              onUpdateCondition={updateCondition}
              onUpdateGroup={updateGroup}
              onRemove={removeItem}
              onAdd={addItem}
              onIndent={indent}
              onOutdent={outdent}
              depth={0}
              isRoot
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

interface BaseFilterProps {
  fields: FieldConfig[];
  getFieldType: (id: string) => FieldType;
  getAvailableConditions: (id: string) => FilterOperator[];
  isRange: (id: string) => boolean;
  onUpdateCondition: (
    id: string,
    property: keyof FilterCondition,
    value: any,
  ) => void;
  onUpdateGroup: (id: string, operator: FilterGroupOperator) => void;
  onRemove: (id: string) => void;
  onAdd: (parentId: string | null, type: "condition" | "group") => void;
  onIndent: (id: string) => void;
  onOutdent: (id: string) => void;
  depth: number;
}

const FilterItemComponent: React.FC<BaseFilterProps & { item: FilterItem }> = (
  props,
) => {
  if (props.item.type === "group") {
    return <FilterGroupRow {...props} group={props.item} isRoot={false} />;
  }
  return <FilterRow {...props} filter={props.item} />;
};

const FilterGroupRow: React.FC<
  BaseFilterProps & { group: FilterGroup; isRoot: boolean }
> = (props) => {
  const { group, onUpdateGroup, onRemove, onAdd, depth, isRoot } = props;

  const toggleOp = () =>
    onUpdateGroup(group.id, group.operator === "and" ? "or" : "and");

  const operatorToggle = (
    <button
      type="button"
      onClick={toggleOp}
      className={cn(
        "flex flex-col items-center justify-center min-w-[36px] px-1.5 select-none border-l border-y rounded-l-md transition-colors",
        group.operator === "and"
          ? "bg-primary/10 hover:bg-primary/20 text-primary"
          : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-500",
      )}
      aria-label={`Toggle ${group.operator.toUpperCase()} — click to change`}
      title={`Currently ${group.operator.toUpperCase()} — click to switch`}
    >
      <span
        className="text-[11px] font-bold uppercase tracking-wider"
        style={{
          writingMode: "vertical-lr",
          transform: "rotate(180deg)",
        }}
      >
        {group.operator}
      </span>
    </button>
  );

  const body = (
    <div className="space-y-2 flex-1">
      {group.filters.map((sub) => (
        <FilterItemComponent
          {...props}
          key={sub.id}
          item={sub}
          depth={depth + 1}
        />
      ))}
      <Button
        variant="secondary"
        size="sm"
        className="h-8 text-xs bg-muted/30 hover:bg-muted/50"
        onClick={() => onAdd(isRoot ? null : group.id, "condition")}
      >
        Add condition
      </Button>
    </div>
  );

  if (isRoot) {
    return (
      <div className="flex gap-0">
        {operatorToggle}
        <div className="flex-1 border rounded-r-md p-3 bg-muted/5">{body}</div>
      </div>
    );
  }

  return (
    <div className="flex gap-0 group-container">
      {operatorToggle}
      <div className="flex-1 border-y border-r rounded-r-md p-3 bg-muted/5 relative">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 absolute top-1 right-1 hover:bg-destructive/20"
          onClick={() => onRemove(group.id)}
          aria-label="Remove group"
        >
          <X className="h-3 w-3" />
        </Button>
        {body}
      </div>
    </div>
  );
};

const FilterRow: React.FC<BaseFilterProps & { filter: FilterCondition }> = ({
  filter,
  fields,
  getFieldType,
  getAvailableConditions,
  isRange,
  onUpdateCondition,
  onRemove,
  onIndent,
  onOutdent,
  depth,
}) => {
  const fieldType = getFieldType(filter.field);
  const availableConditions = getAvailableConditions(filter.field);
  const showRange = isRange(filter.condition);
  const field = fields.find((f) => f.id === filter.field);
  const isEnum = fieldType === "enum";
  const activeOp = availableConditions.find((op) => op.id === filter.condition);
  const multi = activeOp?.input === "multi";
  const hasOptions = (field?.options?.length ?? 0) > 0;
  const showMultiCombobox = multi && hasOptions;

  const numericType = fieldType === "number";

  // Pinned quick-search row: the field is fixed (it IS the stance+command
  // column by design), and it can't be removed — its × clears the value
  // instead. The operator remains editable so the user can switch between
  // quickContains / contains / starts-with / etc. without leaving the row.
  const isPinned = filter.id === PINNED_QUICK_SEARCH_ID;

  return (
    <div className="flex items-center justify-between gap-2 group/row">
      <div className="flex items-center gap-2 flex-1 flex-wrap">
        {isPinned ? (
          <div
            className="inline-flex h-8 w-[160px] items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-3 text-sm"
            title="Pinned quick-search field"
          >
            <span className="truncate">
              {field?.label ?? "Stance + Command"}
            </span>
          </div>
        ) : (
          <Combobox
            value={filter.field}
            onChange={(v) => v && onUpdateCondition(filter.id, "field", v)}
            options={fields.map((f) => ({ label: f.label, value: f.id }))}
            placeholder="Field"
            className="w-[160px] focus-visible:ring-0 focus-visible:ring-offset-0"
            aria-label="Select field"
          />
        )}

        <Select
          value={filter.condition}
          onValueChange={(v) => onUpdateCondition(filter.id, "condition", v)}
        >
          <SelectTrigger
            className="w-[140px] h-8 focus-visible:ring-0 focus-visible:ring-offset-0"
            disabled={availableConditions.length <= 1}
            aria-label="Select condition"
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

        {showRange ? (
          <div className="flex items-center gap-2">
            <DebouncedInput
              type={numericType ? "number" : "text"}
              value={filter.value}
              onDebouncedChange={(v) =>
                onUpdateCondition(filter.id, "value", v)
              }
              placeholder="Min"
              className="w-[90px] h-8 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label="Minimum value"
            />
            <span className="text-muted-foreground">–</span>
            <DebouncedInput
              type={numericType ? "number" : "text"}
              value={filter.value2 ?? ""}
              onDebouncedChange={(v) =>
                onUpdateCondition(filter.id, "value2", v)
              }
              placeholder="Max"
              className="w-[90px] h-8 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label="Maximum value"
            />
          </div>
        ) : showMultiCombobox ? (
          field?.id === "hitLevel" ? (
            <HitLevelMultiCombobox
              value={(filter.value || "")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)}
              onChange={(vals) =>
                onUpdateCondition(filter.id, "value", vals.join(","))
              }
              options={(field?.options ?? []).map((o) => ({
                value: o.value,
              }))}
              placeholder="Value"
              className="focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label="Select hit levels"
            />
          ) : (
            <MultiCombobox
              value={(filter.value || "")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)}
              onChange={(vals) =>
                onUpdateCondition(filter.id, "value", vals.join(","))
              }
              options={(field?.options ?? []).map((o) => ({
                label: o.label ?? o.value,
                value: o.value,
              }))}
              placeholder="Value"
              className="focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label="Select values"
            />
          )
        ) : isEnum ? (
          <Select
            value={filter.value}
            onValueChange={(v) => onUpdateCondition(filter.id, "value", v)}
          >
            <SelectTrigger
              className="w-[180px] h-8 focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label="Select value"
            >
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
        ) : (
          <DebouncedInput
            type={numericType ? "number" : "text"}
            value={filter.value}
            onDebouncedChange={(v) => onUpdateCondition(filter.id, "value", v)}
            placeholder="Value"
            className="w-[200px] h-8 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
            aria-label="Value"
          />
        )}
      </div>

      <div className="flex items-center gap-1">
        {!isPinned && depth > 1 && (
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-muted/50 hover:bg-muted"
            onClick={() => onOutdent(filter.id)}
            aria-label="Outdent"
            title="Move out of group"
          >
            <ChevronDown className="h-4 w-4 -rotate-90" />
          </Button>
        )}
        {!isPinned && (
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-muted/50 hover:bg-muted"
            onClick={() => onIndent(filter.id)}
            aria-label="Indent"
            title="Move into a new group"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8 bg-muted/50 hover:bg-muted hover:text-destructive"
          onClick={() => onRemove(filter.id)}
          aria-label={isPinned ? "Clear quick search" : "Remove filter"}
          title={isPinned ? "Clear the quick-search value" : "Remove this row"}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
