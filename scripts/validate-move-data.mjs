import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const gamesRoot = path.join(repoRoot, "public", "Games");
const schemaPath = path.join(
  repoRoot,
  "FrameDataFactory",
  "schema",
  "move-data-v2.schema.json",
);

const readJson = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${path.relative(repoRoot, filePath)}: ${error.message}`);
  }
};

const schema = readJson(schemaPath);
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validatePayload = ajv.compile(schema);

const knownColumnIds = new Set([
  "character",
  "stance",
  "command",
  "rawCommand",
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
const structuralButtonPattern = /[:~_/<>]|\.\.\./;
const zeroWidthPattern = /[\u200b-\u200d\ufeff]/;
const plainDamagePattern = /^\d+(?:\s*,\s*\d+)*$/;

let gameCount = 0;
let fileCount = 0;
let moveCount = 0;
const failures = [];

for (const entry of fs.readdirSync(gamesRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;

  const gameDir = path.join(gamesRoot, entry.name);
  const gamePath = path.join(gameDir, "Game.json");
  const charactersDir = path.join(gameDir, "Characters");
  if (!fs.existsSync(gamePath) || !fs.existsSync(charactersDir)) continue;
  gameCount += 1;

  const game = readJson(gamePath);
  if (!Array.isArray(game.availableColumns)) {
    failures.push(`${entry.name}/Game.json: availableColumns must be an array`);
  } else {
    const seenColumns = new Set();
    for (const [index, columnId] of game.availableColumns.entries()) {
      if (typeof columnId !== "string" || !knownColumnIds.has(columnId)) {
        failures.push(
          `${entry.name}/Game.json: availableColumns[${index}] is unknown: ${JSON.stringify(columnId)}`,
        );
      } else if (seenColumns.has(columnId)) {
        failures.push(
          `${entry.name}/Game.json: duplicate available column ${columnId}`,
        );
      }
      seenColumns.add(columnId);
    }
  }
  if (!Array.isArray(game.characters)) {
    failures.push(`${entry.name}/Game.json: characters must be an array`);
    continue;
  }

  const manifestIds = [];
  for (const [index, character] of game.characters.entries()) {
    if (
      typeof character !== "object" ||
      character === null ||
      !Number.isInteger(character.id) ||
      character.id < 1
    ) {
      failures.push(
        `${entry.name}/Game.json: characters[${index}].id must be a positive integer`,
      );
      continue;
    }
    manifestIds.push(character.id);
  }

  const duplicateManifestIds = manifestIds.filter(
    (id, index) => manifestIds.indexOf(id) !== index,
  );
  if (duplicateManifestIds.length > 0) {
    failures.push(
      `${entry.name}/Game.json: duplicate character IDs ${[
        ...new Set(duplicateManifestIds),
      ].join(", ")}`,
    );
  }

  const sharedStances = new Set(Object.keys(game.stances ?? {}));
  const stancesByCharacterId = new Map(
    game.characters
      .filter(
        (character) =>
          typeof character === "object" &&
          character !== null &&
          Number.isInteger(character.id),
      )
      .map((character) => [
        character.id,
        new Set([
          ...sharedStances,
          ...Object.keys(character.stances ?? {}),
        ]),
      ]),
  );

  const expectedFiles = new Set(manifestIds.map((id) => `${id}.json`));
  const actualFiles = fs
    .readdirSync(charactersDir)
    .filter((name) => name.endsWith(".json"))
    .sort((left, right) =>
      left.localeCompare(right, undefined, { numeric: true }),
    );
  for (const expected of expectedFiles) {
    if (!actualFiles.includes(expected)) {
      failures.push(`${entry.name}/Characters/${expected}: file is missing`);
    }
  }
  for (const actual of actualFiles) {
    if (!expectedFiles.has(actual)) {
      failures.push(`${entry.name}/Characters/${actual}: stale character file`);
    }
  }

  for (const fileName of actualFiles) {
    fileCount += 1;
    const filePath = path.join(charactersDir, fileName);
    const payload = readJson(filePath);
    if (zeroWidthPattern.test(JSON.stringify(payload))) {
      failures.push(
        `${entry.name}/Characters/${fileName}: contains an invisible zero-width character`,
      );
    }
    if (!validatePayload(payload)) {
      const details = ajv.errorsText(validatePayload.errors, {
        dataVar: path.relative(repoRoot, filePath),
        separator: "; ",
      });
      failures.push(details);
      continue;
    }

    const ids = new Set();
    const knownStances = stancesByCharacterId.get(Number.parseInt(fileName, 10));
    for (const [index, move] of payload.moves.entries()) {
      if (ids.has(move.id)) {
        failures.push(
          `${entry.name}/Characters/${fileName}: duplicate move id ${move.id} at moves[${index}]`,
        );
      }
      ids.add(move.id);
      if ((move.damage?.total ?? 0) >= 1000) {
        failures.push(
          `${entry.name}/Characters/${fileName}: implausible damage total ${move.damage.total} at moves[${index}] (${move.stringCommand ?? "unknown command"})`,
        );
      }

      const damageRaw = move.damage?.raw;
      const hasDamageTotal = Object.hasOwn(move.damage ?? {}, "total");
      if (
        entry.name === "Tekken8" &&
        damageRaw &&
        plainDamagePattern.test(damageRaw)
      ) {
        const expectedTotal = damageRaw
          .split(",")
          .reduce((sum, part) => sum + Number.parseInt(part.trim(), 10), 0);
        if (!hasDamageTotal || move.damage.total !== expectedTotal) {
          failures.push(
            `${entry.name}/Characters/${fileName}: damage total must equal ${expectedTotal} for ${JSON.stringify(damageRaw)} at moves[${index}] (${move.stringCommand ?? "unknown command"})`,
          );
        }
      } else if (entry.name === "Tekken8" && damageRaw && hasDamageTotal) {
        failures.push(
          `${entry.name}/Characters/${fileName}: ambiguous damage ${JSON.stringify(damageRaw)} must not have a computed total at moves[${index}] (${move.stringCommand ?? "unknown command"})`,
        );
      }

      for (const stance of move.stance ?? []) {
        if (!knownStances?.has(stance)) {
          failures.push(
            `${entry.name}/Characters/${fileName}: unknown stance ${JSON.stringify(stance)} at moves[${index}] (${move.stringCommand ?? "unknown command"})`,
          );
        }
        if (
          entry.name === "Tekken8" &&
          stance !== "CH" &&
          stance.split(".").includes("CH")
        ) {
          failures.push(
            `${entry.name}/Characters/${fileName}: counter-hit condition must be a separate CH stance at moves[${index}] (${move.stringCommand ?? "unknown command"})`,
          );
        }
      }

      for (const step of move.command ?? []) {
        for (const alternative of step) {
          for (const button of alternative) {
            if (structuralButtonPattern.test(button.b)) {
              failures.push(
                `${entry.name}/Characters/${fileName}: structural separator embedded in command token ${JSON.stringify(button.b)} at moves[${index}] (${move.stringCommand ?? "unknown command"})`,
              );
            }
          }
        }
      }
    }
    moveCount += payload.moves.length;
  }
}

if (failures.length > 0) {
  console.error(
    `Move-data validation failed with ${failures.length} error(s):`,
  );
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Validated ${moveCount.toLocaleString("en-US")} moves in ${fileCount} character files across ${gameCount} games.`,
);
