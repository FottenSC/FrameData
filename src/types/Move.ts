export interface Move {
  ID: number;
  Command: string;
  Stance: string | null;
  HitLevel: string| null;
  Impact: number;
  Damage: string | null;
  DamageDec: number;
  Block: string | null;
  BlockDec: number;
  Hit: string | null;
  HitDec: number;
  CounterHit: string | null;
  CounterHitDec: number;
  GuardBurst: number;
  Notes: string | null;
}

export interface FilterCondition {
  id: string;
  field: string;
  numericField: string | null;
  condition: string;
  value: string;
  value2?: string; // For range conditions
}

export type SortableColumn = 
  | "stance" 
  | "command" 
  | "rawCommand" 
  | "hitLevel" 
  | "impact" 
  | "damage" 
  | "block" 
  | "hit" 
  | "counterHit" 
  | "guardBurst" 
  | "notes"; 