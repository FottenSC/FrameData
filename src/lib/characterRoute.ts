/** Return the canonical URL segment for a character's display name. */
export const getCharacterRouteName = (gameId: string, name: string): string =>
  gameId === "Tekken8" ? name.replace(/\s+/g, "") : name;

/** Resolve canonical routes and legacy routes that used the display name. */
export const findCharacterByRouteName = <T extends { name: string }>(
  gameId: string,
  routeName: string,
  characters: readonly T[],
): T | undefined => {
  const normalizedRouteName = getCharacterRouteName(
    gameId,
    routeName,
  ).toLowerCase();

  return characters.find(
    (character) =>
      getCharacterRouteName(gameId, character.name).toLowerCase() ===
      normalizedRouteName,
  );
};
