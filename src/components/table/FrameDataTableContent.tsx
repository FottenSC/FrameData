import React, { useState, useEffect, useCallback, useLayoutEffect, memo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Move, SortableColumn } from "@/types/Move";
import { ColumnConfig } from "@/contexts/UserSettingsContext";
import { ValueBadge } from "@/components/ui/ValueBadge";
import { ExpandableHitLevels } from "@/components/icons/ExpandableHitLevels";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Badge } from "@/components/ui/badge";

interface DataTableContentProps {
  moves: Move[];
  movesLoading: boolean;
  sortColumn: SortableColumn | null;
  sortDirection: "asc" | "desc";
  handleSort: (column: SortableColumn) => void;
  renderCommand: (command: string | null) => React.ReactNode;
  renderNotes: (note: string | null) => React.ReactNode;
  visibleColumns: ColumnConfig[];
  badges?: Record<string, { className: string }>;
  // Function that returns the scroll container element (the div with overflow-y-auto in parent)
  getScrollElement?: () => HTMLElement | null;
}

const FrameDataTableContentInner: React.FC<DataTableContentProps> = ({
  moves,
  movesLoading,
  sortColumn,
  sortDirection,
  handleSort,
  renderCommand,
  renderNotes,
  visibleColumns,
  badges,
  getScrollElement,
}) => {
  // Table ref retained for potential future features
  const tableRef = React.useRef<HTMLTableElement | null>(null);
  
  // Track scroll element with state to force re-render when it becomes available
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  
  // Check for scroll element on mount and when getScrollElement changes
  useLayoutEffect(() => {
    const checkScrollElement = () => {
      const el = getScrollElement ? getScrollElement() : null;
      if (el !== scrollElement) {
        setScrollElement(el);
      }
    };
    
    // Check immediately
    checkScrollElement();
    
    // Also check after a brief delay in case the ref isn't set yet
    const timeoutId = setTimeout(checkScrollElement, 0);
    
    return () => clearTimeout(timeoutId);
  }, [getScrollElement, scrollElement]);

  const renderCellContent = useCallback((move: Move, columnId: string) => {
    switch (columnId) {
      case "character":
        return move.CharacterName || "—";
      case "stance":
        if (!move.Stance || move.Stance.length === 0) return "—";
        return (
          <div className="flex flex-wrap gap-0.5 justify-end">
            {move.Stance.map((s, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="whitespace-nowrap border border-gray-500"
              >
                {s}
              </Badge>
            ))}
          </div>
        );
      case "command":
        return renderCommand(move.Command);
      case "rawCommand":
        return move.Command || "—";
      case "hitLevel":
        return (
          <ExpandableHitLevels
            hitLevelString={move.HitLevel}
            maxIconsToShow={3}
          />
        );
      case "impact":
        return move.Impact ?? "—";
      case "damage":
        return move.DamageDec ?? "—";
      case "block":
        return (
          <ValueBadge value={move.BlockDec} text={move.Block} badges={badges} />
        );
      case "hit":
        return (
          <ValueBadge value={move.HitDec} text={move.Hit} badges={badges} />
        );
      case "counterHit":
        return (
          <ValueBadge
            value={move.CounterHitDec}
            text={move.CounterHit}
            badges={badges}
          />
        );
      case "guardBurst":
        return (
          <ValueBadge
            value={move.GuardBurst}
            text={null}
            forceNoSign
            badges={badges}
          />
        );
      case "notes":
        return (
          <div className="max-w-full truncate overflow-x-hidden overflow-y-visible">
            {renderNotes(move.Notes)}
          </div>
        );
      default:
        return "—";
    }
  }, [renderCommand, renderNotes, badges]);

  // Use the tracked scroll element for virtualization
  const rowVirtualizer = useVirtualizer({
    count: moves.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => 40,
    overscan: 12,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  // Recompute on container resize (height changes)
  useEffect(() => {
    if (!scrollElement) return;
    const ro = new ResizeObserver(() => rowVirtualizer.measure());
    ro.observe(scrollElement);
    return () => ro.disconnect();
  }, [scrollElement, rowVirtualizer]);

  return (
    <Table ref={tableRef} className="table-layout-fixed">
      <TableHeader>
        <TableRow className="border-b-card-border">
          {visibleColumns.map((column) => {
            const style: React.CSSProperties = {};
            if (column.width) style.width = column.width;
            if (column.minWidth) style.minWidth = column.minWidth;
            if (column.maxWidth) style.maxWidth = column.maxWidth;
            return (
              <TableHead
                key={column.id}
                className={column.className + " cursor-pointer select-none bg-card sticky top-0 z-10"}
                style={style}
                onClick={() => handleSort(column.id as SortableColumn)}
                title={
                  column.friendlyLabel ? column.friendlyLabel : column.label
                }
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="whitespace-nowrap flex-1">
                    {column.label}
                  </span>
                  <span className="inline-flex w-3 justify-center">
                    {sortColumn === column.id ? (
                      sortDirection === "asc" ? (
                        <ArrowUp size={14} />
                      ) : (
                        <ArrowDown size={14} />
                      )
                    ) : null}
                  </span>
                </div>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {(() => {
          if (movesLoading) {
            return (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length}
                  className="text-center h-24 p-2"
                >
                  <div className="flex justify-center items-center">
                    Loading moves...
                  </div>
                </TableCell>
              </TableRow>
            );
          } else if (moves.length === 0) {
            return (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length}
                  className="text-center h-24 p-2"
                >
                  No moves found for this character or filter criteria.
                </TableCell>
              </TableRow>
            );
          }

          // When virtualizing table rows, use spacer rows to maintain total height
          const items = virtualItems;
          const paddingTop = items.length > 0 ? items[0]!.start : 0;
          const paddingBottom =
            items.length > 0 ? totalSize - items[items.length - 1]!.end : 0;

          // Defensive fallback: if virtualizer hasn't produced items yet or scroll element not ready,
          // render a small initial slice to prevent blocking the UI
          if (items.length === 0 || !scrollElement) {
            const slice = moves.slice(0, Math.min(20, moves.length));
            return (
              <>
                {slice.map((move) => (
                  <TableRow key={move.ID} className="border-b-card-border">
                    {visibleColumns.map((column) => (
                      <TableCell
                        key={`${move.ID}-${column.id}`}
                        className={column.className}
                        style={{
                          width: column.width,
                          minWidth: column.minWidth,
                          maxWidth: column.maxWidth,
                        }}
                      >
                        {renderCellContent(move, column.id)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </>
            );
          }

          return (
            <>
              {paddingTop > 0 && (
                <TableRow>
                  <TableCell
                    colSpan={visibleColumns.length}
                    style={{ padding: 0, border: 0 }}
                  >
                    <div style={{ height: paddingTop }} aria-hidden />
                  </TableCell>
                </TableRow>
              )}

              {items.map((virtualRow) => {
                const move = moves[virtualRow.index]!;
                return (
                  <TableRow
                    key={move.ID}
                    className="border-b-card-border"
                    data-index={virtualRow.index}
                    ref={(el) => {
                      if (el) rowVirtualizer.measureElement(el);
                    }}
                  >
                    {visibleColumns.map((column) => {
                      const style: React.CSSProperties = {};
                      if (column.width) style.width = column.width;
                      if (column.minWidth) style.minWidth = column.minWidth;
                      if (column.maxWidth) style.maxWidth = column.maxWidth;
                      return (
                        <TableCell
                          key={`${move.ID}-${column.id}`}
                          className={column.className}
                          style={style}
                        >
                          {renderCellContent(move, column.id)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}

              {paddingBottom > 0 && (
                <TableRow>
                  <TableCell
                    colSpan={visibleColumns.length}
                    style={{ padding: 0, border: 0 }}
                  >
                    <div style={{ height: paddingBottom }} aria-hidden />
                  </TableCell>
                </TableRow>
              )}
            </>
          );
        })()}
      </TableBody>
    </Table>
  );
};

// Memoize to prevent re-renders when parent re-renders with same props
export const FrameDataTableContent = memo(FrameDataTableContentInner);
