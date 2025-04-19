import * as React from "react"
import { useNavigate } from "react-router-dom"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import {
  Gamepad2,
  Users,
  ChevronLeft
} from "lucide-react"
import { useGame } from "@/contexts/GameContext"
import { useCommand } from "@/contexts/CommandContext"

export function CommandPalette() {
  const navigate = useNavigate()
  const { open, setOpen } = useCommand()
  const { 
    characters, 
    selectedGame, 
    setSelectedCharacterId,
    selectedCharacterId 
  } = useGame()
  
  // State to track if we're in character selection mode
  const [showCharacters, setShowCharacters] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

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

  React.useEffect(() => {
    // Reset to main menu when command palette is closed
    if (!open) {
      setShowCharacters(false)
      setSearchValue("")
    }
  }, [open])

  const handleCharacterSelect = (characterId: number, characterName: string) => {
    setSelectedCharacterId(characterId)
    navigate(`/${selectedGame.id}/${characterName}`)
    setOpen(false)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput 
        placeholder={showCharacters 
          ? `Search ${characters.length} characters...` 
          : "Type a command or search..."
        } 
        value={searchValue}
        onValueChange={setSearchValue}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        {showCharacters ? (
          <>
            <CommandGroup heading="Characters">
              <CommandItem 
                onSelect={() => setShowCharacters(false)}
                className="mb-1"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                <span>Back to Commands</span>
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
              <CommandItem onSelect={() => { navigate("/games"); setOpen(false); }}>
                <Gamepad2 className="mr-2 h-4 w-4" />
                <span>Game Selection</span>
              </CommandItem>
              <CommandItem onSelect={() => { navigate(`/${selectedGame.id}`); setOpen(false); }}>
                <Users className="mr-2 h-4 w-4" />
                <span>Character Selection</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
        
      </CommandList>
    </CommandDialog>
  )
} 