import { describe, expect, it } from "vitest";
import type { Command, Move } from "@/types/Move";
import { getGameFilterConfig } from "@/filters/gameFilterConfigs";
import { buildFieldAccessors } from "./moveAccessors";
import { getNotationStyle } from "./notation";

const makeMove = (command: Command, stance: string[] | null = null): Move => ({
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
});

const motionMove = makeMove([[[{ b: "qcf" }]], [[{ b: "B" }]]], ["WR"]);

const getQuickSearch = () => {
  const operator = getGameFilterConfig("Tekken8").customOperators?.find(
    (candidate) => candidate.id === "quickContains",
  );
  if (!operator) throw new Error("quickContains operator is missing");
  return operator;
};

describe("buildFieldAccessors search projections", () => {
  it.each([
    ["universal", "qcfB"],
    ["soulcalibur", "qcfB"],
    ["tekken", "qcfRP"],
    ["tekken-notation", "qcf2"],
  ])("matches motion input in the %s notation", (styleId, needle) => {
    const style = getNotationStyle(styleId);
    const accessors = buildFieldAccessors(style);
    const tokens = accessors.input.filterTokens?.(motionMove) ?? null;

    expect(tokens).not.toBeNull();
    expect(
      getQuickSearch().test({
        fieldType: "text",
        fieldString: accessors.input.filterString(motionMove),
        fieldNumber: null,
        fieldTokens: tokens,
        value: needle,
        value2: "",
      }),
    ).toBe(true);
  });

  it("keeps universal and expanded motion variants searchable in FBUD", () => {
    const accessors = buildFieldAccessors(getNotationStyle("tekken-notation"));
    const tokens = accessors.command.filterTokens?.(motionMove) ?? [];

    expect(tokens).toContain("qcf 2");
    expect(tokens).toContain("D DF F 2");
    expect(tokens).toContain("qcf B");
    expect(tokens).toContain("2 3 6 B");
  });

  it("preserves separate OR-command branches", () => {
    const move = makeMove([
      [[{ b: "2", h: true }], [{ b: "8", h: true }]],
      [[{ b: "B" }, { b: "C" }]],
    ]);
    const accessors = buildFieldAccessors(getNotationStyle("universal"));

    expect(accessors.command.filterTokens?.(move)).toEqual([
      "(2) B+C",
      "(8) B+C",
    ]);
  });

  it("reuses translated command and search token projections", () => {
    const accessors = buildFieldAccessors(getNotationStyle("tekken"));

    const firstCommandTokens = accessors.command.filterTokens?.(motionMove);
    const secondCommandTokens = accessors.command.filterTokens?.(motionMove);
    const firstInputTokens = accessors.input.filterTokens?.(motionMove);
    const secondInputTokens = accessors.input.filterTokens?.(motionMove);

    expect(secondCommandTokens).toBe(firstCommandTokens);
    expect(secondInputTokens).toBe(firstInputTokens);
    expect(accessors.command.filterString(motionMove)).toBe(
      accessors.command.filterString(motionMove),
    );
  });

  it("keeps normalized quick-search semantics stable across repeated calls", () => {
    const accessors = buildFieldAccessors(getNotationStyle("tekken-notation"));
    const tokens = accessors.input.filterTokens?.(motionMove) ?? null;
    const quickSearch = getQuickSearch();
    const args = {
      fieldType: "text" as const,
      fieldString: accessors.input.filterString(motionMove),
      fieldNumber: null,
      fieldTokens: tokens,
      value: "WR:QCF 2",
      value2: "",
    };

    expect(quickSearch.test(args)).toBe(true);
    expect(quickSearch.test(args)).toBe(true);
  });
});
