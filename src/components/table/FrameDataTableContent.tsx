import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableRow as UITableRow,
} from "@/components/ui/table";
import { showCopiedToast } from "@/components/ui/copy-toast";
import { Move, SortableColumn, type Command } from "@/types/Move";
import { ColumnConfig } from "@/contexts/UserSettingsContext";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGame } from "@/contexts/GameContext";
import { translateToken } from "@/lib/notation";
import { PaginationFooter } from "./PaginationFooter";
import { TableRow } from "./TableRow";
import { FrameDataTableHeader } from "./FrameDataTableHeader";
import { isMoveCardMainAttribute, MoveCard } from "./MoveCard";
import { ArrowDown, ArrowUp } from "lucide-react";

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
  useCardLayout?: boolean;
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
  useCardLayout = false,
}) => {
  // Get stance info function from context
  const { getStanceInfo, getPropertyInfo, notationStyle } = useGame();
  const cardAttributeColumns = visibleColumns.filter((column) =>
    isMoveCardMainAttribute(column.id),
  );
  const cardAttributeGrid: React.CSSProperties = {
    gridTemplateColumns: `repeat(${cardAttributeColumns.length}, minmax(0, 1fr))`,
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
  // Page change handler
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderTableBody = () => {
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

    return (
      <>
        {displayMoves.map((move) => (
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
      </>
    );
  };

  const renderCardBody = () => {
    if (movesLoading && moves.length === 0) {
      return Array.from({ length: 8 }).map((_, index) => (
        <article
          key={index}
          data-move-card-skeleton
          className="overflow-hidden rounded-xl border border-card-border bg-card/40"
        >
          <div className="space-y-3 border-b border-card-border p-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-44" />
          </div>
          <div className="grid grid-cols-2 gap-px bg-border/70">
            {Array.from({ length: 6 }).map((__, cellIndex) => (
              <div key={cellIndex} className="space-y-2 bg-background p-3">
                <Skeleton className="h-2.5 w-12" />
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </article>
      ));
    }

    if (moves.length === 0) {
      return (
        <div className="rounded-xl border border-card-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
          No moves found for this character or filter criteria.
        </div>
      );
    }

    return displayMoves.map((move) => (
      <MoveCard
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
    ));
  };

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain [contain:paint]"
        ref={scrollContainerRef}
      >
        {useCardLayout ? (
          <>
            {cardAttributeColumns.length > 0 && (
              <div className="sticky -top-px z-20 bg-background pt-px">
                <div
                  role="table"
                  aria-label="Sortable frame data columns"
                  className="mx-2 overflow-hidden rounded-b-md border-x border-b border-card-border bg-muted/30"
                >
                  <div
                    role="row"
                    className="ml-[10px] mr-[7px] grid"
                    style={cardAttributeGrid}
                  >
                    {cardAttributeColumns.map((column) => {
                      const active = sortColumn === column.id;
                      return (
                        <div
                          key={column.id}
                          role="columnheader"
                          aria-sort={
                            active
                              ? sortDirection === "asc"
                                ? "ascending"
                                : "descending"
                              : "none"
                          }
                          className="min-w-0 border-r border-card-border last:border-r-0"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              handleSort(column.id as SortableColumn)
                            }
                            title={column.friendlyLabel || column.label}
                            className="flex w-full min-w-0 items-center justify-center gap-0.5 px-0.5 py-1 text-[8px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                          >
                            <span className="truncate">{column.label}</span>
                            <span className="inline-flex h-2.5 w-2.5 shrink-0 items-center justify-center">
                              {active &&
                                (sortDirection === "asc" ? (
                                  <ArrowUp className="h-2.5 w-2.5" />
                                ) : (
                                  <ArrowDown className="h-2.5 w-2.5" />
                                ))}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-2 p-2">{renderCardBody()}</div>
          </>
        ) : (
          <Table>
            <FrameDataTableHeader
              visibleColumns={visibleColumns}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              handleSort={handleSort}
            />
            <TableBody className="relative z-0">{renderTableBody()}</TableBody>
          </Table>
        )}

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
const FrameDataTableContentWithTooltips: React.FC<DataTableContentProps> = (
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

// During a deferred card/table switch the parent renders once with the old
// layout. Avoid rebuilding hundreds of identical row or card elements during
// that urgent pass; the deferred render follows with the changed layout prop.
export const FrameDataTableContent = React.memo(
  FrameDataTableContentWithTooltips,
);

FrameDataTableContent.displayName = "FrameDataTableContent";
