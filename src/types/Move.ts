export interface Move {
  id: number;
  stringCommand: string | null;
  command: string[] | null;
  stance: string[] | null;
  hitLevel: string[] | null;
  impact: number;
  damage: string | null;
  damageDec: number;
  block: string | null;
  blockDec: number;
  hit: string | null;
  hitDec: number;
  counterHit: string | null;
  counterHitDec: number;
  guardBurst: number;
  properties: string[] | null;
  notes: string | null;
  characterName: string;
  characterId: number;
}

export interface FilterCondition {
  id: string;
  type?: "condition";
  field: string;
  condition: string;
  value: string;
  value2?: string;
}

export type FilterGroupOperator = "and" | "or";

export interface FilterGroup {
  id: string;
  type: "group";
  operator: FilterGroupOperator;
  filters: FilterItem[];
}

export type FilterItem = FilterCondition | FilterGroup;

export type SortableColumn =
  | "character"
  | "stance"
  | "command"
  | "rawCommand"
  | "input"
  | "hitLevel"
  | "impact"
  | "damage"
  | "block"
  | "hit"
  | "counterHit"
  | "guardBurst"
  | "properties"
  | "notes";
