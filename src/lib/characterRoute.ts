const COMPACT_CHARACTER_ROUTE_GAMES = new Set(["Tekken8"]);

/** Return the canonical URL segment for a character's display name. */
export const getCharacterRouteName = (gameId: string, name: string): string =>
  COMPACT_CHARACTER_ROUTE_GAMES.has(gameId) ? name.replace(/\s+/g, "") : name;

/** Resolve canonical routes and legacy routes that used the display name. */
export const findCharacterByRouteName = <T extends { name: string }>(
  gameId: string,
  routeName: string,
  characters: readonly T[],
): T | undefined => {
  const normalizedRouteName = routeName.toLowerCase();

  return characters.find(
    (character) =>
      character.name.toLowerCase() === normalizedRouteName ||
      getCharacterRouteName(gameId, character.name).toLowerCase() ===
        normalizedRouteName,
  );
};
