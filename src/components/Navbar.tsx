import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { Gamepad2, Sword } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { useGame } from '../contexts/GameContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from './ui/breadcrumb';

const gameIcons: Record<string, React.ReactNode> = {
  soulcalibur6: <Sword className="h-4 w-4 mr-1.5" />,
  tekken8: <Gamepad2 className="h-4 w-4 mr-1.5" />,
};

export const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedGame, characters, selectedCharacterId, setSelectedCharacterId } = useGame();

  const isActive = (path: string) => location.pathname === path;

  const handleGameClick = (event: React.MouseEvent) => {
    if (selectedCharacterId !== null) {
      setSelectedCharacterId(null);
      navigate(`/game/${selectedGame.id}`);
    }
  };
  
  const handleCharacterSelect = (value: string) => {
    if (!value) {
      // Handle case where selection is cleared (empty value)
      setSelectedCharacterId(null);
      navigate(`/game/${selectedGame.id}`);
      return;
    }

    // Parse the composite value "id|name"
    const [idString, name] = value.split('|');
    const selectedId = Number(idString);

    if (!isNaN(selectedId) && name) {
      setSelectedCharacterId(selectedId); // Set the ID in context
      // Navigate using the name directly from the parsed value
      navigate(`/game/${selectedGame.id}/character/${encodeURIComponent(name)}`);
    } else {
      // Fallback if parsing fails (shouldn't happen)
      console.error("Failed to parse character selection value:", value);
      setSelectedCharacterId(null);
      navigate(`/game/${selectedGame.id}`);
    }
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center px-4 sm:px-6 lg:px-8">
        <div className="mr-4 hidden md:flex items-center">
          <Link to="/games" className="mr-6 flex items-center space-x-2">
            <img src="/Horseface.png" alt="Horseface Logo" className="h-8 inline-block rounded-md" />
          </Link>
          
          <Breadcrumb className="hidden md:flex items-center">
            <BreadcrumbList>
              {selectedGame && (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link 
                        to="/games"
                        className="flex items-center hover:text-foreground/80 transition-colors"
                      >
                        {gameIcons[selectedGame.id] || <Gamepad2 className="h-4 w-4 mr-1.5 opacity-70" />}
                        <span className="font-medium">{selectedGame.name}</span>
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  {characters.length > 0 && (
                    <>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <Select
                          value={selectedCharacterId ? `${selectedCharacterId}|${characters.find(c => c.id === selectedCharacterId)?.name || ''}` : ""}
                          onValueChange={handleCharacterSelect}
                        >
                          <SelectTrigger className="h-auto py-0 px-1.5 text-sm font-medium border-none shadow-none bg-transparent focus:ring-0 focus:ring-offset-0 w-auto min-w-[150px] text-foreground/80 hover:text-foreground transition-colors [&>span]:line-clamp-1">
                            <SelectValue placeholder="Select Character" />
                          </SelectTrigger>
                          <SelectContent>
                            {characters.map((character) => (
                              <SelectItem
                                key={character.id}
                                value={`${character.id}|${character.name}`}
                              >
                                {character.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </BreadcrumbItem>
                    </>
                  )}
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        
        <div className="flex flex-1 items-center justify-end space-x-4">
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}; 