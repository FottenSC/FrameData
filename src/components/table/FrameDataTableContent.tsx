import React, { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableRow as UITableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Move, SortableColumn } from "@/types/Move";
import { ColumnConfig } from "@/contexts/UserSettingsContext";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGame } from "@/contexts/GameContext";
import { PaginationFooter } from "./PaginationFooter";
import { TableRow } from "./TableRow";
import { FrameDataTableHeader } from "./FrameDataTableHeader";

const PAGE_SIZE = 300;

interface DataTableContentProps {
  moves: Move[];
  movesLoading: boolean;
  sortColumn: SortableColumn | null;
  sortDirection: "asc" | "desc";
  handleSort: (column: SortableColumn) => void;
  renderCommand: (command: string[] | null) => React.ReactNode;
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
  const { getStanceInfo, getPropertyInfo } = useGame();

  // Single scroll container ref - component owns its scroll
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(
    null,
  );
  const scrollContainerRef = (node: HTMLDivElement | null) => {
    setScrollContainer(node);
  };

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);

  // Copy command to clipboard
  const copyCommand = (move: Move) => {
    const stancePart = move.stance?.join(" ") ?? "";
    const commandPart = move.command?.join("") ?? "";
    const textToCopy = stancePart ? `${stancePart} ${commandPart}` : commandPart;
    
    navigator.clipboard.writeText(textToCopy).then(() => {
      toast("Copied!", { duration: 1000 });
    });
  };

  // Reset page when moves change
  useEffect(() => {
    setCurrentPage(0);
  }, [moves.length]);

  // Pagination logic
  const usePagination = isAllCharacters && moves.length > PAGE_SIZE;
  const totalPages = usePagination ? Math.ceil(moves.length / PAGE_SIZE) : 1;
  const displayMoves =
    !usePagination
      ? moves
      : (() => {
          const start = currentPage * PAGE_SIZE;
          return moves.slice(start, start + PAGE_SIZE);
        })();

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

  // Render table body content
  const tableBody = (() => {
    if (movesLoading) {
      return (
        <>
          {Array.from({ length: 20 }).map((_, i) => (
            <UITableRow key={i} className="border-b-card-border">
              {visibleColumns.map((column) => (
                <TableCell key={column.id} className={column.className}>
                  <Skeleton className="h-5 w-full max-w-[100px]" />
                </TableCell>
              ))}
            </UITableRow>
          ))}
        </>
      );
    }

    if (moves.length === 0) {
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
              key={move.id}
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
              key={move.id}
              move={move}
              visibleColumns={visibleColumns}
              renderCommand={renderCommand}
              renderNotes={renderNotes}
              copyCommand={copyCommand}
              getStanceInfo={getStanceInfo}
              getPropertyInfo={getPropertyInfo}
              badges={badges}
              dataIndex={virtualRow.index}
              measureRef={(el) => {
                if (el) rowVirtualizer.measureElement(el);
              }}
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
      {/* Scroll container */}
      <div className="flex-1 min-h-0 overflow-y-auto" ref={scrollContainerRef}>
        <Table className="table-layout-fixed">
          <FrameDataTableHeader
            visibleColumns={visibleColumns}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            handleSort={handleSort}
          />
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

// Wrap with TooltipProvider for stance tooltips
// disableHoverableContent makes the tooltip close when hovering over the tooltip itself
export const FrameDataTableContent: React.FC<DataTableContentProps> = (props) => (
  <TooltipProvider delayDuration={300} disableHoverableContent>
    <FrameDataTableContentInner {...props} />
  </TooltipProvider>
);
