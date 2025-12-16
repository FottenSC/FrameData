import * as React from "react";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type ComboboxOption = { label: string; value: string };

export function MultiCombobox({
  value,
  onChange,
  options,
  placeholder = "Select...",
  emptyText = "No results found.",
  className,
  maxPreview = 3,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  options: ComboboxOption[];
  placeholder?: string;
  emptyText?: string;
  className?: string;
  maxPreview?: number;
}) {
  const [open, setOpen] = React.useState(false);
  const selectedSet = new Set(value);

  const toggle = (val: string) => {
    const next = new Set(selectedSet);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    onChange(Array.from(next));
  };

  const selectedLabels = (() => {
    const labels = options
      .filter((o) => selectedSet.has(o.value))
      .map((o) => o.label);
    if (labels.length === 0) return placeholder;
    if (labels.length <= maxPreview) return labels.join(", ");
    const shown = labels.slice(0, maxPreview).join(", ");
    return `${shown} +${labels.length - maxPreview}`;
  })();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-10 px-3 text-sm justify-between w-[180px] custom-select-trigger bg-secondary border border-input rounded-md",
            className,
          )}
        >
          <span className="truncate">{selectedLabels}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 bg-secondary text-secondary-foreground border border-input">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const checked = selectedSet.has(opt.value);
                return (
                  <CommandItem
                    key={opt.value}
                    value={opt.label}
                    onSelect={() => toggle(opt.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        checked ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {opt.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
