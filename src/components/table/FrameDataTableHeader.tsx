import React from "react";
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowDown, ArrowUp } from "lucide-react";
import { SortableColumn } from "@/types/Move";
import { ColumnConfig } from "@/contexts/UserSettingsContext";

interface FrameDataTableHeaderProps {
  visibleColumns: ColumnConfig[];
  sortColumn: SortableColumn | null;
  sortDirection: "asc" | "desc";
  handleSort: (column: SortableColumn) => void;
}

export const FrameDataTableHeader: React.FC<FrameDataTableHeaderProps> = ({
  visibleColumns,
  sortColumn,
  sortDirection,
  handleSort,
}) => {
  return (
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
};
