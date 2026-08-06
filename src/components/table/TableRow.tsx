import React from "react";
import { TableCell, TableRow as UITableRow } from "@/components/ui/table";
import { Move, type Command } from "@/types/Move";
import { ColumnConfig } from "@/contexts/UserSettingsContext";
import type { PropertyInfo } from "@/contexts/GameContext";
import { MoveTableCell } from "./MoveTableCell";

interface TableRowProps {
  move: Move;
  visibleColumns: ColumnConfig[];
  renderCommand: (command: Command | null) => React.ReactNode;
  renderNotes: (note: string | null) => React.ReactNode;
  copyCommand: (move: Move) => void;
  getStanceInfo: (stance: string, characterId: number) => any;
  getPropertyInfo: (prop: string) => PropertyInfo | null;
  badges?: Record<string, { className: string }>;
}

export const TableRow: React.FC<TableRowProps> = React.memo(
  ({
    move,
    visibleColumns,
    renderCommand,
    renderNotes,
    copyCommand,
    getStanceInfo,
    getPropertyInfo,
    badges,
  }) => (
    <UITableRow className="border-b-card-border">
      {visibleColumns.map((column) => {
        const style: React.CSSProperties = {};
        if (column.width) style.width = column.width;
        if (column.minWidth) style.minWidth = column.minWidth;
        if (column.maxWidth) style.maxWidth = column.maxWidth;
        return (
          <TableCell
            key={`${move.characterId}-${move.id}-${column.id}`}
            className={column.className}
            style={style}
          >
            <MoveTableCell
              move={move}
              columnId={column.id}
              renderCommand={renderCommand}
              renderNotes={renderNotes}
              copyCommand={copyCommand}
              getStanceInfo={getStanceInfo}
              getPropertyInfo={getPropertyInfo}
              badges={badges}
            />
          </TableCell>
        );
      })}
    </UITableRow>
  ),
);

TableRow.displayName = "TableRow";
