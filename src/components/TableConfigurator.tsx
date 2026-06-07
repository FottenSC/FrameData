import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useTableConfig } from "@/contexts/UserSettingsContext";
import {
  DndContext,
  DragEndEvent,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import { GripVertical } from "lucide-react";

export const TableConfigurator: React.FC = () => {
  const { columnConfigs, setColumnConfigs, restoreDefaults } = useTableConfig();

  // Local ordered id-list that drives dnd-kit's SortableContext. Seeded from
  // the persisted column config; kept in sync with it by the effect below.
  const [ids, setIds] = React.useState<string[]>(() =>
    columnConfigs.toSorted((a, b) => a.order - b.order).map((c) => c.id),
  );

  // Re-sync when the column config changes elsewhere (restore-defaults, a
  // visibility toggle, …).
  //
  // This effect MUST depend on `columnConfigs` — referentially stable until
  // it genuinely changes — and NOT on a freshly-`toSorted()`-ed array. A
  // per-render array identity would make the effect run on every render, and
  // `setIds` with a brand-new array reference re-renders → re-runs the
  // effect → loops forever (React throws "Maximum update depth exceeded").
  // The functional update returns `prev` untouched when the id order already
  // matches, so a visibility-only change doesn't churn `ids`.
  React.useEffect(() => {
    const next = columnConfigs
      .toSorted((a, b) => a.order - b.order)
      .map((c) => c.id);
    setIds((prev) =>
      prev.length === next.length && prev.every((id, i) => id === next[i])
        ? prev
        : next,
    );
  }, [columnConfigs]);

  // dnd sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) {
      return;
    }
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      const moved = arrayMove(ids, oldIndex, newIndex);
      setIds(moved);

      const byId = new Map(columnConfigs.map((c) => [c.id, c] as const));
      const merged = moved.map((id, i) => {
        const c = byId.get(id)!;
        return { ...c, order: i };
      });
      setColumnConfigs(merged);
    }
  };

  const onToggleVisible = (id: string, value: boolean) => {
    setColumnConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, visible: value } : c)),
    );
  };

  const modifiers = [restrictToVerticalAxis, restrictToParentElement];

  return (
    <DndContext
      sensors={sensors}
      onDragEnd={onDragEnd}
      modifiers={modifiers}
      collisionDetection={closestCenter}
    >
      <div className="px-2 py-2 select-none">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-medium">Columns</div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={restoreDefaults}
          >
            Restore defaults
          </Button>
        </div>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="max-h-80 overflow-auto rounded border p-2">
            {ids.map((id) => {
              const conf = columnConfigs.find((c) => c.id === id)!;
              return (
                <Row
                  key={id}
                  id={id}
                  label={conf.label}
                  checked={conf.visible}
                  onCheckedChange={(v) => onToggleVisible(id, v)}
                />
              );
            })}
          </div>
        </SortableContext>
      </div>
    </DndContext>
  );
};

const Row: React.FC<{
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}> = ({ id, label, checked, onCheckedChange }) => {
  const checkboxId = `column-toggle-${id}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    transformOrigin: "0 0",
    willChange: "transform",
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-2 rounded border bg-background/70 transition-colors mb-2",
        isDragging && "ring-2 ring-primary/50",
      )}
    >
      <div className="flex items-center gap-2 flex-1">
        <Checkbox
          id={checkboxId}
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
        />
        <label htmlFor={checkboxId} className="select-none">
          <span
            className={cn(
              "text-sm font-medium",
              !checked && "text-muted-foreground line-through",
            )}
          >
            {label}
          </span>
        </label>
      </div>
      <span
        className="ml-auto pl-2 select-none cursor-grab active:cursor-grabbing"
        style={{ touchAction: "none" }}
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </span>
    </div>
  );
};
