export const COLUMN_IDS = [
  "character",
  "stance",
  "command",
  "rawCommand",
  "hitLevel",
  "impact",
  "damage",
  "block",
  "hit",
  "counterHit",
  "guardBurst",
  "properties",
  "notes",
] as const;

export type ColumnId = (typeof COLUMN_IDS)[number];

export interface ColumnDefinition {
  id: ColumnId;
  label: string;
  visible: boolean;
  order: number;
  friendlyLabel?: string;
  className: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
}

export const COLUMN_DEFINITIONS: readonly ColumnDefinition[] = [
  {
    id: "character",
    label: "Character",
    visible: true,
    order: -1,
    className: "pt-2 px-2",
    width: 100,
    minWidth: 100,
    maxWidth: 100,
  },
  {
    id: "stance",
    label: "Stance",
    visible: true,
    order: 0,
    className: "pt-2 px-2 text-right",
    width: 150,
    minWidth: 150,
    maxWidth: 150,
  },
  {
    id: "command",
    label: "Command",
    visible: true,
    order: 1,
    className: "pt-2 px-2",
    width: 200,
    minWidth: 200,
    maxWidth: 200,
  },
  {
    id: "rawCommand",
    label: "Raw Command",
    visible: false,
    order: 2,
    className: "pt-2 px-2",
    width: 210,
    minWidth: 210,
    maxWidth: 210,
  },
  {
    id: "hitLevel",
    label: "Hit Level",
    visible: true,
    order: 3,
    className: "pt-2 px-2",
    width: 135,
    minWidth: 135,
    maxWidth: 150,
  },
  {
    id: "impact",
    label: "Impact",
    visible: true,
    order: 4,
    className: "pt-2 px-2",
    width: 70,
    minWidth: 70,
    maxWidth: 70,
  },
  {
    id: "damage",
    label: "Damage",
    visible: true,
    order: 5,
    className: "pt-2 px-2",
    width: 80,
    minWidth: 80,
    maxWidth: 80,
  },
  {
    id: "block",
    label: "Block",
    visible: true,
    order: 6,
    className: "pt-2 px-2",
    width: 60,
    minWidth: 60,
    maxWidth: 60,
  },
  {
    id: "hit",
    label: "Hit",
    visible: true,
    order: 7,
    className: "pt-2 px-2",
    width: 60,
    minWidth: 60,
    maxWidth: 60,
  },
  {
    id: "counterHit",
    label: "CH",
    friendlyLabel: "Counter Hit",
    visible: true,
    order: 8,
    className: "pt-2 px-2",
    width: 60,
    minWidth: 60,
    maxWidth: 60,
  },
  {
    id: "guardBurst",
    label: "GB",
    friendlyLabel: "Guard Burst",
    visible: true,
    order: 9,
    className: "pt-2 px-2",
    width: 60,
    minWidth: 60,
    maxWidth: 60,
  },
  {
    id: "properties",
    label: "Properties",
    visible: true,
    order: 10,
    className: "pt-2 px-2",
    width: 150,
    minWidth: 150,
    maxWidth: 150,
  },
  {
    id: "notes",
    label: "Notes",
    visible: true,
    order: 11,
    className: "pt-2 px-2 overflow-visible",
  },
];

const COLUMN_ID_SET = new Set<string>(COLUMN_IDS);

export function isColumnId(value: unknown): value is ColumnId {
  return typeof value === "string" && COLUMN_ID_SET.has(value);
}

export function getDefaultColumns(
  availableColumns: readonly ColumnId[],
): ColumnDefinition[] {
  const available = new Set(availableColumns);
  return COLUMN_DEFINITIONS.filter((column) => available.has(column.id)).map(
    (column) => ({ ...column }),
  );
}
