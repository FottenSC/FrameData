import * as React from "react"
import { useNavigate } from "react-router-dom"

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { Gamepad2, Users, ChevronLeft, Table } from "lucide-react"
import { useGame } from "@/contexts/GameContext"
import { useCommand } from "@/contexts/CommandContext"
import { useTableConfig } from "@/contexts/TableConfigContext"
import type { ColumnConfig } from "@/contexts/TableConfigContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { TableConfigurator } from "@/components/TableConfigurator"

export function CommandPalette() {
  const navigate = useNavigate()
  const { open, setOpen } = useCommand()
  const { 
    characters, 
    selectedGame, 
    setSelectedCharacterId,
    selectedCharacterId 
  } = useGame()
  
  const { } = useTableConfig()
  
  // State to track navigation between different views
  const [showCharacters, setShowCharacters] = React.useState(false)
  const [showTableConfig, setShowTableConfig] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  // TableConfigurator manages its own state

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(!open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [open, setOpen])

  // No initialization needed; configurator derives from context

  // Apply handled by TableConfigurator

  // Cancel handled by TableConfigurator

  React.useEffect(() => {
    // Reset to main menu when command palette is closed
    if (!open) {
      setShowCharacters(false)
      setShowTableConfig(false)
      setSearchValue("")
    }
  }, [open])

  const handleCharacterSelect = (characterId: number, characterName: string) => {
    setSelectedCharacterId(characterId)
    const nameForUrl = characterId === -1 ? 'All' : characterName
    navigate(`/${selectedGame.id}/${encodeURIComponent(nameForUrl)}`)
    setOpen(false)
  }

  // Visibility/reorder/defaults handled by TableConfigurator

  // No dnd handlers here

  const goBackToMain = () => {
    setShowCharacters(false)
    setShowTableConfig(false)
    setSearchValue("")
  }

  // No local sorted columns needed here

  // Removed inline sortable row; TableConfigurator provides its own UI

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 top-[30%] translate-y-[-30%] max-w-2xl">
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <DialogDescription className="sr-only">
          Navigate through the application using keyboard shortcuts and commands
        </DialogDescription>
        <Command 
          style={{ backgroundColor: 'hsl(0, 0%, 20%)' }}
          className="[&_[cmdk-group-heading]]:text-muted-foreground **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          <CommandInput 
            placeholder={
              showTableConfig 
                ? "Configure table columns..." 
                : showCharacters 
                  ? `Search ${characters.length} characters...` 
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
                  <CommandItem 
                    onSelect={goBackToMain}
                    className="mb-1"
                  >
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
                  <CommandItem 
                    onSelect={goBackToMain}
                    className="mb-1"
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    <span>Back to Commands</span>
                  </CommandItem>
                  <CommandItem
                    key={-1}
                    onSelect={() => handleCharacterSelect(-1, 'All')}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    <span>All Characters</span>
                  </CommandItem>
                  {characters.map((character) => (
                    <CommandItem
                      key={character.id}
                      onSelect={() => handleCharacterSelect(character.id, character.name)}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      <span>{character.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : (
              <>
                <CommandGroup heading="Commands">
                  <CommandItem onSelect={() => {
                    setShowCharacters(true)
                    setSearchValue("")
                  }}>
                    <Users className="mr-2 h-4 w-4" />
                    <span>Character</span>
                    <CommandShortcut>→</CommandShortcut>
                  </CommandItem>
                  <CommandItem onSelect={() => {
                    setShowTableConfig(true)
                    setSearchValue("")
                  }}>
                    <Table className="mr-2 h-4 w-4" />
                    <span>Table Config</span>
                    <CommandShortcut>→</CommandShortcut>
                  </CommandItem>
                  <CommandItem onSelect={() => { navigate("/games"); setOpen(false); }}>
                    <Gamepad2 className="mr-2 h-4 w-4" />
                    <span>Game Selection</span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
            
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
} 