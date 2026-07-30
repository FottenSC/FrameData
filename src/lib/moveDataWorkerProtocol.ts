import type { Move } from "@/types/Move";

export interface MoveWorkerLoadRequest {
  type: "load";
  requestId: number;
  gameId: string;
  characterId: number;
  characterName: string;
  url: string;
}

export interface MoveWorkerCancelRequest {
  type: "cancel";
  requestId: number;
}

export type MoveWorkerRequest = MoveWorkerLoadRequest | MoveWorkerCancelRequest;

export interface MoveWorkerSuccessResponse {
  type: "success";
  requestId: number;
  moves: Move[];
}

export interface MoveWorkerErrorResponse {
  type: "error";
  requestId: number;
  error: {
    name: string;
    message: string;
  };
}

export type MoveWorkerResponse =
  | MoveWorkerSuccessResponse
  | MoveWorkerErrorResponse;
