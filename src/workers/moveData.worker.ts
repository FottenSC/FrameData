import { fetchCharacterMovesDirect } from "@/lib/fetchCharacterMovesDirect";
import type {
  MoveWorkerRequest,
  MoveWorkerResponse,
} from "@/lib/moveDataWorkerProtocol";

interface MoveWorkerScope {
  onmessage: ((event: MessageEvent<MoveWorkerRequest>) => void) | null;
  postMessage(message: MoveWorkerResponse): void;
}

const workerScope = self as unknown as MoveWorkerScope;
const controllers = new Map<number, AbortController>();

workerScope.onmessage = (event) => {
  const request = event.data;
  if (request.type === "cancel") {
    controllers.get(request.requestId)?.abort();
    controllers.delete(request.requestId);
    return;
  }

  const controller = new AbortController();
  controllers.set(request.requestId, controller);

  void fetchCharacterMovesDirect(request, controller.signal)
    .then((moves) => {
      workerScope.postMessage({
        type: "success",
        requestId: request.requestId,
        moves,
      });
    })
    .catch((error: unknown) => {
      workerScope.postMessage({
        type: "error",
        requestId: request.requestId,
        error: {
          name: error instanceof Error ? error.name : "Error",
          message:
            error instanceof Error
              ? error.message
              : "Unknown move-data Worker error",
        },
      });
    })
    .finally(() => {
      controllers.delete(request.requestId);
    });
};
