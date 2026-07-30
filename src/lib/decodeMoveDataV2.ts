import type {
  Command,
  CommandButton,
  CommandPress,
  Move,
  MoveOutcome,
} from "@/types/Move";

const SCHEMA_VERSION = 2;
const stringCache = new Map<string, string>();

const PAYLOAD_FIELDS = new Set(["schemaVersion", "moves"]);
const MOVE_FIELDS = new Set([
  "id",
  "stringCommand",
  "command",
  "stance",
  "hitLevel",
  "impact",
  "damage",
  "block",
  "hit",
  "counterHit",
  "guardBurst",
  "properties",
  "notes",
]);
const DAMAGE_FIELDS = new Set(["raw", "total"]);
const OUTCOME_FIELDS = new Set(["advantage", "tags", "raw"]);
const BUTTON_FIELDS = new Set(["b", "h"]);

export class MoveDataDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoveDataDecodeError";
  }
}

export function clearMoveDataStringCache(): void {
  stringCache.clear();
}

function intern(value: string): string {
  if (value.length > 40) return value;
  const cached = stringCache.get(value);
  if (cached !== undefined) return cached;
  stringCache.set(value, value);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertRecord(
  value: unknown,
  path: string,
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new MoveDataDecodeError(`${path} must be an object`);
  }
}

function assertKnownFields(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
): void {
  const unknown = Object.keys(value).find((key) => !allowed.has(key));
  if (unknown) {
    throw new MoveDataDecodeError(`${path}.${unknown} is not supported`);
  }
}

function readInteger(
  value: unknown,
  path: string,
  options: { optional?: boolean; positive?: boolean } = {},
): number | null {
  if (value === undefined && options.optional) return null;
  if (!Number.isInteger(value)) {
    throw new MoveDataDecodeError(`${path} must be an integer`);
  }
  const number = value as number;
  if (options.positive && number < 1) {
    throw new MoveDataDecodeError(`${path} must be positive`);
  }
  return number;
}

function readString(
  value: unknown,
  path: string,
  optional = true,
): string | null {
  if (value === undefined && optional) return null;
  if (typeof value !== "string" || value.length === 0) {
    throw new MoveDataDecodeError(`${path} must be a non-empty string`);
  }
  return value;
}

function readStringArray(
  value: unknown,
  path: string,
  optional = true,
): string[] | null {
  if (value === undefined && optional) return null;
  if (!Array.isArray(value) || value.length === 0) {
    throw new MoveDataDecodeError(`${path} must be a non-empty string array`);
  }
  return value.map((item, index) => {
    const text = readString(item, `${path}[${index}]`, false);
    return intern(text!);
  });
}

function readCommand(value: unknown, path: string): Command | null {
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.length === 0) {
    throw new MoveDataDecodeError(`${path} must be a non-empty command array`);
  }

  return value.map((step, stepIndex) => {
    const stepPath = `${path}[${stepIndex}]`;
    if (!Array.isArray(step) || step.length === 0) {
      throw new MoveDataDecodeError(`${stepPath} must contain alternatives`);
    }
    return step.map((alternative, alternativeIndex) => {
      const alternativePath = `${stepPath}[${alternativeIndex}]`;
      if (!Array.isArray(alternative) || alternative.length === 0) {
        throw new MoveDataDecodeError(
          `${alternativePath} must contain buttons`,
        );
      }
      const buttons: CommandButton[] = alternative.map(
        (button, buttonIndex) => {
          const buttonPath = `${alternativePath}[${buttonIndex}]`;
          assertRecord(button, buttonPath);
          assertKnownFields(button, BUTTON_FIELDS, buttonPath);
          const token = readString(button.b, `${buttonPath}.b`, false)!;
          if (button.h !== undefined && button.h !== true) {
            throw new MoveDataDecodeError(
              `${buttonPath}.h must be true when present`,
            );
          }
          const b = intern(token);
          return button.h === true ? { b, h: true } : { b };
        },
      );
      return buttons;
    }) as CommandPress[];
  });
}

function readOutcome(value: unknown, path: string): MoveOutcome {
  if (value === undefined) {
    return { advantage: null, tags: [], raw: null };
  }
  assertRecord(value, path);
  assertKnownFields(value, OUTCOME_FIELDS, path);
  if (Object.keys(value).length === 0) {
    throw new MoveDataDecodeError(`${path} must not be empty`);
  }

  return {
    advantage: readInteger(value.advantage, `${path}.advantage`, {
      optional: true,
    }),
    tags: readStringArray(value.tags, `${path}.tags`) ?? [],
    raw: readString(value.raw, `${path}.raw`),
  };
}

function decodeMove(
  value: unknown,
  index: number,
  characterId: number,
  characterName: string,
): Move {
  const path = `moves[${index}]`;
  assertRecord(value, path);
  assertKnownFields(value, MOVE_FIELDS, path);

  let damageRaw: string | null = null;
  let damageTotal: number | null = null;
  if (value.damage !== undefined) {
    assertRecord(value.damage, `${path}.damage`);
    assertKnownFields(value.damage, DAMAGE_FIELDS, `${path}.damage`);
    if (Object.keys(value.damage).length === 0) {
      throw new MoveDataDecodeError(`${path}.damage must not be empty`);
    }
    const raw = readString(value.damage.raw, `${path}.damage.raw`);
    damageRaw = raw === null ? null : intern(raw);
    damageTotal = readInteger(value.damage.total, `${path}.damage.total`, {
      optional: true,
    });
  }

  return {
    id: readInteger(value.id, `${path}.id`, { positive: true })!,
    characterId,
    characterName,
    stringCommand: readString(value.stringCommand, `${path}.stringCommand`),
    command: readCommand(value.command, `${path}.command`),
    stance: readStringArray(value.stance, `${path}.stance`),
    hitLevel: readStringArray(value.hitLevel, `${path}.hitLevel`),
    impact: readInteger(value.impact, `${path}.impact`, { optional: true }),
    damage: { raw: damageRaw, total: damageTotal },
    block: readOutcome(value.block, `${path}.block`),
    hit: readOutcome(value.hit, `${path}.hit`),
    counterHit: readOutcome(value.counterHit, `${path}.counterHit`),
    guardBurst: readInteger(value.guardBurst, `${path}.guardBurst`, {
      optional: true,
    }),
    properties: readStringArray(value.properties, `${path}.properties`) ?? [],
    notes: readString(value.notes, `${path}.notes`),
  };
}

export function decodeCharacterMovesV2(
  payload: unknown,
  characterId: number,
  characterName: string,
): Move[] {
  assertRecord(payload, "payload");
  assertKnownFields(payload, PAYLOAD_FIELDS, "payload");
  if (payload.schemaVersion !== SCHEMA_VERSION) {
    throw new MoveDataDecodeError(
      `unsupported schemaVersion ${String(payload.schemaVersion)}; expected ${SCHEMA_VERSION}`,
    );
  }
  if (!Array.isArray(payload.moves)) {
    throw new MoveDataDecodeError("payload.moves must be an array");
  }

  const internedCharacterName = intern(characterName);
  const ids = new Set<number>();
  return payload.moves.map((move, index) => {
    const decoded = decodeMove(move, index, characterId, internedCharacterName);
    if (ids.has(decoded.id)) {
      throw new MoveDataDecodeError(`moves[${index}].id is duplicated`);
    }
    ids.add(decoded.id);
    return decoded;
  });
}
