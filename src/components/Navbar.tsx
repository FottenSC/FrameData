import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Gamepad2, Sword, Command, Download, Settings2, Languages, MoreVertical } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./ui/dropdown-menu";
import { cn } from "@/lib/utils";

const gameIcons: Record<string, React.ReactNode> = {
  soulcalibur6: <Sword className="h-4 w-4 mr-1.5" />,
  tekken8: <Gamepad2 className="h-4 w-4 mr-1.5" />,
};

export const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    selectedGame,
    characters,
    selectedCharacterId,
    setSelectedCharacterId,
  } = useGame();
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
      navigate(`/${selectedGame.id}`);
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
                        to="/games"
                        className="flex items-center hover:text-foreground/80 transition-colors"
                      >
                        {gameIcons[selectedGame.id] || (
                          <Gamepad2 className="h-4 w-4 mr-1.5 opacity-70" />
                        )}
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
                        />
                      </BreadcrumbItem>
                    </>
                  )}
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center justify-end space-x-2">
          {/* Frame data page toolbar items */}
          {isFrameDataPage && (
            <>
              {/* Active filters badge */}
              <Badge
                variant="outline"
                className={cn(
                  "text-xs font-normal hidden sm:inline-flex",
                  activeFiltersCount === 0 && "opacity-50"
                )}
              >
                {activeFiltersCount} {activeFiltersCount === 1 ? "filter" : "filters"}
              </Badge>

              {/* Move count badge */}
              <Badge
                variant="outline"
                className={cn(
                  "text-xs font-normal hidden sm:inline-flex",
                  isUpdating && "opacity-50"
                )}
              >
                {filteredMoves}{totalMoves !== filteredMoves && ` / ${totalMoves}`} moves
                {isUpdating && " ..."}
              </Badge>

              {/* Desktop view - visible on md and up */}
              <button
                onClick={() => openView("tableConfig")}
                className="hidden md:inline-flex items-center justify-center p-1.5 text-muted-foreground hover:text-foreground rounded-md border border-border bg-secondary/30 hover:bg-secondary/50 active:scale-95 active:bg-secondary/70 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                title="Table Configuration"
              >
                <Settings2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => openView("notationMappings")}
                className="hidden md:inline-flex items-center justify-center p-1.5 text-muted-foreground hover:text-foreground rounded-md border border-border bg-secondary/30 hover:bg-secondary/50 active:scale-95 active:bg-secondary/70 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                title="Notation Mappings"
              >
                <Languages className="h-4 w-4" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="hidden md:inline-flex items-center justify-center p-1.5 text-muted-foreground hover:text-foreground rounded-md border border-border bg-secondary/30 hover:bg-secondary/50 active:scale-95 active:bg-secondary/70 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                    title="Export"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="bg-card/95 backdrop-blur-sm border-border shadow-lg"
                >
                  <DropdownMenuItem onClick={() => exportHandler.current?.("csv")}>
                    Export to CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportHandler.current?.("excel")}>
                    Export to Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Mobile view - visible below md */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="md:hidden inline-flex items-center justify-center p-1.5 text-muted-foreground hover:text-foreground rounded-md border border-border bg-secondary/30 hover:bg-secondary/50 active:scale-95 active:bg-secondary/70 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                    title="Options"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="bg-card/95 backdrop-blur-sm border-border shadow-lg min-w-[180px]"
                >
                  <DropdownMenuItem disabled className="text-xs text-muted-foreground">
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
                  <DropdownMenuItem onClick={() => openView("notationMappings")}>
                    <Languages className="h-4 w-4 mr-2" />
                    Notation Mappings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportHandler.current?.("csv")}>
                    <Download className="h-4 w-4 mr-2" />
                    Export to CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportHandler.current?.("excel")}>
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
