import * as React from "react";
import { useNavigate } from "@tanstack/react-router";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Gamepad2,
  Users,
  ChevronLeft,
  Table,
  Info,
  Languages,
  Check,
} from "lucide-react";
import { useGame } from "@/contexts/GameContext";
import { useCommand } from "@/contexts/CommandContext";
import {
  useTableConfig,
  useUserSettings,
} from "@/contexts/UserSettingsContext";
import { sharedNotationMapping } from "@/lib/notationMapping";
import type { ColumnConfig } from "@/contexts/UserSettingsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { TableConfigurator } from "@/components/TableConfigurator";
import { avaliableGames } from "@/contexts/GameContext";
import { useQueryClient } from "@tanstack/react-query";
import { fetchCharacterMoves } from "@/hooks/useMoves";

export function CommandPalette() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { open, setOpen, currentView, setCurrentView, setCreditsOpen } = useCommand();
  const {
    characters,
    selectedGame,
    setSelectedCharacterId,
    selectedCharacterId,
    setSelectedGameById,
    applyNotation,
  } = useGame();

  const {} = useTableConfig();
  const { getEnabledNotationMappings, toggleGameNotationMapping } =
    useUserSettings();

  const [searchValue, setSearchValue] = React.useState("");

  const prefetchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const prefetchCharacter = (character: { id: number; name: string }) => {
    if (!selectedGame) return;
    
    if (prefetchTimeoutRef.current) {
      clearTimeout(prefetchTimeoutRef.current);
    }

    prefetchTimeoutRef.current = setTimeout(() => {
      queryClient.prefetchQuery({
        queryKey: ["moves", selectedGame.id, character.id],
        queryFn: () =>
          fetchCharacterMoves(
            selectedGame.id,
            character.id,
            character.name,
            applyNotation,
          ),
        staleTime: 1000 * 60 * 5, // 5 minutes
      });
    }, 150); // 150ms delay to avoid prefetching while scrolling/moving mouse quickly
  };

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (prefetchTimeoutRef.current) {
        clearTimeout(prefetchTimeoutRef.current);
      }
    };
  }, []);

  // Derived booleans for cleaner JSX
  const showCharacters = currentView === "characters";
  const showTableConfig = currentView === "tableConfig";
  const showGames = currentView === "games";
  const showNotationMappings = currentView === "notationMappings";

  // TableConfigurator manages its own state

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, setOpen]);

  const handleCharacterSelect = (
    characterId: number,
    characterName: string,
  ) => {
    setSelectedCharacterId(characterId);
    const nameForUrl = characterId === -1 ? "All" : characterName;
    navigate({ to: `/${selectedGame.id}/${encodeURIComponent(nameForUrl)}` });
    setOpen(false);
  };

  const goBackToMain = () => {
    setCurrentView("main");
    setSearchValue("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent style={{ backgroundColor: "var(--background)" }} className="overflow-hidden p-0 top-[30%] translate-y-[-30%] max-w-2xl border-border">
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <DialogDescription className="sr-only">
          Navigate through the application using keyboard shortcuts and commands
        </DialogDescription>
        <Command
          style={{ backgroundColor: "var(--background)" }}
          className="[&_[cmdk-group-heading]]:text-muted-foreground **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
        >
          <CommandInput
            placeholder={
              showTableConfig
                ? "Configure table columns..."
                : showCharacters
                  ? `Search ${characters.length} characters...`
                  : showGames
                    ? `Search ${avaliableGames.length} games...`
                    : showNotationMappings
                        ? "Toggle notation mappings..."
                        : "Type a command or search..."
            }
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList className={showTableConfig ? "max-h-[500px]" : ""}>
            <CommandEmpty>No results found.</CommandEmpty>
            {showTableConfig ? (
              <>
                <CommandGroup heading="Table Configuration">
                  <CommandItem onSelect={goBackToMain} className="mb-1">
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    <span>Back to Commands</span>
                  </CommandItem>
                  <div className="px-2 py-2">
                    <TableConfigurator />
                  </div>
                </CommandGroup>
              </>
            ) : showCharacters ? (
              <>
                <CommandGroup heading="Characters">
                  <CommandItem onSelect={goBackToMain} className="mb-1">
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    <span>Back to Commands</span>
                  </CommandItem>
                  <CommandItem
                    key={-1}
                    onSelect={() => handleCharacterSelect(-1, "All")}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    <span>All Characters</span>
                  </CommandItem>
                  {characters.map((character) => (
                    <CommandItem
                      key={character.id}
                      onSelect={() =>
                        handleCharacterSelect(character.id, character.name)
                      }
                      onMouseEnter={() => prefetchCharacter(character)}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      <span>{character.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : showGames ? (
              <>
                <CommandGroup heading="Games">
                  <CommandItem
                    onSelect={goBackToMain}
                    className="mb-1"
                    value="back-to-commands"
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    <span>Back to Commands</span>
                  </CommandItem>
                  {avaliableGames.map((game) => (
                    <CommandItem
                      key={game.id}
                      value={game.id}
                      keywords={[game.name]}
                      onSelect={() => {
                        setSelectedGameById(game.id);
                        setOpen(false);
                      }}
                      className={
                        game.id === selectedGame.id
                          ? "aria-selected:bg-accent"
                          : ""
                      }
                    >
                      {game.icon}
                      <span>{game.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : showNotationMappings ? (
              <>
                <CommandItem onSelect={goBackToMain} className="mb-1">
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  <span>Back to Commands</span>
                </CommandItem>
                {[
                  selectedGame,
                  ...avaliableGames.filter((g) => g.id !== selectedGame.id),
                ].map((game) => {
                  const enabledForGame = getEnabledNotationMappings(
                    game.id,
                    game.notationMapping.defaultEnabled,
                  );
                  return (
                    <CommandGroup
                      key={game.id}
                      heading={`${game.name} Notation Mappings`}
                    >
                      {Object.keys(sharedNotationMapping).map((key) => (
                        <CommandItem
                          key={`${game.id}-${key}`}
                          onSelect={() =>
                            toggleGameNotationMapping(
                              game.id,
                              key,
                              enabledForGame,
                            )
                          }
                        >
                          <div
                            className={cn(
                              "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                              enabledForGame.includes(key)
                                ? "bg-primary text-primary-foreground"
                                : "opacity-50 [&_svg]:invisible",
                            )}
                          >
                            <Check className={cn("h-4 w-4")} />
                          </div>
                          <span>{key}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  );
                })}
              </>
            ) : (
              <>
                <CommandGroup heading="Commands">
                  <CommandItem
                    onSelect={() => {
                      setCurrentView("games");
                      setSearchValue("");
                    }}
                  >
                    <Gamepad2 className="mr-2 h-4 w-4" />
                    <span>Game</span>
                    <CommandShortcut>→</CommandShortcut>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => {
                      setCurrentView("characters");
                      setSearchValue("");
                    }}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    <span>Character</span>
                    <CommandShortcut>→</CommandShortcut>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => {
                      setCurrentView("tableConfig");
                      setSearchValue("");
                    }}
                  >
                    <Table className="mr-2 h-4 w-4" />
                    <span>Table Config</span>
                    <CommandShortcut>→</CommandShortcut>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => {
                      setCreditsOpen(true);
                      setOpen(false);
                    }}
                  >
                    <Info className="mr-2 h-4 w-4" />
                    <span>Credits</span>
                    <CommandShortcut>→</CommandShortcut>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => {
                      setCurrentView("notationMappings");
                      setSearchValue("");
                    }}
                  >
                    <Languages className="mr-2 h-4 w-4" />
                    <span>Notation Mappings</span>
                    <CommandShortcut>→</CommandShortcut>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
