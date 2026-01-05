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
import { ExpandableHitLevels } from "@/components/icons/ExpandableHitLevels";
import { HitLevelIcon } from "@/components/icons/HitLevelIcon";

export interface HitLevelOption {
  value: string;
  label?: string;
}

interface HitLevelMultiComboboxProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: HitLevelOption[];
  placeholder?: string;
  className?: string;
  maxPreview?: number;
  "aria-label"?: string;
}

export const HitLevelMultiCombobox: React.FC<HitLevelMultiComboboxProps> = ({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className,
  maxPreview = 5,
  "aria-label": ariaLabel,
}) => {
  const [open, setOpen] = React.useState(false);
  const selected = new Set(value);

  const toggle = (val: string) => {
    const next = new Set(selected);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    onChange(Array.from(next));
  };

  const combinedArray = (() => {
    if (selected.size === 0) return null;
    return options
      .filter((o) => selected.has(o.value))
      .map((o) => o.value);
  })();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          className={cn(
            "h-10 px-3 text-sm justify-between w-[180px] custom-select-trigger bg-secondary border border-input rounded-md",
            className,
          )}
        >
          <span className="truncate flex items-center gap-1">
            {combinedArray ? (
              <ExpandableHitLevels
                hitLevelString={combinedArray}
                maxIconsToShow={maxPreview}
              />
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 bg-secondary text-secondary-foreground border border-input">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const checked = selected.has(opt.value);
                const token = opt.value.replace(/:/g, "").toUpperCase();
                return (
                  <CommandItem
                    key={opt.value}
                    value={token}
                    onSelect={() => toggle(opt.value)}
                    className="flex items-center gap-2"
                  >
                    <Check
                      className={cn(
                        "h-4 w-4",
                        checked ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <HitLevelIcon level={token} />
                    <span className="text-xs font-medium">{opt.label || token}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
