import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Move, SortableColumn } from "@/types/Move";
import { ValueBadge } from "@/components/ui/ValueBadge";
import { ExpandableHitLevels } from "@/components/icons/ExpandableHitLevels";

interface DataTableContentProps {
  moves: Move[];
  movesLoading: boolean;
  sortColumn: SortableColumn | null;
  sortDirection: "asc" | "desc";
  handleSort: (column: SortableColumn) => void;
  renderCommand: (command: string | null) => React.ReactNode;
  renderNotes: (note: string | null) => React.ReactNode;
  visibleColumns: any[];
  badges?: Record<string, { className: string }>;
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
}) => {
  const renderCellContent = (move: Move, columnId: string) => {
    switch (columnId) {
      case "stance":
        return move.Stance || "—";
      case "command":
        return renderCommand(move.Command);
      case "rawCommand":
        return move.Command || "—";
      case "hitLevel":
        return <ExpandableHitLevels hitLevelString={move.HitLevel} maxIconsToShow={3} />;
      case "impact":
        return move.Impact ?? "—";
      case "damage":
        return move.DamageDec ?? "—";
      case "block":
        return <ValueBadge value={move.BlockDec} text={move.Block} badges={badges} />;
      case "hit":
        return <ValueBadge value={move.HitDec} text={move.Hit} badges={badges} />;
      case "counterHit":
        return <ValueBadge value={move.CounterHitDec} text={move.CounterHit} badges={badges} />;
      case "guardBurst":
        return <ValueBadge value={move.GuardBurst} text={null} forceNoSign badges={badges} />;
      case "notes":
        return <div className="max-w-full truncate overflow-x-hidden overflow-y-visible">{renderNotes(move.Notes)}</div>;
      default:
        return "—";
    }
  };

  return (
    <Table className="table-layout-fixed">
      <TableHeader className="sticky top-0 bg-card z-10">
        <TableRow className="border-b-card-border">
          {visibleColumns.map((column) => {
            return (
              <TableHead
                key={column.id}
                className={column.colClasses}
                onClick={() => handleSort(column.id as SortableColumn)}
                title={column.friendlyLabel ? column.friendlyLabel : column.label}
              >
                <div className="flex items-center justify-between gap-1">
                  <span>{column.label}</span>
                  {sortColumn === column.id && (sortDirection === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
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
                <TableCell colSpan={visibleColumns.length} className="text-center h-24 p-2">
                  <div className="flex justify-center items-center">Loading moves...</div>
                </TableCell>
              </TableRow>
            );
          } else if (moves.length === 0) {
            return (
              <TableRow>
                <TableCell colSpan={visibleColumns.length} className="text-center h-24 p-2">
                  No moves found for this character or filter criteria.
                </TableCell>
              </TableRow>
            );
          }

          return moves.map((move) => (
            <TableRow key={move.ID} className="border-b-card-border">
              {visibleColumns.map((column) => (
                <TableCell key={`${move.ID}-${column.id}`} className={column.colClasses}>
                  {renderCellContent(move, column.id)}
                </TableCell>
              ))}
            </TableRow>
          ));
        })()}
      </TableBody>
    </Table>
  );
};
