import { createRouter, createRoute, createRootRoute, Outlet, Navigate } from '@tanstack/react-router'
import { Navbar } from './components/Navbar'
import { CommandPalette } from './components/CommandPalette'
import { GameSelectionPage } from './components/GameSelectionPage'
import { CharacterSelectionPage } from './components/CharacterSelectionPage'
import { FrameDataTable } from './components/FrameDataTable'
import { GameProvider } from "./contexts/GameContext";
import { CommandProvider } from "./contexts/CommandContext";
import { UserSettingsProvider } from "./contexts/UserSettingsContext";
import { ToolbarProvider } from "./contexts/ToolbarContext";

// Root Route (Layout)
export const rootRoute = createRootRoute({
  component: () => (
    <UserSettingsProvider>
      <GameProvider>
        <CommandProvider>
          <ToolbarProvider>
            <div className="min-h-screen flex flex-col bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
              <Navbar />
              <CommandPalette />
              <main className="flex-grow">
                <Outlet />
              </main>
            </div>
          </ToolbarProvider>
        </CommandProvider>
      </GameProvider>
    </UserSettingsProvider>
  ),
})

// Index Route (Game Selection)
export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: GameSelectionPage,
})

// Game Route
export const gameRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '$gameId',
  component: CharacterSelectionPage,
})

// Character Route
export const characterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '$gameId/$characterName',
  component: FrameDataTable,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  gameRoute,
  characterRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
