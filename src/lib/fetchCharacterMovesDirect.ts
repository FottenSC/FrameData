import {
  decodeCharacterMovesV2,
  MoveDataDecodeError,
} from "@/lib/decodeMoveDataV2";
import type { Move } from "@/types/Move";

export interface CharacterMoveLoadRequest {
  gameId: string;
  characterId: number;
  characterName: string;
  url: string;
}

function abortReason(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) return signal.reason;
  return new DOMException(
    "The character move request was aborted",
    "AbortError",
  );
}

export async function fetchCharacterMovesDirect(
  request: CharacterMoveLoadRequest,
  signal?: AbortSignal,
): Promise<Move[]> {
  let response: Response;
  try {
    response = await fetch(request.url, { signal });
  } catch (error) {
    if (signal?.aborted) throw abortReason(signal);
    const detail = error instanceof Error ? `: ${error.message}` : "";
    throw new Error(
      `Failed to load moves for ${request.characterName} (${request.gameId}/${request.characterId})${detail}`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `Failed to load moves for ${request.characterName} (${request.gameId}/${request.characterId}): HTTP ${response.status} ${response.statusText}`.trim(),
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    throw new Error(
      `Invalid move JSON for ${request.characterName} (${request.gameId}/${request.characterId})${detail}`,
    );
  }

  try {
    return decodeCharacterMovesV2(
      data,
      request.characterId,
      request.characterName,
    );
  } catch (error) {
    const detail =
      error instanceof MoveDataDecodeError ? `: ${error.message}` : "";
    throw new Error(
      `Invalid move data for ${request.characterName} (${request.gameId}/${request.characterId})${detail}. The data format changed; refresh the page and try again.`,
    );
  }
}
