import React from "react";
import { Move, type Command } from "@/types/Move";
import type { ColumnConfig } from "@/contexts/TableConfigContext";
import type { PropertyInfo } from "@/contexts/GameContext";
import { MoveTableCell } from "./MoveTableCell";

interface MoveCardProps {
  move: Move;
  visibleColumns: ColumnConfig[];
  renderCommand: (command: Command | null) => React.ReactNode;
  renderNotes: (note: string | null) => React.ReactNode;
  copyCommand: (move: Move) => void;
  getStanceInfo: (stance: string, characterId: number) => any;
  getPropertyInfo: (prop: string) => PropertyInfo | null;
  badges?: Record<string, { className: string }>;
}

const primaryColumnIds = new Set([
  "character",
  "stance",
  "command",
  "hitLevel",
]);
const mainAttributeIds = new Set([
  "impact",
  "damage",
  "block",
  "hit",
  "counterHit",
  "guardBurst",
]);

export const isMoveCardMainAttribute = (columnId: string): boolean =>
  mainAttributeIds.has(columnId);

const hasColumnValue = (move: Move, columnId: string): boolean => {
  switch (columnId) {
    case "stance":
      return !!move.stance?.some((stance) => stance.trim() !== "");
    case "rawCommand":
      return !!move.stringCommand;
    case "properties":
      return (
        move.properties.length > 0 ||
        move.block.tags.length > 0 ||
        move.hit.tags.length > 0 ||
        move.counterHit.tags.length > 0
      );
    case "notes":
      return !!move.notes;
    default:
      return true;
  }
};

export const MoveCard: React.FC<MoveCardProps> = React.memo(
  ({
    move,
    visibleColumns,
    renderCommand,
    renderNotes,
    copyCommand,
    getStanceInfo,
    getPropertyInfo,
    badges,
  }) => {
    const characterColumn = visibleColumns.find(
      (column) => column.id === "character",
    );
    const stanceColumn = visibleColumns.find(
      (column) => column.id === "stance",
    );
    const commandColumn = visibleColumns.find(
      (column) => column.id === "command",
    );
    const hitLevelColumn = visibleColumns.find(
      (column) => column.id === "hitLevel",
    );
    const visibleStanceColumn =
      stanceColumn && hasColumnValue(move, "stance") ? stanceColumn : undefined;
    const mainAttributeColumns = visibleColumns.filter((column) =>
      isMoveCardMainAttribute(column.id),
    );
    const secondaryColumns = visibleColumns.filter(
      (column) =>
        !primaryColumnIds.has(column.id) &&
        !mainAttributeIds.has(column.id) &&
        hasColumnValue(move, column.id),
    );
    const mainAttributeGrid: React.CSSProperties = {
      gridTemplateColumns: `repeat(${mainAttributeColumns.length}, minmax(0, 1fr))`,
    };

    const renderCell = (columnId: string) => (
      <MoveTableCell
        move={move}
        columnId={columnId}
        renderCommand={renderCommand}
        renderNotes={renderNotes}
        copyCommand={copyCommand}
        getStanceInfo={getStanceInfo}
        getPropertyInfo={getPropertyInfo}
        badges={badges}
        layout="card"
      />
    );

    return (
      <article
        data-move-card
        className="group overflow-hidden rounded-xl border border-card-border border-l-4 border-l-primary/50 bg-card/20 shadow-sm"
      >
        <header className="px-2.5 py-2">
          {characterColumn && (
            <div className="mb-1 min-w-0 text-[10px] font-medium text-foreground">
              <span className="sr-only">
                {characterColumn.friendlyLabel || characterColumn.label}:
              </span>
              {renderCell("character")}
            </div>
          )}

          {(visibleStanceColumn || commandColumn || hitLevelColumn) && (
            <div className="flex min-w-0 items-center gap-2">
              {visibleStanceColumn && (
                <div className="min-w-0 max-w-[35%] shrink overflow-hidden border-r border-card-border pr-2 text-xs text-muted-foreground [&>div]:flex-nowrap [&>div]:overflow-hidden">
                  <span className="sr-only">
                    {visibleStanceColumn.friendlyLabel ||
                      visibleStanceColumn.label}
                    :
                  </span>
                  {renderCell("stance")}
                </div>
              )}
              {commandColumn && (
                <div className="min-w-0 flex-1">
                  <span className="sr-only">
                    {commandColumn.friendlyLabel || commandColumn.label}:
                  </span>
                  {renderCell("command")}
                </div>
              )}
              {hitLevelColumn && (
                <div
                  className="flex shrink-0 items-center border-l border-card-border pl-2"
                  title={hitLevelColumn.friendlyLabel || hitLevelColumn.label}
                >
                  <span className="sr-only">
                    {hitLevelColumn.friendlyLabel || hitLevelColumn.label}:
                  </span>
                  {renderCell("hitLevel")}
                </div>
              )}
            </div>
          )}
        </header>

        {mainAttributeColumns.length > 0 && (
          <div
            aria-label="Main frame data"
            className="mx-1.5 overflow-hidden rounded-md border border-card-border"
          >
            <div className="grid bg-background" style={mainAttributeGrid}>
              {mainAttributeColumns.map((column) => (
                <div
                  key={`value-${column.id}`}
                  role="group"
                  aria-label={column.friendlyLabel || column.label}
                  className="flex min-w-0 items-center justify-center overflow-visible border-r border-card-border px-0.5 py-1.5 text-xs last:border-r-0"
                >
                  {renderCell(column.id)}
                </div>
              ))}
            </div>
          </div>
        )}

        {secondaryColumns.length > 0 && (
          <dl className="mx-1.5 mb-1.5 mt-1.5 divide-y divide-card-border">
            {secondaryColumns.map((column) => (
              <div
                key={`${move.characterId}-${move.id}-${column.id}`}
                className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-2 px-1 py-1.5"
              >
                <dt className="pt-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {column.friendlyLabel || column.label}
                </dt>
                <dd className="min-w-0 text-xs">{renderCell(column.id)}</dd>
              </div>
            ))}
          </dl>
        )}
      </article>
    );
  },
);

MoveCard.displayName = "MoveCard";
