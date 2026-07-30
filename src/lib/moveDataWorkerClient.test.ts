import { describe, expect, it, vi } from "vitest";
import type { Move } from "@/types/Move";
import type {
  MoveWorkerRequest,
  MoveWorkerResponse,
} from "./moveDataWorkerProtocol";
import {
  MoveDataWorkerClient,
  MoveWorkerUnavailableError,
} from "./moveDataWorkerClient";

const makeMove = (id: number): Move => ({
  id,
  characterId: 1,
  characterName: "Test",
  stringCommand: null,
  command: null,
  stance: null,
  hitLevel: null,
  impact: null,
  damage: { raw: null, total: null },
  block: { advantage: null, tags: [], raw: null },
  hit: { advantage: null, tags: [], raw: null },
  counterHit: { advantage: null, tags: [], raw: null },
  guardBurst: null,
  properties: [],
  notes: null,
});

class FakeWorker {
  onmessage: ((event: MessageEvent<MoveWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  messages: MoveWorkerRequest[] = [];
  terminate = vi.fn();

  postMessage(message: MoveWorkerRequest) {
    this.messages.push(message);
  }

  respond(response: MoveWorkerResponse) {
    this.onmessage?.({ data: response } as MessageEvent<MoveWorkerResponse>);
  }

  crash(message: string) {
    this.onerror?.({ message } as ErrorEvent);
  }
}

const request = (characterId: number) => ({
  gameId: "Game",
  characterId,
  characterName: `Character ${characterId}`,
  url: `/Games/Game/Characters/${characterId}.json`,
});

describe("MoveDataWorkerClient", () => {
  it("routes concurrent successful responses to the matching request", async () => {
    const worker = new FakeWorker();
    const client = new MoveDataWorkerClient(() => worker);

    const first = client.load(request(1));
    const second = client.load(request(2));
    const loads = worker.messages.filter((message) => message.type === "load");

    worker.respond({
      type: "success",
      requestId: loads[1]!.requestId,
      moves: [makeMove(2)],
    });
    worker.respond({
      type: "success",
      requestId: loads[0]!.requestId,
      moves: [makeMove(1)],
    });

    await expect(first).resolves.toEqual([makeMove(1)]);
    await expect(second).resolves.toEqual([makeMove(2)]);
  });

  it("reconstructs errors returned by the Worker", async () => {
    const worker = new FakeWorker();
    const client = new MoveDataWorkerClient(() => worker);
    const result = client.load(request(1));
    const load = worker.messages[0]!;

    worker.respond({
      type: "error",
      requestId: load.requestId,
      error: { name: "MoveDataDecodeError", message: "invalid payload" },
    });

    await expect(result).rejects.toMatchObject({
      name: "MoveDataDecodeError",
      message: "invalid payload",
    });
  });

  it("cancels an in-flight Worker request through AbortSignal", async () => {
    const worker = new FakeWorker();
    const client = new MoveDataWorkerClient(() => worker);
    const controller = new AbortController();
    const result = client.load(request(1), controller.signal);
    const load = worker.messages[0]!;

    controller.abort();

    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(worker.messages).toContainEqual({
      type: "cancel",
      requestId: load.requestId,
    });
  });

  it("rejects all concurrent work when the Worker transport crashes", async () => {
    const worker = new FakeWorker();
    const client = new MoveDataWorkerClient(() => worker);
    const first = client.load(request(1));
    const second = client.load(request(2));

    worker.crash("worker crashed");

    await expect(first).rejects.toBeInstanceOf(MoveWorkerUnavailableError);
    await expect(second).rejects.toBeInstanceOf(MoveWorkerUnavailableError);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("reports Worker construction failure as unavailable", async () => {
    const client = new MoveDataWorkerClient(() => {
      throw new Error("blocked by policy");
    });

    await expect(client.load(request(1))).rejects.toBeInstanceOf(
      MoveWorkerUnavailableError,
    );
  });
});
