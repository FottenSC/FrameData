import React, { useEffect } from "react";
import { useGame, avaliableGames } from "../contexts/GameContext";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Gamepad2 } from "lucide-react"; // Fallback icon
import {
  prefetchGameData,
  prefetchCharacterImages,
} from "@/lib/loadGameData";

/**
 * Warm the `CharacterSelectionPage` JS chunk. The component is loaded
 * via `React.lazy()` in the router, so the first navigation to `/$gameId`
 * triggers a chunk download + Suspense fallback. Calling the same dynamic
 * import primes Vite's module cache, and the eventual route transition
 * resolves synchronously.
 *
 * This is fire-and-forget; Vite dedupes concurrent `import()` calls.
 */
const prefetchCharacterSelectionChunk = () => {
  import("./CharacterSelectionPage").catch(() => {
    /* prefetch errors surface on the real route load */
  });
};

export const GameSelectionPage: React.FC = () => {
  const { setSelectedGameById } = useGame();

  // Warm the Game.json cache + the CharacterSelectionPage JS chunk for
  // every available game as soon as the landing page mounts.
  //
  //   - Game.json: ~21 KB each, a handful of games — the click target is
  //     by far the most likely next action, so the small speculative
  //     traffic more than pays for itself.
  //   - Route chunk: fetched once regardless of which tile is clicked.
  //
  // Character thumbnails are NOT prefetched eagerly (30 × ~13 KB per
  // game × several games = too much speculative traffic). Those are
  // warmed on hover below instead.
  useEffect(() => {
    // Route chunk is on the critical path for the very next click —
    // warm it right away rather than waiting for an idle window. It's
    // small (~5 KB) so there's no reason to defer.
    prefetchCharacterSelectionChunk();

    // Game.json prefetch is bigger (~21 KB × N) and only a "nice to
    // have" if the user clicks very fast, so keep it on the idle
    // schedule.
    const fire = () => {
      for (const g of avaliableGames) prefetchGameData(g.id);
    };
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(fire, { timeout: 500 });
      return () => window.cancelIdleCallback?.(handle);
    }
    const handle = window.setTimeout(fire, 0);
    return () => window.clearTimeout(handle);
  }, []);

  const handleGameSelect = (gameId: string) => {
    setSelectedGameById(gameId);
    // Navigation is now handled by the context's setSelectedGameById method
  };

  // Hover prefetch — cheap and covers the case where the user lingers
  // on one tile before clicking. All three calls are idempotent: a
  // second invocation for the same game is a no-op once caches are warm.
  //
  //   1. Ensure Game.json is in flight / parsed.
  //   2. Ensure the CharacterSelectionPage route chunk is in memory.
  //   3. Once Game.json resolves, kick off the 30-ish character
  //      thumbnail fetches so they're in the HTTP cache by the time the
  //      grid mounts.
  const handleGameHover = (gameId: string) => {
    prefetchGameData(gameId);
    prefetchCharacterSelectionChunk();
    prefetchCharacterImages(gameId);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Select a Game</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {avaliableGames.map((game) => (
          <Card
            key={game.id}
            className="hover:shadow-lg transition-shadow duration-200 cursor-pointer flex flex-col"
            onClick={() => handleGameSelect(game.id)}
            onMouseEnter={() => handleGameHover(game.id)}
            onFocus={() => handleGameHover(game.id)}
          >
            <CardHeader className="flex-grow">
              <h2 className="font-semibold leading-none tracking-tight flex items-center justify-center text-xl">
                {game.icon || <Gamepad2 className="h-5 w-5 mr-2 opacity-70" />}
                {game.name}
              </h2>
            </CardHeader>
            <CardContent className="flex justify-center mt-auto pt-4">
              {/* Optionally add more game info here */}
              <Button variant="outline" size="sm">
                Select
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
