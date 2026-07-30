import type { Command } from "./Move";

export interface SerializedMoveDamageV2 {
  raw?: string;
  total?: number;
}

export interface SerializedMoveOutcomeV2 {
  advantage?: number;
  tags?: string[];
  raw?: string;
}

export interface SerializedMoveV2 {
  id: number;
  stringCommand?: string;
  command?: Command;
  stance?: string[];
  hitLevel?: string[];
  impact?: number;
  damage?: SerializedMoveDamageV2;
  block?: SerializedMoveOutcomeV2;
  hit?: SerializedMoveOutcomeV2;
  counterHit?: SerializedMoveOutcomeV2;
  guardBurst?: number;
  properties?: string[];
  notes?: string;
}

export interface CharacterMovesPayloadV2 {
  schemaVersion: 2;
  moves: SerializedMoveV2[];
}
