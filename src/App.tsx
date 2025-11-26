import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { FrameDataTable } from "./components/FrameDataTable";
import { GameProvider } from "./contexts/GameContext";
import { CommandProvider } from "./contexts/CommandContext";
import { UserSettingsProvider } from "./contexts/UserSettingsContext";
import { Navbar } from "./components/Navbar";
import { GameSelectionPage } from "./components/GameSelectionPage";
import { CharacterSelectionPage } from "./components/CharacterSelectionPage";
import { CommandPalette } from "./components/CommandPalette";

function App() {
  return (
    <Router>
      <UserSettingsProvider>
        <GameProvider>
          <CommandProvider>
            <div className="min-h-screen flex flex-col bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
              <Navbar />
              <CommandPaletteContainer />
              <main className="flex-grow">
                <Routes>
                  <Route path="/" element={<Navigate to="/games" replace />} />
                  <Route path="/games" element={<GameSelectionPage />} />
                  <Route path="/:gameId" element={<CharacterSelectionPage />} />
                  <Route
                    path="/:gameId/:characterName"
                    element={<FrameDataTable />}
                  />
                </Routes>
              </main>
            </div>
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
