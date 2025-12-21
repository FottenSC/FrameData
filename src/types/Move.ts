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
  field: string;
  numericField: string | null;
  condition: string;
  value: string;
  value2?: string;
}

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
