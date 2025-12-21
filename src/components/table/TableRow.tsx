import React from "react";
import { TableCell, TableRow as UITableRow } from "@/components/ui/table";
import { Move } from "@/types/Move";
import { ColumnConfig } from "@/contexts/UserSettingsContext";
import { MoveTableCell } from "./MoveTableCell";

interface TableRowProps {
  move: Move;
  visibleColumns: ColumnConfig[];
  renderCommand: (command: string[] | null) => React.ReactNode;
  renderNotes: (note: string | null) => React.ReactNode;
  copyCommand: (move: Move) => void;
  getStanceInfo: (stance: string, characterId: number) => any;
  getPropertyInfo: (prop: string) => any;
  badges?: Record<string, { className: string }>;
  measureRef?: (el: HTMLTableRowElement | null) => void;
  dataIndex?: number;
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
    measureRef,
    dataIndex,
  }) => (
    <UITableRow
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
