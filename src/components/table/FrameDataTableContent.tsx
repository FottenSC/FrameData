import React from "react";
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
import { ColumnConfig } from "@/contexts/TableConfigContext";
import { ValueBadge } from "@/components/ui/ValueBadge";
import { ExpandableHitLevels } from "@/components/icons/ExpandableHitLevels";
import { useVirtualizer, useWindowVirtualizer } from "@tanstack/react-virtual";

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

export const FrameDataTableContent: React.FC<DataTableContentProps> = ({
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
    const renderCellContent = (move: Move, columnId: string) => {
        switch (columnId) {
            case "character":
                return move.CharacterName || "—";
            case "stance":
                return move.Stance || "—";
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
                    <ValueBadge
                        value={move.HitDec}
                        text={move.Hit}
                        badges={badges}
                    />
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
    };

    // Resolve scroll element, and create both virtualizers; pick the right one at render time
    const scrollEl = getScrollElement ? getScrollElement() : null;
    const elVirtualizer = useVirtualizer({
        count: moves.length,
        getScrollElement: () => scrollEl,
        estimateSize: () => 40,
        overscan: 12,
    });
    const winVirtualizer = useWindowVirtualizer({
        count: moves.length,
        estimateSize: () => 40,
        overscan: 12,
    });
    const useWindow =
        !scrollEl || scrollEl.scrollHeight <= scrollEl.clientHeight + 1;
    const rowVirtualizer = useWindow ? winVirtualizer : elVirtualizer;

    const virtualItems = rowVirtualizer.getVirtualItems();
    const totalSize = rowVirtualizer.getTotalSize();

    // Recompute on container resize (height changes)
    React.useEffect(() => {
        const target = useWindow ? window : scrollEl;
        if (!target) return;
        let ro: ResizeObserver | null = null;
        if (target instanceof Window) {
            const onResize = () => rowVirtualizer.measure();
            window.addEventListener("resize", onResize);
            return () => window.removeEventListener("resize", onResize);
        } else {
            ro = new ResizeObserver(() => rowVirtualizer.measure());
            ro.observe(target);
            return () => ro && ro.disconnect();
        }
    }, [scrollEl, rowVirtualizer, useWindow]);

    return (
        <Table ref={tableRef} className="table-layout-fixed">
            <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow className="border-b-card-border">
                    {visibleColumns.map((column) => {
                        const style: React.CSSProperties = {};
                        if (column.width) style.width = column.width;
                        if (column.minWidth) style.minWidth = column.minWidth;
                        if (column.maxWidth) style.maxWidth = column.maxWidth;
                        return (
                            <TableHead
                                key={column.id}
                                className={
                                    column.className +
                                    " cursor-pointer select-none"
                                }
                                style={style}
                                onClick={() =>
                                    handleSort(column.id as SortableColumn)
                                }
                                title={
                                    column.friendlyLabel
                                        ? column.friendlyLabel
                                        : column.label
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
                                    No moves found for this character or filter
                                    criteria.
                                </TableCell>
                            </TableRow>
                        );
                    }

                    // When virtualizing table rows, use spacer rows to maintain total height
                    const items = virtualItems;
                    const paddingTop = items.length > 0 ? items[0]!.start : 0;
                    const paddingBottom =
                        items.length > 0
                            ? totalSize - items[items.length - 1]!.end
                            : 0;

                    // Defensive fallback: if virtualizer hasn't produced items yet, render a small initial slice
                    if (items.length === 0) {
                        const slice = moves.slice(
                            0,
                            Math.min(30, moves.length),
                        );
                        return (
                            <>
                                {slice.map((move) => (
                                    <TableRow
                                        key={move.ID}
                                        className="border-b-card-border"
                                    >
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
                                                {renderCellContent(
                                                    move,
                                                    column.id,
                                                )}
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
                                        <div
                                            style={{ height: paddingTop }}
                                            aria-hidden
                                        />
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
                                            if (el)
                                                rowVirtualizer.measureElement(
                                                    el,
                                                );
                                        }}
                                    >
                                        {visibleColumns.map((column) => {
                                            const style: React.CSSProperties =
                                                {};
                                            if (column.width)
                                                style.width = column.width;
                                            if (column.minWidth)
                                                style.minWidth =
                                                    column.minWidth;
                                            if (column.maxWidth)
                                                style.maxWidth =
                                                    column.maxWidth;
                                            return (
                                                <TableCell
                                                    key={`${move.ID}-${column.id}`}
                                                    className={column.className}
                                                    style={style}
                                                >
                                                    {renderCellContent(
                                                        move,
                                                        column.id,
                                                    )}
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
                                        <div
                                            style={{ height: paddingBottom }}
                                            aria-hidden
                                        />
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
