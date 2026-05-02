import { createRouter, createRoute, createRootRoute, Outlet, Navigate } from '@tanstack/react-router'
import { Navbar } from './components/Navbar'
import { GameProvider } from "./contexts/GameContext";
import { CommandProvider } from "./contexts/CommandContext";
import { UserSettingsProvider } from "./contexts/UserSettingsContext";
import { ToolbarProvider } from "./contexts/ToolbarContext";
import React, { Suspense } from 'react';

// Lazy load components
const CommandPalette = React.lazy(() => import('./components/CommandPalette').then(m => ({ default: m.CommandPalette })))
const CreditsModal = React.lazy(() => import('./components/CreditsModal').then(m => ({ default: m.CreditsModal })))
const GameSelectionPage = React.lazy(() => import('./components/GameSelectionPage').then(m => ({ default: m.GameSelectionPage })))
const CharacterSelectionPage = React.lazy(() => import('./components/CharacterSelectionPage').then(m => ({ default: m.CharacterSelectionPage })))
const FrameDataTable = React.lazy(() => import('./components/FrameDataTable').then(m => ({ default: m.FrameDataTable })))

// Root Route (Layout)
export const rootRoute = createRootRoute({
  component: () => (
    <UserSettingsProvider>
      <GameProvider>
        <CommandProvider>
          <ToolbarProvider>
            <div className="min-h-screen flex flex-col bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
              <Navbar />
              <Suspense fallback={null}>
                <CommandPalette />
              </Suspense>
              <Suspense fallback={null}>
                <CreditsModal />
              </Suspense>
              <main className="flex-grow">
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
