import * as React from "react";
import { ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
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

/**
 * Multi-select dropdown used by the filter builder's "In list" operator.
 *
 * The trigger doubles as a tag box: every selected option appears as a
 * small removable chip inside the trigger. Clicking the chip's × removes
 * just that one option without opening the dropdown; clicking anywhere
 * else opens the list.
 *
 * Sized to match the h-8 filter-row inputs around it. Grows horizontally
 * (and wraps vertically) when selections overflow the base width.
 */
export function MultiCombobox({
  value,
  onChange,
  options,
  placeholder = "Select…",
  emptyText = "No results found.",
  className,
  "aria-label": ariaLabel,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  options: ComboboxOption[];
  placeholder?: string;
  emptyText?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selectedSet = React.useMemo(() => new Set(value), [value]);

  const toggle = (val: string) => {
    const next = new Set(selectedSet);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    onChange(Array.from(next));
  };

  const remove = (val: string) => {
    const next = new Set(selectedSet);
    next.delete(val);
    onChange(Array.from(next));
  };

  // Preserve the order the user selected in — iterate `value`, not `options`.
  const labelFor = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const o of options) map.set(o.value, o.label);
    return (v: string) => map.get(v) ?? v;
  }, [options]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          className={cn(
            // Tag-box trigger: flex row of chips + caret, min-h matches the
            // sibling h-8 inputs but can grow when selections wrap.
            // min-w-[200px] matches the "Equals"-style DebouncedInput width
            // so the empty trigger lines up with the other value inputs in
            // the row; grows as chips are added; wraps rather than
            // overflowing.
            "group inline-flex min-h-8 min-w-[200px] max-w-full items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-sm",
            "ring-offset-background transition-colors",
            "hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span className="flex flex-1 flex-wrap items-center gap-1 text-left">
            {value.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              value.map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center gap-0.5 rounded bg-primary/15 pl-1.5 pr-0.5 py-0 text-[11px] font-medium text-foreground ring-1 ring-primary/30"
                >
                  <span className="leading-none">{labelFor(v)}</span>
                  {/*
                    Nested button for the remove action. onPointerDown is used
                    (rather than onClick) so we can stopPropagation before
                    Radix's PopoverTrigger fires — otherwise clicking × also
                    opens the popover.
                  */}
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Remove ${labelFor(v)}`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      remove(v);
                    }}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" ||
                        e.key === " " ||
                        e.key === "Backspace" ||
                        e.key === "Delete"
                      ) {
                        e.preventDefault();
                        e.stopPropagation();
                        remove(v);
                      }
                    }}
                    className="inline-flex h-4 w-4 items-center justify-center rounded-sm hover:bg-primary/25"
                  >
                    <X className="h-3 w-3" />
                  </span>
                </span>
              ))
            )}
          </span>
          <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 bg-secondary text-secondary-foreground border border-input w-[260px]"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search…" />
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
                    <span
                      className={cn(
                        "mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                        checked
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground/50",
                      )}
                      aria-hidden
                    >
                      {checked && (
                        <svg viewBox="0 0 12 12" className="h-3 w-3">
                          <path
                            d="M2 6l3 3 5-6"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
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
