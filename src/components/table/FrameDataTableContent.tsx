import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableRow as UITableRow,
} from "@/components/ui/table";
import { showCopiedToast } from "@/components/ui/copy-toast";
import { Move, SortableColumn, type Command } from "@/types/Move";
import { ColumnConfig } from "@/contexts/UserSettingsContext";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGame } from "@/contexts/GameContext";
import { translateToken } from "@/lib/notation";
import { PaginationFooter } from "./PaginationFooter";
import { TableRow } from "./TableRow";
import { FrameDataTableHeader } from "./FrameDataTableHeader";

const PAGE_SIZE = 300;
const getMoveKey = (move: Move): string => `${move.characterId}:${move.id}`;

interface DataTableContentProps {
  moves: Move[];
  movesLoading: boolean;
  sortColumn: SortableColumn | null;
  sortDirection: "asc" | "desc";
  handleSort: (column: SortableColumn) => void;
  renderCommand: (command: Command | null) => React.ReactNode;
  renderNotes: (note: string | null) => React.ReactNode;
  visibleColumns: ColumnConfig[];
  badges?: Record<string, { className: string }>;
  isAllCharacters?: boolean;
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
  isAllCharacters = false,
}) => {
  // Get stance info function from context
  const { getStanceInfo, getPropertyInfo, notationStyle } = useGame();

  // Single scroll container ref - component owns its scroll. The ref
  // callback must be stabilised with `useCallback` (empty deps) — without
  // it, the function identity changes on every render, which makes React
  // call the OLD callback with `null` and the NEW one with the element on
  // every commit. That null↔element flicker propagates through
  // `setScrollContainer`, briefly drops `scrollContainer` to `null`, and
  // re-runs the resize-observer effect every render.
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(
    null,
  );
  const scrollContainerRef = useCallback((node: HTMLDivElement | null) => {
    setScrollContainer(node);
  }, []);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);

  // Copy command to clipboard. We preserve the full OR-structure: every
  // alternative of every step makes it into the copied text, separated by
  // `|` (matches `formatCommandFlat`, the same convention used by CSV /
  // Excel export). AND-pressed buttons inside one alternative are
  // `+`-joined; each button is translated independently so `A+B` copies as
  // `1+2` in Tekken notation, not as a regex-replaced blob. Steps are
  // glued together without a separator — that's the long-standing SC6
  // copy convention (sequences read as `AAB`, not `A A B`).
  const copyCommand = React.useCallback(
    (move: Move) => {
      const stancePart = move.stance?.join(" ") ?? "";
      const commandPart =
        move.command
          ?.map((step) =>
            step
              .map((alt) =>
                alt
                  .map((btn) => {
                    const translated = translateToken(btn.b, notationStyle);
                    return btn.h ? `(${translated})` : translated;
                  })
                  .join("+"),
              )
              .filter(Boolean)
              .join("|"),
          )
          .filter(Boolean)
          .join("") ?? "";
      const textToCopy = stancePart
        ? `${stancePart} ${commandPart}`
        : commandPart;

      navigator.clipboard.writeText(textToCopy).then(() => {
        showCopiedToast(textToCopy);
      });
    },
    [notationStyle],
  );

  // Reset page when moves change
  useEffect(() => {
    setCurrentPage(0);
  }, [moves.length]);

  // Pagination logic
  const usePagination = isAllCharacters && moves.length > PAGE_SIZE;
  const totalPages = usePagination ? Math.ceil(moves.length / PAGE_SIZE) : 1;

  const displayMoves = useMemo(() => {
    if (!usePagination) return moves;
    const start = currentPage * PAGE_SIZE;
    return moves.slice(start, start + PAGE_SIZE);
  }, [moves, usePagination, currentPage]);
  const getItemKey = useCallback(
    (index: number) => {
      const move = displayMoves[index];
      return move ? getMoveKey(move) : index;
    },
    [displayMoves],
  );

  // Page change handler
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    scrollContainer?.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Virtualizer setup
  const rowVirtualizer = useVirtualizer({
    count: displayMoves.length,
    getScrollElement: () => scrollContainer,
    estimateSize: () => 40,
    getItemKey,
    overscan: 15,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  // No manual ResizeObserver — `useVirtualizer({ getScrollElement })`
  // installs its own observer on the scroll element. An explicit
  // `new ResizeObserver(() => rowVirtualizer.measure())` here would be
  // both redundant AND harmful: `measure()` invalidates every cached
  // row size, so any height change (FilterBuilder toggle, switching
  // characters, devtools opening) triggered a full row remeasure pass
  // that froze the table in Vivaldi/Brave.

  // Render table body content
  const tableBody = (() => {
    // Only show skeletons if we are loading and have no data to show
    if (movesLoading && moves.length === 0) {
      return (
        <>
          {Array.from({ length: 20 }).map((_, i) => (
            <UITableRow key={i} className="border-b-card-border">
              {visibleColumns.map((column) => {
                const style: React.CSSProperties = {};
                if (column.width) style.width = column.width;
                if (column.minWidth) style.minWidth = column.minWidth;
                if (column.maxWidth) style.maxWidth = column.maxWidth;

                // Customize skeleton based on column type
                const skeletonContent = (() => {
                  switch (column.id) {
                    case "command":
                    case "hitLevel":
                      return (
                        <div className="flex gap-1">
                          <Skeleton className="h-5 w-5 rounded-full" />
                          <Skeleton className="h-5 w-5 rounded-full" />
                          <Skeleton className="h-5 w-8 rounded-md" />
                        </div>
                      );
                    case "impact":
                    case "damage":
                    case "block":
                    case "hit":
                    case "counterHit":
                    case "guardBurst":
                      return <Skeleton className="h-5 w-8 mx-auto" />;
                    case "properties":
                      return (
                        <div className="flex gap-1">
                          <Skeleton className="h-4 w-10 rounded-full" />
                          <Skeleton className="h-4 w-10 rounded-full" />
                        </div>
                      );
                    case "character":
                      return <Skeleton className="h-5 w-20" />;
                    case "stance":
                      return <Skeleton className="h-5 w-24 ml-auto" />;
                    default:
                      return <Skeleton className="h-5 w-full" />;
                  }
                })();

                return (
                  <TableCell
                    key={column.id}
                    className={column.className}
                    style={style}
                  >
                    {skeletonContent}
                  </TableCell>
                );
              })}
            </UITableRow>
          ))}
        </>
      );
    }

    if (moves.length === 0 && !movesLoading) {
      return (
        <UITableRow>
          <TableCell
            colSpan={visibleColumns.length}
            className="text-center h-24 p-2"
          >
            No moves found for this character or filter criteria.
          </TableCell>
        </UITableRow>
      );
    }

    const items = virtualItems;
    const paddingTop = items.length > 0 ? items[0]!.start : 0;
    const paddingBottom =
      items.length > 0 ? totalSize - items[items.length - 1]!.end : 0;

    // Fallback before virtualizer is ready
    if (items.length === 0 || !scrollContainer) {
      const slice = displayMoves.slice(0, Math.min(40, displayMoves.length));
      return (
        <>
          {slice.map((move) => (
            <TableRow
              key={getMoveKey(move)}
              move={move}
              visibleColumns={visibleColumns}
              renderCommand={renderCommand}
              renderNotes={renderNotes}
              copyCommand={copyCommand}
              getStanceInfo={getStanceInfo}
              getPropertyInfo={getPropertyInfo}
              badges={badges}
            />
          ))}
          {displayMoves.length > slice.length && (
            <UITableRow>
              <TableCell
                colSpan={visibleColumns.length}
                className="text-center py-4"
              >
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>
                    Loading {displayMoves.length - slice.length} more moves...
                  </span>
                </div>
              </TableCell>
            </UITableRow>
          )}
        </>
      );
    }

    return (
      <>
        {paddingTop > 0 && (
          <UITableRow>
            <TableCell
              colSpan={visibleColumns.length}
              style={{ padding: 0, border: 0 }}
            >
              <div style={{ height: paddingTop }} aria-hidden />
            </TableCell>
          </UITableRow>
        )}
        {items.map((virtualRow) => {
          const move = displayMoves[virtualRow.index]!;
          return (
            <TableRow
              key={virtualRow.key}
              move={move}
              visibleColumns={visibleColumns}
              renderCommand={renderCommand}
              renderNotes={renderNotes}
              copyCommand={copyCommand}
              getStanceInfo={getStanceInfo}
              getPropertyInfo={getPropertyInfo}
              badges={badges}
              dataIndex={virtualRow.index}
              measureRef={rowVirtualizer.measureElement}
            />
          );
        })}
        {paddingBottom > 0 && (
          <UITableRow>
            <TableCell
              colSpan={visibleColumns.length}
              style={{ padding: 0, border: 0 }}
            >
              <div style={{ height: paddingBottom }} aria-hidden />
            </TableCell>
          </UITableRow>
        )}
      </>
    );
  })();

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
        ref={scrollContainerRef}
      >
        <Table>
          <FrameDataTableHeader
            visibleColumns={visibleColumns}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            handleSort={handleSort}
          />
          <TableBody>{tableBody}</TableBody>
        </Table>

        {usePagination && (
          <PaginationFooter
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={moves.length}
            onPageChange={handlePageChange}
          />
        )}
      </div>
    </div>
  );
};

// Wrap with TooltipProvider for stance tooltips
// disableHoverableContent makes the tooltip close when hovering over the tooltip itself
export const FrameDataTableContent: React.FC<DataTableContentProps> = (
  props,
) => (
  <TooltipProvider
    delayDuration={150}
    skipDelayDuration={500}
    disableHoverableContent
  >
    <FrameDataTableContentInner {...props} />
  </TooltipProvider>
);
