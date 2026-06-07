# FrameData structure review

## Summary

The app already has a useful direction: static generated JSON, a typed runtime
`Move` model, React Query for character files, and a central accessor registry
for table behavior. The next structural gains should come from making the data
contract explicit, making generation reproducible, and reducing places where
the same concept is defined more than once.

## Highest-impact changes

1. Create a shared schema package for generated data.

   `public/Games/*` is the real API for the frontend, but the contract is
   currently implicit across `FrameDataFactory`, `loadGameData`, `useMoves`,
   and `Move.ts`. Add schemas for `Game.json`, character move files, command
   tokens, outcomes, property codes, hit levels, and stances. Use them in the
   factory scripts and in dev-time frontend validation.

   A good target is: factory output is already the canonical frontend shape.
   That means removing the PascalCase/raw conversion from runtime paths and
   leaving the app to fetch typed data rather than repair it.

2. Add validation gates and tests around that schema.

   `npm run build` passes, but there is no test script and no visible CI
   workflow. Add a validation command that checks every `public/Games` file,
   verifies referenced images/icons exist, and runs fixture tests for factory
   parsers. Run that in CI alongside `tsc`.

3. Split generated data from curated metadata.

   The factory scripts currently preserve and merge existing `Game.json`
   content. That is convenient, but it mixes generated source-of-truth data
   with hand-authored descriptions, class names, credits, community links, and
   images. Store curated metadata separately and have the factory join it with
   generated rows at export time.

4. Make data generation reproducible.

   Add a Python dependency file, stable CLI entrypoints, source snapshots or
   fixtures, deterministic output ordering, and a dry-run/diff mode. The
   Tekken importer fetches live network data and writes production JSON
   directly; that should be explicit and repeatable.

5. Split game catalog data out of `GameContext`.

   `GameContext` currently owns supported-game definitions, route-derived state,
   loaded game metadata, notation defaults, icon lookup, navigation helpers, and
   selected-character derivation. Move static catalog data to a plain module or
   generated manifest plus a small UI registry for React icons/classes. Leave
   context responsible for runtime state only.

   This also fixes the misspelled exported API name `avaliableGames` before it
   spreads further.

6. Extend the existing accessor registry into a full column registry.

   Column identity is spread across `defaultColumns`, `defaultFields`,
   `buildFieldAccessors`, `MoveTableCell`, export logic, and filter UI labels.
   `moveAccessors.ts` is the right foundation; extend it so the same registry
   also contains display metadata, sizing, default visibility, field type,
   filter operators, export behavior, and renderer id.

   User settings should persist only user overrides keyed by stable column id.
   The defaults should come from the registry. Add settings versioning and
   consider per-game column settings before the column set becomes
   game-specific.

7. Extract the filter model from `FilterBuilder`.

   `FilterBuilder.tsx` is doing tree editing, preset definitions, operator
   selection, inactive-filter pruning, semantic equality, and all rendering in
   one file. Move tree operations into a pure module with tests, move presets
   and pinned quick search config into their own module, and split row/group UI
   components into small files.

8. Modularize `FrameDataFactory`.

   The Tekken and SoulCalibur importers repeat concepts that should be shared:
   outcome parsing, command parsing, descriptor merging, character manifest
   writing, JSON formatting, asset download/copy behavior, and validation.
   A better shape is `factory/core` for schema/writer/parser helpers and
   `factory/games/{game}` for source adapters.

9. Revisit the all-characters loading strategy.

   `useMoves` fans out one query per character. That is fine at 29 to 40
   characters, but it scales poorly and currently waits to reveal table data
   until all character files have loaded. Once the schema is stable, consider
   generated aggregate indexes, compressed per-game bundles, or progressive
   display with stable table loading states.

10. Add generated manifests for data and assets.

   Let the factory emit a game manifest with game ids, character ids/slugs,
   image filenames, icon roots, data version/hash, and generated timestamp.
   Vite and the app can consume that manifest instead of independently scanning
   `public/Games` or hardcoding supported games. The manifest should also
   validate that all referenced assets exist.

11. Clean up repository mechanics.

   Pick one package manager lockfile, exclude generated logs/build artifacts
   consistently, and keep generated data updates separate from source changes
   when possible. The current worktree has broad generated-data churn mixed with
   app source changes, which makes structural review and code review harder.

## Evidence

- `src/contexts/GameContext.tsx` defines the `Game` type, hardcoded
  `avaliableGames`, directional icons, loaded data state, navigation setters,
  notation style selection, and lookup helpers in one provider.
- `src/contexts/UserSettingsContext.tsx`, `src/filters/gameFilterConfigs.ts`,
  `src/lib/moveAccessors.ts`, and `src/components/table/MoveTableCell.tsx`
  each know about table columns from a different angle.
- `src/components/FilterBuilder.tsx` is over 1,200 lines and contains both pure
  filter-tree algorithms and UI rendering.
- `src/hooks/useMoves.ts` converts generated PascalCase JSON into the runtime
  `Move` model on every fetched character file.
- `FrameDataFactory/Tekken8/ImportFrameDataFromWavu.py` is over 1,300 lines and
  owns fetching, source parsing, schema shaping, metadata merging, image
  downloading, and file writing.
- Both factory scripts preserve existing `Game.json` while generating new
  output, which blends curated and generated data.
- `useMoves` implements the "All" view as a per-character query fan-out.
- `tableColumnConfig` is a global localStorage key with no schema version.
- The generated character JSON is about 9.9 MB across 69 characters and 11,641
  moves. The two games share the same field set, but vocabulary normalization is
  inconsistent enough to deserve validation at generation time.

## Suggested migration order

1. Add schemas and validation in report-only mode.
2. Add CI checks for generated data, schemas, and fixtures.
3. Introduce the unified column registry while preserving existing UI behavior.
4. Split generated and curated metadata in the factory pipeline.
5. Extract and test the filter tree model.
6. Generate a game manifest and switch catalog reads to it.
7. Refactor factory scripts behind shared writer/parser helpers.
8. Convert generated character JSON to canonical camelCase/runtime shape.
