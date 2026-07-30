import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  decodeCharacterMovesV2,
  MoveDataDecodeError,
} from "./decodeMoveDataV2";

describe("decodeCharacterMovesV2", () => {
  it("hydrates a complete V2 move and injects character identity", () => {
    const moves = decodeCharacterMovesV2(
      {
        schemaVersion: 2,
        moves: [
          {
            id: 7,
            stringCommand: "df+1",
            command: [
              [[{ b: "3", h: true }], [{ b: "6", h: true }]],
              [[{ b: "A" }, { b: "B" }]],
            ],
            stance: ["FC"],
            hitLevel: ["m"],
            impact: 13,
            damage: { raw: "8,12", total: 20 },
            block: { advantage: -3 },
            hit: { advantage: 8, tags: ["KND"] },
            counterHit: { tags: ["KND"], raw: "wall splat" },
            guardBurst: 0,
            properties: ["BA"],
            notes: "test note",
          },
        ],
      },
      42,
      "Test Character",
    );

    expect(moves).toEqual([
      {
        id: 7,
        characterId: 42,
        characterName: "Test Character",
        stringCommand: "df+1",
        command: [
          [[{ b: "3", h: true }], [{ b: "6", h: true }]],
          [[{ b: "A" }, { b: "B" }]],
        ],
        stance: ["FC"],
        hitLevel: ["m"],
        impact: 13,
        damage: { raw: "8,12", total: 20 },
        block: { advantage: -3, tags: [], raw: null },
        hit: { advantage: 8, tags: ["KND"], raw: null },
        counterHit: {
          advantage: null,
          tags: ["KND"],
          raw: "wall splat",
        },
        guardBurst: 0,
        properties: ["BA"],
        notes: "test note",
      },
    ]);
  });

  it("hydrates every omitted sparse field with its runtime default", () => {
    expect(
      decodeCharacterMovesV2(
        { schemaVersion: 2, moves: [{ id: 1 }] },
        3,
        "Minimal",
      ),
    ).toEqual([
      {
        id: 1,
        characterId: 3,
        characterName: "Minimal",
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
      },
    ]);
  });

  it.each([
    [
      "unsupported version",
      { schemaVersion: 1, moves: [] },
      "unsupported schemaVersion",
    ],
    [
      "malformed command",
      { schemaVersion: 2, moves: [{ id: 1, command: [[]] }] },
      "must contain alternatives",
    ],
    [
      "malformed outcome",
      { schemaVersion: 2, moves: [{ id: 1, hit: {} }] },
      "must not be empty",
    ],
    [
      "null optional value",
      { schemaVersion: 2, moves: [{ id: 1, notes: null }] },
      "must be a non-empty string",
    ],
    [
      "unknown field",
      { schemaVersion: 2, moves: [{ id: 1, legacy: true }] },
      "is not supported",
    ],
    [
      "duplicate IDs",
      { schemaVersion: 2, moves: [{ id: 1 }, { id: 1 }] },
      "is duplicated",
    ],
  ])("rejects %s", (_name, payload, message) => {
    expect(() => decodeCharacterMovesV2(payload, 1, "Test")).toThrowError(
      MoveDataDecodeError,
    );
    expect(() => decodeCharacterMovesV2(payload, 1, "Test")).toThrow(message);
  });

  it("decodes every generated move file against its manifest", () => {
    const gamesRoot = path.join(process.cwd(), "public", "Games");
    let moveCount = 0;

    for (const gameId of fs.readdirSync(gamesRoot)) {
      const gameDir = path.join(gamesRoot, gameId);
      const gamePath = path.join(gameDir, "Game.json");
      const charactersDir = path.join(gameDir, "Characters");
      if (!fs.existsSync(gamePath) || !fs.existsSync(charactersDir)) continue;

      const game = JSON.parse(fs.readFileSync(gamePath, "utf8")) as {
        characters: Array<{ id: number; name: string }>;
      };
      for (const character of game.characters) {
        const payload = JSON.parse(
          fs.readFileSync(
            path.join(charactersDir, `${character.id}.json`),
            "utf8",
          ),
        ) as unknown;
        moveCount += decodeCharacterMovesV2(
          payload,
          character.id,
          character.name,
        ).length;
      }
    }

    expect(moveCount).toBe(11_641);
  });
});
