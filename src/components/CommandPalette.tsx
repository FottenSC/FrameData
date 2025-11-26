import * as React from "react";
import { useNavigate } from "react-router-dom";

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
import { Gamepad2, Users, ChevronLeft, Table, Info, Languages, Check } from "lucide-react";
import { useGame } from "@/contexts/GameContext";
import { useCommand } from "@/contexts/CommandContext";
import { useTableConfig, useUserSettings } from "@/contexts/UserSettingsContext";
import { sharedNotationMapping } from "@/lib/notationMapping";
import type { ColumnConfig } from "@/contexts/UserSettingsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { TableConfigurator } from "@/components/TableConfigurator";
import { avaliableGames } from "@/contexts/GameContext";

// Local type for credits entries (per-game, optional file in public/Games/<GameId>/Credits.json)
type CreditEntry = { name: string; role?: string; link?: string };

export function CommandPalette() {
  const navigate = useNavigate();
  const { open, setOpen, currentView, setCurrentView } = useCommand();
  const {
    characters,
    selectedGame,
    setSelectedCharacterId,
    selectedCharacterId,
    setSelectedGameById,
  } = useGame();

  const { } = useTableConfig();
  const { getEnabledNotationMappings, toggleGameNotationMapping } = useUserSettings();

  const [searchValue, setSearchValue] = React.useState("");

  // Derived booleans for cleaner JSX
  const showCharacters = currentView === "characters";
  const showTableConfig = currentView === "tableConfig";
  const showGames = currentView === "games";
  const showCredits = currentView === "credits";
  const showNotationMappings = currentView === "notationMappings";

  // Credits state (lazy per game)
  const creditsCacheRef = React.useRef<Map<string, CreditEntry[] | null>>(
    new Map(),
  );
  const [creditsLoading, setCreditsLoading] = React.useState(false);
  const [creditsError, setCreditsError] = React.useState<string | null>(null);
  const [credits, setCredits] = React.useState<CreditEntry[] | null>(null);

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

  // Load credits lazily when the credits view is first opened for a game
  React.useEffect(() => {
    if (showCredits) {
      const gameId = selectedGame.id;
      if (creditsCacheRef.current.has(gameId)) {
        setCredits(creditsCacheRef.current.get(gameId) || null);
        setCreditsError(null);
        return;
      }
      let cancelled = false;
      setCreditsLoading(true);
      setCreditsError(null);
      fetch(`/Games/${encodeURIComponent(gameId)}/Credits.json`)
        .then(async (res) => {
          if (!res.ok) {
            if (res.status === 404) {
              return null; // No credits file provided
            }
            throw new Error(`Failed to load credits (${res.status})`);
          }
          const data = await res.json();
          if (!Array.isArray(data)) return null;
          return data.map(
            (e: any): CreditEntry => ({
              name: String(e.name ?? "Unknown"),
              role: e.role ? String(e.role) : undefined,
              link: e.link ? String(e.link) : undefined,
            }),
          );
        })
        .then((list) => {
          if (cancelled) return;
          creditsCacheRef.current.set(gameId, list);
          setCredits(list);
        })
        .catch((err) => {
          if (cancelled) return;
          setCreditsError(
            err instanceof Error
              ? err.message
              : "Unknown error loading credits",
          );
          creditsCacheRef.current.set(gameId, null);
          setCredits(null);
        })
        .finally(() => {
          if (!cancelled) setCreditsLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [showCredits, selectedGame.id]);

  // Reset search when closing
  React.useEffect(() => {
    if (!open) {
      setSearchValue("");
    }
  }, [open]);

  const handleCharacterSelect = (
    characterId: number,
    characterName: string,
  ) => {
    setSelectedCharacterId(characterId);
    const nameForUrl = characterId === -1 ? "All" : characterName;
    navigate(`/${selectedGame.id}/${encodeURIComponent(nameForUrl)}`);
    setOpen(false);
  };

  const goBackToMain = () => {
    setCurrentView("main");
    setSearchValue("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 top-[30%] translate-y-[-30%] max-w-2xl">
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <DialogDescription className="sr-only">
          Navigate through the application using keyboard shortcuts and commands
        </DialogDescription>
        <Command
          style={{ backgroundColor: "hsl(0, 0%, 20%)" }}
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
                    : showCredits
                      ? "View credits..."
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
                  <CommandItem onSelect={goBackToMain} className="mb-1" value="back-to-commands">
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
            ) : showCredits ? (
              <>
                <CommandGroup heading="Credits">
                  <CommandItem onSelect={goBackToMain} className="mb-1">
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    <span>Back to Commands</span>
                  </CommandItem>
                  <div className="px-2 py-2 space-y-2 text-sm max-h-[400px] overflow-auto">
                    {creditsLoading && (
                      <div className="text-muted-foreground">
                        Loading credits...
                      </div>
                    )}
                    {creditsError && (
                      <div className="text-destructive">{creditsError}</div>
                    )}
                    {!creditsLoading && !creditsError && credits === null && (
                      <div className="text-muted-foreground">
                        No credits available for this game.
                      </div>
                    )}
                    {!creditsLoading &&
                      !creditsError &&
                      credits &&
                      credits.length === 0 && (
                        <div className="text-muted-foreground">
                          Credits file is empty.
                        </div>
                      )}
                    {credits &&
                      credits.map((c, i) => (
                        <div
                          key={i}
                          className="flex flex-col rounded border border-border/50 p-2 bg-background/40"
                        >
                          <span className="font-medium">
                            {c.link ? (
                              <a
                                href={c.link}
                                target="_blank"
                                rel="noreferrer"
                                className="underline hover:no-underline"
                              >
                                {c.name}
                              </a>
                            ) : (
                              c.name
                            )}
                          </span>
                          {c.role && (
                            <span className="text-xs text-muted-foreground">
                              {c.role}
                            </span>
                          )}
                        </div>
                      ))}
                  </div>
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
                    game.notationMapping.defaultEnabled
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
                            toggleGameNotationMapping(game.id, key, enabledForGame)
                          }
                        >
                          <div
                            className={cn(
                              "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                              enabledForGame.includes(key)
                                ? "bg-primary text-primary-foreground"
                                : "opacity-50 [&_svg]:invisible"
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
                      setCurrentView("credits");
                      setSearchValue("");
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
