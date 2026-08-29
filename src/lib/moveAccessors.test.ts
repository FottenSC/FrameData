import { describe, expect, it } from "vitest";

import { getGameFilterConfig } from "@/filters/gameFilterConfigs";
import { getNotationStyle, type NotationStyle } from "@/lib/notation";
import type { Command, Move } from "@/types/Move";
import { buildFieldAccessors } from "./moveAccessors";

const universal = getNotationStyle("universal")!;
const soulcalibur = getNotationStyle("soulcalibur")!;
const tekkenButtons = getNotationStyle("tekken")!;
const tekkenNotation = getNotationStyle("tekken-notation")!;

const quickContains = getGameFilterConfig("Tekken8", [
  "command",
]).customOperators!.find((operator) => operator.id === "quickContains")!;

function move(command: Command, stance: string[] | null = null): Move {
  return {
    id: 1,
    characterId: 1,
    characterName: "Test",
    stringCommand: null,
    command,
    stance,
    hitLevel: null,
    impact: null,
    damage: { raw: null, total: null },
    block: { advantage: null, tags: [], raw: null },
    hit: { advantage: null, tags: [], raw: null },
    counterHit: { advantage: null, tags: [], raw: null },
    guardBurst: null,
    properties: [],
    notes: null,
  };
}

function inputTokens(style: NotationStyle, value: Move): string[] {
  return buildFieldAccessors(style).input.filterTokens!(value) ?? [];
}

function quickMatches(
  style: NotationStyle,
  value: Move,
  query: string,
): boolean {
  const accessor = buildFieldAccessors(style).input;
  return quickContains.test({
    fieldType: "text",
    fieldString: accessor.filterString(value),
    fieldNumber: null,
    fieldTokens: accessor.filterTokens!(value),
    value: query,
    value2: "",
  });
}

describe("notation-aware quick-search projection", () => {
  it("searches only the active FBUD/1-4 notation", () => {
    const value = move([[[{ b: "6" }]], [[{ b: "B" }]]]);

    expect(inputTokens(tekkenNotation, value)).toEqual(["F 2"]);
    expect(quickMatches(tekkenNotation, value, "f2")).toBe(true);
    expect(quickMatches(tekkenNotation, value, "6B")).toBe(false);
  });

  it("does not treat canonical down-back as Tekken button 1", () => {
    const buttonOne = move([[[{ b: "A" }]]]);
    const downBack = move([[[{ b: "1" }]]]);

    expect(inputTokens(tekkenNotation, buttonOne)).toEqual(["1"]);
    expect(inputTokens(tekkenNotation, downBack)).toEqual(["DB"]);
    expect(quickMatches(tekkenNotation, buttonOne, "1")).toBe(true);
    expect(quickMatches(tekkenNotation, downBack, "1")).toBe(false);
  });

  it("keeps motion shorthand literal when FBUD renders it literally", () => {
    const value = move([[[{ b: "qcf" }]], [[{ b: "B" }]]]);

    expect(inputTokens(tekkenNotation, value)).toEqual(["qcf 2"]);
    expect(quickMatches(tekkenNotation, value, "qcf2")).toBe(true);
    expect(quickMatches(tekkenNotation, value, "236B")).toBe(false);
    expect(quickMatches(tekkenNotation, value, "d df f 2")).toBe(false);
  });

  it("expands shorthand for universal, Soulcalibur, and LP/RP styles", () => {
    const universalMove = move([[[{ b: "qcf" }]], [[{ b: "B" }]]]);
    const soulcaliburMove = move([[[{ b: "qcf" }]], [[{ b: "C" }]]]);

    expect(inputTokens(universal, universalMove)).toEqual(["2 3 6 B"]);
    expect(quickMatches(universal, universalMove, "236B")).toBe(true);
    expect(quickMatches(universal, universalMove, "qcfB")).toBe(false);

    expect(inputTokens(soulcalibur, soulcaliburMove)).toEqual(["2 3 6 K"]);
    expect(quickMatches(soulcalibur, soulcaliburMove, "236K")).toBe(true);
    expect(quickMatches(soulcalibur, soulcaliburMove, "qcfK")).toBe(false);

    expect(inputTokens(tekkenButtons, universalMove)).toEqual(["2 3 6 RP"]);
    expect(quickMatches(tekkenButtons, universalMove, "236RP")).toBe(true);
    expect(quickMatches(tekkenButtons, universalMove, "qcfRP")).toBe(false);
  });

  it("preserves held inputs, stance prefixes, plus presses, and OR branches", () => {
    const value = move(
      [
        [[{ b: "3", h: true }], [{ b: "6", h: true }]],
        [[{ b: "A" }, { b: "B" }]],
      ],
      ["WS"],
    );

    expect(inputTokens(universal, value)).toEqual(["WS (3) A+B", "WS (6) A+B"]);
    expect(quickMatches(universal, value, "ws3a+b")).toBe(true);
    expect(quickMatches(universal, value, "ws6a+b")).toBe(true);
    expect(quickMatches(universal, value, "ws36a+b")).toBe(false);
  });

  it("reprojects a retained query when notation changes", () => {
    const value = move([[[{ b: "6" }]], [[{ b: "B" }]]]);
    const retainedQuery = "f2";

    expect(quickMatches(tekkenNotation, value, retainedQuery)).toBe(true);
    expect(quickMatches(universal, value, retainedQuery)).toBe(false);
    expect(inputTokens(universal, value)).toEqual(["6 B"]);
  });
});
