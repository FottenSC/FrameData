import { afterEach, describe, expect, it, vi } from "vitest";
import type { Move } from "@/types/Move";
import { combineMoveQueryResults, fetchCharacterMoves } from "./useMoves";

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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("combineMoveQueryResults", () => {
  it("reports an empty query set as pending", () => {
    expect(combineMoveQueryResults([])).toMatchObject({
      data: [],
      isLoading: true,
      error: null,
      loaded: 0,
      total: 0,
    });
  });

  it("reports partial progress without revealing rows", () => {
    const result = combineMoveQueryResults([
      { data: [makeMove(1)] },
      { data: undefined, error: null },
    ]);

    expect(result).toMatchObject({
      data: [],
      isLoading: true,
      error: null,
      loaded: 1,
      total: 2,
    });
  });

  it("counts valid empty arrays as successfully loaded", () => {
    const result = combineMoveQueryResults([{ data: [] }, { data: [] }]);

    expect(result).toMatchObject({
      data: [],
      isLoading: false,
      error: null,
      loaded: 2,
      total: 2,
    });
  });

  it("reveals all rows only after every query succeeds", () => {
    const first = makeMove(1);
    const second = makeMove(2);
    const result = combineMoveQueryResults([
      { data: [first] },
      { data: [second] },
    ]);

    expect(result.data).toEqual([first, second]);
    expect(result).toMatchObject({
      isLoading: false,
      error: null,
      loaded: 2,
      total: 2,
    });
  });

  it("surfaces the first error and keeps partial rows hidden", () => {
    const error = new Error("character failed");
    const result = combineMoveQueryResults([
      { data: [makeMove(1)] },
      { data: undefined, error },
    ]);

    expect(result).toMatchObject({
      data: [],
      isLoading: false,
      error,
      loaded: 1,
      total: 2,
    });
  });
});

describe("fetchCharacterMoves", () => {
  it("accepts a valid empty character payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response('{"schemaVersion":2,"moves":[]}', {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(fetchCharacterMoves("Game", 1, "Test")).resolves.toEqual([]);
  });

  it("throws a descriptive HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("", {
          status: 404,
          statusText: "Not Found",
        }),
      ),
    );

    await expect(fetchCharacterMoves("Game", 1, "Test")).rejects.toThrow(
      "HTTP 404 Not Found",
    );
  });

  it("rejects malformed JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("{", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(fetchCharacterMoves("Game", 1, "Test")).rejects.toThrow(
      "Invalid move JSON",
    );
  });

  it("rejects a valid JSON value with the wrong shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response('{"schemaVersion":2}', {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(fetchCharacterMoves("Game", 1, "Test")).rejects.toThrow(
      "payload.moves must be an array",
    );
  });

  it("rejects an unsupported schema with a refresh hint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response('{"schemaVersion":1,"moves":[]}', {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(fetchCharacterMoves("Game", 1, "Test")).rejects.toThrow(
      "refresh the page",
    );
  });
});
