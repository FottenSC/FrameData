import React from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Gamepad2,
  Sword,
  Command,
  Download,
  Settings2,
  Languages,
  MoreVertical,
} from "lucide-react";
import { useGame } from "../contexts/GameContext";
import { useCommand } from "../contexts/CommandContext";
import { useToolbar } from "../contexts/ToolbarContext";
import { Combobox, ComboboxOption } from "./ui/combobox";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import { useUserSettings } from "../contexts/UserSettingsContext";
import { cn } from "@/lib/utils";

const gameIcons: Record<string, React.ReactNode> = {
  SoulCalibur6: <Sword className="h-4 w-4 mr-1.5" />,
  Tekken8: <Gamepad2 className="h-4 w-4 mr-1.5" />,
};

export const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    selectedGame,
    characters,
    isCharactersLoading,
    selectedCharacterId,
    setSelectedCharacterId,
    notationStyle,
    notationStylesForGame,
  } = useGame();
  const { setNotationStyle } = useUserSettings();
  const { setOpen, openView } = useCommand();
  const {
    activeFiltersCount,
    exportHandler,
    totalMoves,
    filteredMoves,
    isUpdating,
  } = useToolbar();

  // Check if we're on a frame data page (has character selected)
  const isFrameDataPage = selectedCharacterId !== null;

  const isActive = (path: string) => location.pathname === path;

  const handleCharacterSelect = (value: string | null) => {
    if (!value) {
      // Handle case where selection is cleared (empty value)
      setSelectedCharacterId(null);
      navigate({ to: `/${selectedGame.id}` });
      return;
    }

    // Parse the composite value "id|name"
    const [idString, name] = value.split("|");
    const selectedId = Number(idString);

    if (!isNaN(selectedId) && name) {
      // No-op if choosing the currently active character and URL segment already matches
      if (
        selectedCharacterId === selectedId &&
        decodeURIComponent(
          location.pathname.split("/")[2] || "",
        ).toLowerCase() === name.toLowerCase()
      ) {
        return;
      }
      setSelectedCharacterId(selectedId); // Set the ID in context
      // Navigate using the name directly from the parsed value
      navigate({ to: `/${selectedGame.id}/${encodeURIComponent(name)}` });
    } else {
      // Failed to parse selection, no debug logging
      setSelectedCharacterId(null);
      navigate({ to: `/${selectedGame.id}` });
    }
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center">
          <Link to="/" className="mr-4 flex items-center">
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
                        to="/"
                        // Adds an underline on hover in addition to the
                        // colour shift so the link reads as clickable
                        // even when the user isn't focused on the
                        // colour change.
                        className="flex items-center hover:text-foreground/80 hover:underline underline-offset-4 transition-colors"
                      >
                        {gameIcons[selectedGame.id] || (
                          <Gamepad2 className="h-4 w-4 mr-1.5 opacity-70" />
                        )}
                        <span className="font-medium">{selectedGame.name}</span>
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  {/*
                    Character selector. We want the slot to always be
                    visible once we've got a game — so on a cold load
                    (characters list still empty) we render a
                    skeleton-shaped placeholder the same width as the
                    real combobox. That avoids the navbar "jumping"
                    when characters pop in, and makes the loading state
                    self-explanatory.
                  */}
                  {isCharactersLoading && characters.length === 0 ? (
                    <>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <Skeleton
                          className="h-7 w-[200px] rounded-md"
                          aria-label="Loading characters"
                        />
                      </BreadcrumbItem>
                    </>
                  ) : (
                    characters.length > 0 && (
                      <>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          <Combobox
                            value={
                              selectedCharacterId === -1
                                ? `-1|All`
                                : selectedCharacterId
                                  ? `${selectedCharacterId}|${characters.find((c) => c.id === selectedCharacterId)?.name || ""}`
                                  : null
                            }
                            onChange={handleCharacterSelect}
                            options={[
                              {
                                label: "All Characters",
                                value: "-1|All",
                              },
                              ...(characters.map((c) => ({
                                label: c.name,
                                value: `${c.id}|${c.name}`,
                              })) as ComboboxOption[]),
                            ]}
                            placeholder="Select Character"
                            className="w-[200px] font-medium"
                            buttonVariant="ghost"
                            buttonClassName="border-0 shadow-none hover:bg-muted/40 focus:ring-0 focus-visible:ring-0 focus:outline-none"
                            aria-label="Select character"
                          />
                        </BreadcrumbItem>
                      </>
                    )
                  )}
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center justify-end gap-1.5">
          {/* Frame data page toolbar items */}
          {isFrameDataPage && (
            <>
              {/*
                Toolbar items all sit on a uniform 32 px (h-8) row so
                badges, icon buttons, and the notation pill present as
                one band rather than three different heights. Local
                padding/icon sizing is balanced inside that constraint.
              */}

              {/* Active filters badge */}
              <Badge
                variant="outline"
                className={cn(
                  "h-8 px-2.5 text-xs font-normal hidden sm:inline-flex items-center",
                  activeFiltersCount === 0 && "opacity-50",
                )}
              >
                {activeFiltersCount}{" "}
                {activeFiltersCount === 1 ? "filter" : "filters"}
              </Badge>

              {/*
                Move count badge. On a cold load the toolbar context
                starts with `totalMoves === 0`, which would read as
                "0 moves" until data arrives — a misleading readout
                that users can mistake for an actual empty result. In
                that state we render a skeleton pill at the same size
                instead, and only fall back to the badge once we have
                real numbers or a non-empty stale value to show.
              */}
              {isUpdating && totalMoves === 0 ? (
                <Skeleton
                  className="h-8 w-20 rounded-md hidden sm:inline-flex"
                  aria-label="Loading moves"
                />
              ) : (
                <Badge
                  variant="outline"
                  className={cn(
                    "h-8 px-2.5 text-xs font-normal hidden sm:inline-flex items-center",
                    isUpdating && "opacity-50",
                  )}
                >
                  {filteredMoves}
                  {totalMoves !== filteredMoves && ` / ${totalMoves}`} moves
                  {isUpdating && " ..."}
                </Badge>
              )}

              {/* Desktop view - visible on md and up */}
              <button
                onClick={() => openView("tableConfig")}
                className="hidden md:inline-flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground rounded-md border border-border bg-secondary/30 hover:bg-secondary/50 active:scale-95 active:bg-secondary/70 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                title="Table Configuration"
              >
                <Settings2 className="h-4 w-4" />
              </button>
              {/*
                Notation style switcher — a compact button showing the active
                style's short label (e.g. "ABKG"). Click to radio-select
                another style for the current game.
              */}
              {notationStylesForGame.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="hidden md:inline-flex h-8 px-2.5 items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded-md border border-border bg-secondary/30 hover:bg-secondary/50 active:scale-95 active:bg-secondary/70 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                      title={`Notation: ${notationStyle.name}`}
                      aria-label={`Notation style: ${notationStyle.name}. Click to change.`}
                    >
                      <Languages className="h-3.5 w-3.5" />
                      <span className="tabular-nums">
                        {notationStyle.short}
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="bg-card/95 backdrop-blur-sm border-border shadow-lg min-w-[240px]"
                  >
                    <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                      Notation — {selectedGame.name}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup
                      value={notationStyle.id}
                      onValueChange={(v) =>
                        setNotationStyle(selectedGame.id, v)
                      }
                    >
                      {notationStylesForGame.map((style) => (
                        <DropdownMenuRadioItem
                          key={style.id}
                          value={style.id}
                          className="flex flex-col items-start gap-0 py-1.5"
                        >
                          <span className="text-sm">{style.name}</span>
                          {style.description && (
                            <span className="text-[11px] text-muted-foreground">
                              {style.description}
                            </span>
                          )}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="hidden md:inline-flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground rounded-md border border-border bg-secondary/30 hover:bg-secondary/50 active:scale-95 active:bg-secondary/70 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                    title="Export"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="bg-card/95 backdrop-blur-sm border-border shadow-lg"
                >
                  <DropdownMenuItem
                    onClick={() => exportHandler.current?.("csv")}
                  >
                    Export to CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => exportHandler.current?.("excel")}
                  >
                    Export to Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Mobile view - visible below md */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="md:hidden inline-flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground rounded-md border border-border bg-secondary/30 hover:bg-secondary/50 active:scale-95 active:bg-secondary/70 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                    title="Options"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="bg-card/95 backdrop-blur-sm border-border shadow-lg min-w-[180px]"
                >
                  <DropdownMenuItem
                    disabled
                    className="text-xs text-muted-foreground"
                  >
                    Total Moves: {filteredMoves}{" "}
                    {totalMoves !== filteredMoves
                      ? `(filtered from ${totalMoves})`
                      : ""}
                    {isUpdating && " (updating...)"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openView("tableConfig")}>
                    <Settings2 className="h-4 w-4 mr-2" />
                    Table Configuration
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => openView("notationMappings")}
                  >
                    <Languages className="h-4 w-4 mr-2" />
                    Notation Mappings
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => exportHandler.current?.("csv")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export to CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => exportHandler.current?.("excel")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export to Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          <Button
            variant="outline"
            size="icon"
            // Override the default Button `size="icon"` (h-10 w-10) so
            // the command-menu trigger matches the 32 px / h-8 toolbar
            // band the other right-hand items live in. Without the
            // override it would tower over the badges and icon
            // buttons next to it.
            className="h-8 w-8"
            onClick={() => setOpen(true)}
            title="Command Menu (Ctrl+K)"
          >
            <Command className="h-4 w-4" />
            <span className="sr-only">Open Command Menu</span>
          </Button>
        </div>
      </div>
    </nav>
  );
};
