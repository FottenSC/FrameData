import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Toaster } from "sonner";
import { FrameDataTable } from "./components/FrameDataTable";
import { GameProvider } from "./contexts/GameContext";
import { CommandProvider } from "./contexts/CommandContext";
import { UserSettingsProvider } from "./contexts/UserSettingsContext";
import { ToolbarProvider } from "./contexts/ToolbarContext";
import { Navbar } from "./components/Navbar";
import { GameSelectionPage } from "./components/GameSelectionPage";
import { CharacterSelectionPage } from "./components/CharacterSelectionPage";
import { CommandPalette } from "./components/CommandPalette";

function App() {
  return (
    <Router>
      <Toaster
        position="top-left"
        theme="dark"
        toastOptions={{
          style: {
            background: "hsl(0, 0%, 20%)",
            border: "1px solid hsla(0, 0%, 100%, 0.1)",
            color: "hsl(0, 0%, 98%)",
          },
        }}
      />
      <UserSettingsProvider>
        <GameProvider>
          <CommandProvider>
            <ToolbarProvider>
              <div className="min-h-screen flex flex-col bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
                <Navbar />
                <CommandPaletteContainer />
                <main className="flex-grow">
                  <Routes>
                    <Route
                      path="/"
                      element={<Navigate to="/games" replace />}
                    />
                    <Route path="/games" element={<GameSelectionPage />} />
                    <Route
                      path="/:gameId"
                      element={<CharacterSelectionPage />}
                    />
                    <Route
                      path="/:gameId/:characterName"
                      element={<FrameDataTable />}
                    />
                  </Routes>
                </main>
              </div>
            </ToolbarProvider>
          </CommandProvider>
        </GameProvider>
      </UserSettingsProvider>
    </Router>
  );
}

function CommandPaletteContainer() {
  return <CommandPalette />;
}

export default App;
