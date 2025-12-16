import React, { useEffect, useCallback, memo, useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowDown, ArrowUp, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Move, SortableColumn } from "@/types/Move";
import { ColumnConfig } from "@/contexts/UserSettingsContext";
import { ValueBadge } from "@/components/ui/ValueBadge";
import { ExpandableHitLevels } from "@/components/icons/ExpandableHitLevels";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";

const PAGE_SIZE = 300;

// Memoized row component to prevent unnecessary re-renders during virtualization
interface MemoizedRowProps {
  move: Move;
  visibleColumns: ColumnConfig[];
  renderCellContent: (move: Move, columnId: string) => React.ReactNode;
  measureRef?: (el: HTMLTableRowElement | null) => void;
  dataIndex?: number;
}

const MemoizedTableRow = memo<MemoizedRowProps>(
  ({ move, visibleColumns, renderCellContent, measureRef, dataIndex }) => (
    <TableRow
      className="border-b-card-border"
      data-index={dataIndex}
      ref={measureRef}
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
  ),
  (prevProps, nextProps) => {
    return (
      prevProps.move.ID === nextProps.move.ID &&
      prevProps.visibleColumns === nextProps.visibleColumns
    );
  },
);

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
  // Whether "All Characters" mode is active (enables pagination)
  isAllCharacters?: boolean;
}

// Generate page numbers to display with ellipsis
const getPageNumbers = (
  currentPage: number,
  totalPages: number,
): (number | "ellipsis")[] => {
  const pages: (number | "ellipsis")[] = [];

  if (totalPages <= 7) {
    for (let i = 0; i < totalPages; i++) pages.push(i);
  } else {
    pages.push(0);

    let start = Math.max(1, currentPage - 1);
    let end = Math.min(totalPages - 2, currentPage + 1);

    if (currentPage < 3) {
      end = Math.min(totalPages - 2, 3);
    }
    if (currentPage > totalPages - 4) {
      start = Math.max(1, totalPages - 4);
    }

    if (start > 1) pages.push("ellipsis");
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 2) pages.push("ellipsis");

    pages.push(totalPages - 1);
  }

  return pages;
};

// Pagination footer component - always outside scroll container
const PaginationFooter: React.FC<{
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}> = ({ currentPage, totalPages, onPageChange }) => {
  const pageNumbers = getPageNumbers(currentPage, totalPages);

  return (
    <div className="flex-shrink-0 flex items-center justify-end px-4 py-2 border-t border-card-border bg-card">
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationLink
              onClick={() => onPageChange(0)}
              disabled={currentPage === 0}
              title="First page"
              size="icon"
            >
              <ChevronsLeft className="h-4 w-4" />
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 0}
            />
          </PaginationItem>

          {pageNumbers.map((page, idx) => (
            <PaginationItem key={idx}>
              {page === "ellipsis" ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink
                  onClick={() => onPageChange(page)}
                  isActive={page === currentPage}
                >
                  {page + 1}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}

          <PaginationItem>
            <PaginationNext
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages - 1}
            />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink
              onClick={() => onPageChange(totalPages - 1)}
              disabled={currentPage >= totalPages - 1}
              title="Last page"
              size="icon"
            >
              <ChevronsRight className="h-4 w-4" />
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
};

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
  // Single scroll container ref - component owns its scroll
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(
    null,
  );
  const scrollContainerRef = useCallback((node: HTMLDivElement | null) => {
    setScrollContainer(node);
  }, []);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);

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
  }, [moves, currentPage, usePagination]);

  // Page change handler
  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
      scrollContainer?.scrollTo({ top: 0, behavior: "smooth" });
    },
    [scrollContainer],
  );

  // Cell content renderer
  const renderCellContent = useCallback(
    (move: Move, columnId: string) => {
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
            <ValueBadge
              value={move.BlockDec}
              text={move.Block}
              badges={badges}
            />
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
    },
    [renderCommand, renderNotes, badges],
  );

  // Virtualizer setup
  const rowVirtualizer = useVirtualizer({
    count: displayMoves.length,
    getScrollElement: () => scrollContainer,
    estimateSize: () => 40,
    overscan: 15,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  // Recompute on resize
  useEffect(() => {
    if (!scrollContainer) return;
    const ro = new ResizeObserver(() => rowVirtualizer.measure());
    ro.observe(scrollContainer);
    return () => ro.disconnect();
  }, [scrollContainer, rowVirtualizer]);

  // Render table header
  const tableHeader = (
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
              className={column.className + " cursor-pointer select-none"}
              style={style}
              onClick={() => handleSort(column.id as SortableColumn)}
              title={column.friendlyLabel || column.label}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="whitespace-nowrap flex-1">{column.label}</span>
                <span className="inline-flex w-3 justify-center">
                  {sortColumn === column.id &&
                    (sortDirection === "asc" ? (
                      <ArrowUp size={14} />
                    ) : (
                      <ArrowDown size={14} />
                    ))}
                </span>
              </div>
            </TableHead>
          );
        })}
      </TableRow>
    </TableHeader>
  );

  // Render table body content
  const tableBody = (() => {
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
    }

    if (moves.length === 0) {
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
            <MemoizedTableRow
              key={move.ID}
              move={move}
              visibleColumns={visibleColumns}
              renderCellContent={renderCellContent}
            />
          ))}
          {displayMoves.length > slice.length && (
            <TableRow>
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
            </TableRow>
          )}
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
          const move = displayMoves[virtualRow.index]!;
          return (
            <MemoizedTableRow
              key={move.ID}
              move={move}
              visibleColumns={visibleColumns}
              renderCellContent={renderCellContent}
              dataIndex={virtualRow.index}
              measureRef={(el) => {
                if (el) rowVirtualizer.measureElement(el);
              }}
            />
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
  })();

  return (
    <div className="flex flex-col h-full">
      {/* Scroll container */}
      <div className="flex-1 min-h-0 overflow-y-auto" ref={scrollContainerRef}>
        <Table className="table-layout-fixed">
          {tableHeader}
          <TableBody>{tableBody}</TableBody>
        </Table>

        {/* Pagination inside scroll area */}
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

export const FrameDataTableContent = memo(FrameDataTableContentInner);
