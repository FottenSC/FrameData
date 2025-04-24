import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Gamepad2, Sword, Command } from 'lucide-react';
import { useGame } from '../contexts/GameContext';
import { useCommand } from '../contexts/CommandContext';
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
import { Button } from './ui/button';

const gameIcons: Record<string, React.ReactNode> = {
  soulcalibur6: <Sword className="h-4 w-4 mr-1.5" />,
  tekken8: <Gamepad2 className="h-4 w-4 mr-1.5" />,
};

export const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedGame, characters, selectedCharacterId, setSelectedCharacterId } = useGame();
  const { setOpen } = useCommand();

  const isActive = (path: string) => location.pathname === path;

  const handleCharacterSelect = (value: string) => {
    if (!value) {
      // Handle case where selection is cleared (empty value)
      setSelectedCharacterId(null);
      navigate(`/${selectedGame.id}`);
      return;
    }

    // Parse the composite value "id|name"
    const [idString, name] = value.split('|');
    const selectedId = Number(idString);

    if (!isNaN(selectedId) && name) {
      setSelectedCharacterId(selectedId); // Set the ID in context
      // Navigate using the name directly from the parsed value
      navigate(`/${selectedGame.id}/${encodeURIComponent(name)}`);
    } else {
      // Failed to parse selection, no debug logging
      setSelectedCharacterId(null);
      navigate(`/${selectedGame.id}`);
    }
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center">
          <Link to="/games" className="mr-4 flex items-center">
            <img 
              src="/Horseface.png" 
              alt="Horseface Logo" 
              className="h-6 object-contain rounded-md"
            />
          </Link>
          
          <Breadcrumb className="items-center">
            <BreadcrumbList>
              {selectedGame && (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link 
                        to={`/${selectedGame.id}`}
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
                          <SelectContent style={{ backgroundColor: 'hsl(0, 0%, 20%)' }}>
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
        
        <div className="flex items-center justify-end space-x-4">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setOpen(true)}
            title="Command Menu (Ctrl+K)"
          >
            <Command className="h-[1.2rem] w-[1.2rem]" />
            <span className="sr-only">Open Command Menu</span>
          </Button>
        </div>
      </div>
    </nav>
  );
}; 