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
              // `hover:bg-muted/40` gives the click target a clear hover
              // affordance — without it the only signal the header is
              // sortable was the cursor change, easy to miss. Active
              // sort column gets a stronger background so it visually
              // pairs with its arrow indicator.
              className={
                column.className +
                " cursor-pointer select-none transition-colors hover:bg-muted/40 " +
                (sortColumn === column.id ? "bg-muted/30 " : "")
              }
              style={style}
              onClick={() => handleSort(column.id as SortableColumn)}
              title={column.friendlyLabel || column.label}
              aria-sort={
                sortColumn === column.id
                  ? sortDirection === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
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
