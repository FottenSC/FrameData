import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Gamepad2, Sword, Command } from 'lucide-react';
import { useGame } from '../contexts/GameContext';
import { useCommand } from '../contexts/CommandContext';
import { Combobox, ComboboxOption } from './ui/combobox';
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

  const handleCharacterSelect = (value: string | null) => {
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
      // No-op if choosing the currently active character and URL segment already matches
      if (
        selectedCharacterId === selectedId &&
        decodeURIComponent(location.pathname.split('/')[2] || '').toLowerCase() === name.toLowerCase()
      ) {
        return;
      }
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
                        <Combobox
                          value={
                            selectedCharacterId === -1
                              ? `-1|All`
                              : (selectedCharacterId ? `${selectedCharacterId}|${characters.find(c => c.id === selectedCharacterId)?.name || ''}` : null)
                          }
                          onChange={handleCharacterSelect}
                          options={[
                            { label: 'All Characters', value: '-1|All' },
                            ...characters.map((c) => ({ label: c.name, value: `${c.id}|${c.name}` })) as ComboboxOption[],
                          ]}
                          placeholder="Select Character"
                          className="w-[200px] font-medium"
                          buttonVariant="ghost"
                          buttonClassName="border-0 shadow-none hover:bg-muted/40 focus:ring-0 focus-visible:ring-0 focus:outline-none"
                        />
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