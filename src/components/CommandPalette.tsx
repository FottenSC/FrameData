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
import {
  Gamepad2,
  Users,
  ChevronLeft,
  Table,
  Eye,
  EyeOff,
  GripVertical,
  RotateCcw,
  Check,
  X
} from "lucide-react"
import { useGame } from "@/contexts/GameContext"
import { useCommand } from "@/contexts/CommandContext"
import { useTableConfig } from "@/contexts/TableConfigContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function CommandPalette() {
  const navigate = useNavigate()
  const { open, setOpen } = useCommand()
  const { 
    characters, 
    selectedGame, 
    setSelectedCharacterId,
    selectedCharacterId 
  } = useGame()
  
  const {
    getSortedColumns,
    updateColumnVisibility,
    reorderColumns,
    restoreDefaults,
    setColumnConfigs
  } = useTableConfig()
  
  // State to track navigation between different views
  const [showCharacters, setShowCharacters] = React.useState(false)
  const [showTableConfig, setShowTableConfig] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  // Temporary state for table configuration (to avoid live updates)
  const [tempColumnConfigs, setTempColumnConfigs] = React.useState<any[]>([])
  const [configChanged, setConfigChanged] = React.useState(false)
  
  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null)

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

  // Initialize temp config when opening table config
  React.useEffect(() => {
    if (showTableConfig) {
      const columns = getSortedColumns().map(col => ({ ...col }))
      setTempColumnConfigs(columns)
      setConfigChanged(false)
    }
  }, [showTableConfig, getSortedColumns])

  const applyChanges = React.useCallback(() => {
    // Apply all the temporary changes at once
    setColumnConfigs(tempColumnConfigs.map(col => ({ ...col })))
    setConfigChanged(false)
  }, [tempColumnConfigs, setColumnConfigs])

  const cancelChanges = React.useCallback(() => {
    const columns = getSortedColumns().map(col => ({ ...col }))
    setTempColumnConfigs(columns)
    setDraggedIndex(null) // Reset drag state
    setDragOverIndex(null)
    setConfigChanged(false)
  }, [getSortedColumns])

  React.useEffect(() => {
    // Reset to main menu when command palette is closed
    if (!open) {
      setShowCharacters(false)
      setShowTableConfig(false)
      setSearchValue("")
      setDraggedIndex(null) // Reset drag state
      setDragOverIndex(null)
      // Apply any pending changes when closing
      if (configChanged) {
        applyChanges()
      }
    }
  }, [open, configChanged, applyChanges])

  const handleCharacterSelect = (characterId: number, characterName: string) => {
    setSelectedCharacterId(characterId)
    const nameForUrl = characterId === -1 ? 'All' : characterName
    navigate(`/${selectedGame.id}/${encodeURIComponent(nameForUrl)}`)
    setOpen(false)
  }

  const handleColumnVisibilityToggle = (columnId: string) => {
    setTempColumnConfigs(prev => 
      prev.map(col => 
        col.id === columnId ? { ...col, visible: !col.visible } : col
      )
    )
    setConfigChanged(true)
  }

  const handleColumnReorder = (fromIndex: number, toIndex: number) => {
    setTempColumnConfigs(prev => {
      const newConfigs = [...prev]
      const [movedColumn] = newConfigs.splice(fromIndex, 1)
      newConfigs.splice(toIndex, 0, movedColumn)
      
      // Update order values
      return newConfigs.map((col, index) => ({ ...col, order: index }))
    })
    setConfigChanged(true)
  }

  const handleRestoreDefaults = () => {
    restoreDefaults()
    const columns = getSortedColumns().map(col => ({ ...col }))
    setTempColumnConfigs(columns)
    setConfigChanged(false)
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      handleColumnReorder(draggedIndex, dropIndex)
    }
    
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const goBackToMain = () => {
    // Apply changes when going back
    if (configChanged) {
      applyChanges()
    }
    setShowCharacters(false)
    setShowTableConfig(false)
    setSearchValue("")
  }

  // Get sorted columns for display (use temp config when in table config mode)
  const sortedColumns = showTableConfig ? tempColumnConfigs : getSortedColumns()

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
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-medium">Column Settings</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRestoreDefaults}
                        className="h-7 text-xs"
                      >
                        <RotateCcw className="mr-1 h-3 w-3" />
                        Restore Defaults
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      {sortedColumns.map((column, index) => (
                        <div 
                          key={column.id}
                          className={cn(
                            "flex items-center space-x-3 p-2 rounded border border-border bg-background/50 transition-colors",
                            draggedIndex === index && "opacity-50",
                            dragOverIndex === index && "border-primary bg-primary/10"
                          )}
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, index)}
                          onDragEnd={handleDragEnd}
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                          
                          <input
                            type="checkbox"
                            checked={column.visible}
                            onChange={(e) => handleColumnVisibilityToggle(column.id)}
                            className="h-4 w-4 rounded border border-primary accent-primary focus:ring-2 focus:ring-primary"
                          />
                          
                          <div className="flex-1 flex items-center justify-between">
                            <span className={cn(
                              "text-sm font-medium",
                              !column.visible && "text-muted-foreground line-through"
                            )}>
                              {column.label}
                            </span>
                          </div>
                          
                          {column.visible ? (
                            <Eye className="h-4 w-4 text-green-500" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-4 flex justify-between items-center space-x-2">
                      <div className="flex space-x-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            applyChanges()
                            setShowTableConfig(false)
                            setSearchValue("")
                          }}
                          disabled={!configChanged}
                          className="h-7 text-xs"
                        >
                          <Check className="mr-1 h-3 w-3" />
                          Apply
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={cancelChanges}
                          disabled={!configChanged}
                          className="h-7 text-xs"
                        >
                          <X className="mr-1 h-3 w-3" />
                          Cancel
                        </Button>
                      </div>
                      {configChanged && (
                        <span className="text-xs text-orange-500 font-medium">
                          Changes pending...
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-3 p-2 rounded bg-muted/50 text-xs text-muted-foreground">
                      <p>• Use the checkbox to show/hide columns</p>
                      <p>• Drag the grip handle to reorder columns</p>
                      <p>• Click Apply to save changes or Cancel to discard</p>
                      <p>• Changes auto-apply when closing this dialog</p>
                    </div>
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