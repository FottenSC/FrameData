import * as React from "react"
import { ChevronsUpDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export type ComboboxOption = { label: string; value: string }

export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Select...",
  emptyText = "No results found.",
  className,
  buttonVariant = "outline",
  buttonClassName,
}: {
  value: string | null
  onChange: (value: string | null) => void
  options: ComboboxOption[]
  placeholder?: string
  emptyText?: string
  className?: string
  buttonVariant?: string
  buttonClassName?: string
}) {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  const selected = options.find((o) => o.value === value) || null

  const onSelect = (val: string) => {
    if (selected && selected.value === val) {
      setOpen(false)
      // Defer blur so popover state finishes closing
      requestAnimationFrame(() => triggerRef.current?.blur())
      return
    }
    onChange(val)
    setOpen(false)
    requestAnimationFrame(() => triggerRef.current?.blur())
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant={buttonVariant as any}
          role="combobox"
          aria-expanded={open}
          className={cn("h-10 px-3 text-sm justify-between w-[200px]", className, buttonClassName)}
        >
          <span className="truncate">
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => onSelect(opt.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === opt.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
