import type { Move } from "@/types/Move";
import type {
  MoveWorkerRequest,
  MoveWorkerResponse,
} from "@/lib/moveDataWorkerProtocol";
import type { CharacterMoveLoadRequest } from "@/lib/fetchCharacterMovesDirect";

interface WorkerLike {
  onmessage: ((event: MessageEvent<MoveWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: MoveWorkerRequest): void;
  terminate(): void;
}

interface PendingRequest {
  resolve: (moves: Move[]) => void;
  reject: (error: Error) => void;
  removeAbortListener: () => void;
}

export class MoveWorkerUnavailableError extends Error {
  constructor(message = "The move-data Worker is unavailable") {
    super(message);
    this.name = "MoveWorkerUnavailableError";
  }
}

function createAbortError(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) return signal.reason;
  return new DOMException(
    "The character move request was aborted",
    "AbortError",
  );
}

export class MoveDataWorkerClient {
  private worker: WorkerLike | null = null;
  private nextRequestId = 1;
  private readonly pending = new Map<number, PendingRequest>();

  constructor(private readonly workerFactory: () => WorkerLike) {}

  load(
    request: CharacterMoveLoadRequest,
    signal?: AbortSignal,
  ): Promise<Move[]> {
    if (signal?.aborted) return Promise.reject(createAbortError(signal));

    let worker: WorkerLike;
    try {
      worker = this.ensureWorker();
    } catch (error) {
      return Promise.reject(
        error instanceof MoveWorkerUnavailableError
          ? error
          : new MoveWorkerUnavailableError(
              error instanceof Error ? error.message : undefined,
            ),
      );
    }

    const requestId = this.nextRequestId++;
    return new Promise<Move[]>((resolve, reject) => {
      const handleAbort = () => {
        if (!this.pending.delete(requestId)) return;
        worker.postMessage({ type: "cancel", requestId });
        reject(createAbortError(signal!));
      };
      if (signal) signal.addEventListener("abort", handleAbort, { once: true });

      this.pending.set(requestId, {
        resolve,
        reject,
        removeAbortListener: () =>
          signal?.removeEventListener("abort", handleAbort),
      });
      worker.postMessage({ type: "load", requestId, ...request });
    });
  }

  dispose(): void {
    this.failTransport(
      new MoveWorkerUnavailableError("The move-data Worker was disposed"),
    );
  }

  private ensureWorker(): WorkerLike {
    if (this.worker) return this.worker;
    try {
      this.worker = this.workerFactory();
    } catch (error) {
      throw new MoveWorkerUnavailableError(
        error instanceof Error ? error.message : undefined,
      );
    }

    this.worker.onmessage = (event) => {
      const response = event.data;
      const pending = this.pending.get(response.requestId);
      if (!pending) return;
      this.pending.delete(response.requestId);
      pending.removeAbortListener();

      if (response.type === "success") {
        pending.resolve(response.moves);
        return;
      }

      const error = new Error(response.error.message);
      error.name = response.error.name;
      pending.reject(error);
    };
    this.worker.onerror = (event) => {
      this.failTransport(
        new MoveWorkerUnavailableError(
          event.message || "The move-data Worker stopped unexpectedly",
        ),
      );
    };
    return this.worker;
  }

  private failTransport(error: MoveWorkerUnavailableError): void {
    const worker = this.worker;
    this.worker = null;
    worker?.terminate();
    for (const pending of this.pending.values()) {
      pending.removeAbortListener();
      pending.reject(error);
    }
    this.pending.clear();
  }
}

let defaultClient: MoveDataWorkerClient | null = null;
let defaultWorkerUnavailable = false;

export function loadCharacterMovesInWorker(
  request: CharacterMoveLoadRequest,
  signal?: AbortSignal,
): Promise<Move[]> {
  if (defaultWorkerUnavailable || typeof Worker === "undefined") {
    return Promise.reject(new MoveWorkerUnavailableError());
  }

  defaultClient ??= new MoveDataWorkerClient(
    () =>
      new Worker(new URL("../workers/moveData.worker.ts", import.meta.url), {
        type: "module",
      }),
  );

  return defaultClient.load(request, signal).catch((error) => {
    if (error instanceof MoveWorkerUnavailableError) {
      defaultWorkerUnavailable = true;
      defaultClient?.dispose();
      defaultClient = null;
    }
    throw error;
  });
}
