import {
  createRouter,
  createRoute,
  createRootRoute,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { Navbar } from "./components/Navbar";
import { GameProvider, avaliableGames } from "./contexts/GameContext";
import { loadGameData } from "./lib/loadGameData";
import { CommandProvider } from "./contexts/CommandContext";
import { UserSettingsProvider } from "./contexts/UserSettingsContext";
import { TableConfigProvider } from "./contexts/TableConfigContext";
import { ToolbarProvider } from "./contexts/ToolbarContext";
import React, { Suspense } from "react";
import { CommandPaletteLoader } from "./components/CommandPaletteLoader";
import {
  findCharacterByRouteName,
  getCharacterRouteName,
} from "./lib/characterRoute";

// Lazy load components
const GameSelectionPage = React.lazy(() =>
  import("./components/GameSelectionPage").then((m) => ({
    default: m.GameSelectionPage,
  })),
);
const CharacterSelectionPage = React.lazy(() =>
  import("./components/CharacterSelectionPage").then((m) => ({
    default: m.CharacterSelectionPage,
  })),
);
const FrameDataTable = React.lazy(() =>
  import("./components/FrameDataTable").then((m) => ({
    default: m.FrameDataTable,
  })),
);

// Root Route (Layout)
export const rootRoute = createRootRoute({
  component: () => (
    <UserSettingsProvider>
      <GameProvider>
        <TableConfigProvider>
          <CommandProvider>
            <ToolbarProvider>
              <div className="h-dvh overflow-hidden flex flex-col bg-background text-foreground">
                <Navbar />
                <CommandPaletteLoader />
                <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  {/*
                  Empty Suspense fallback by design. With route chunks
                  prefetched on idle / hover from the game-selection
                  page, the common case is that the destination chunk is
                  already in memory — no fallback needed. On a genuine
                  cache miss a blank flash is still less jarring than a
                  mid-page "Loading…" text jump, because
                  `startTransition`-wrapped navigations will keep the
                  previous route visible until React can show the next
                  one anyway.
                */}
                  <Suspense fallback={null}>
                    <Outlet />
                  </Suspense>
                </main>
              </div>
            </ToolbarProvider>
          </CommandProvider>
        </TableConfigProvider>
      </GameProvider>
    </UserSettingsProvider>
  ),
});

// Index Route (Game Selection)
export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: GameSelectionPage,
});

// Game Route — character-selection page for one game.
export const gameRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "$gameId",
  // Bounce unknown game ids to the landing page before the route renders,
  // so no component has to cope with an invalid `$gameId`.
  loader: ({ params }) => {
    if (!avaliableGames.some((g) => g.id === params.gameId)) {
      throw redirect({ to: "/" });
    }
  },
  component: CharacterSelectionPage,
});

// Character Route — the frame-data table for one character (or "All").
export const characterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "$gameId/$characterName",
  // Validate both segments up front. An unknown game bounces home; an
  // unknown character bounces to that game's first character (matching the
  // old in-component fallback). Game.json is fetched through the shared
  // `loadGameData` cache, so this is free once the game has been opened.
  loader: async ({ params }) => {
    if (!avaliableGames.some((g) => g.id === params.gameId)) {
      throw redirect({ to: "/" });
    }
    const name = decodeURIComponent(params.characterName);
    if (name.toLowerCase() === "all") return;
    let data;
    try {
      data = await loadGameData(params.gameId);
    } catch {
      // Network/parse failure — let the page render and surface the error
      // through GameContext rather than redirecting on a transient fault.
      return;
    }
    const known = findCharacterByRouteName(
      params.gameId,
      name,
      data.characters,
    );
    if (!known) {
      // Pattern + params form (not a template string): the router's typed
      // `to` only accepts the known route patterns, and it URL-encodes the
      // param values itself — so `characterName` is passed raw here.
      const first = data.characters[0];
      throw redirect(
        first
          ? {
              to: "/$gameId/$characterName",
              params: {
                gameId: params.gameId,
                characterName: getCharacterRouteName(params.gameId, first.name),
              },
            }
          : { to: "/$gameId", params: { gameId: params.gameId } },
      );
    }

    const canonicalName = getCharacterRouteName(params.gameId, known.name);
    if (name !== canonicalName) {
      throw redirect({
        to: "/$gameId/$characterName",
        params: { gameId: params.gameId, characterName: canonicalName },
        replace: true,
      });
    }
  },
  component: FrameDataTable,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  gameRoute,
  characterRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
