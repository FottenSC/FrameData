import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  MultiCombobox,
  type ComboboxOption,
} from "@/components/ui/multi-combobox";
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
  const comboboxOptions = React.useMemo<ComboboxOption[]>(
    () =>
      options.map((opt) => ({
        value: opt.value,
        label: opt.label ?? opt.value.replace(/:/g, "").toUpperCase(),
      })),
    [options],
  );

  return (
    <MultiCombobox
      value={value}
      onChange={onChange}
      options={comboboxOptions}
      placeholder={placeholder}
      emptyText="No results."
      className={cn(
        "h-10 min-h-10 min-w-0 w-[180px] justify-between bg-secondary custom-select-trigger",
        className,
      )}
      contentClassName="bg-secondary text-secondary-foreground border border-input"
      searchPlaceholder="Search..."
      aria-label={ariaLabel}
      getOptionSearchValue={(opt) => opt.value.replace(/:/g, "").toUpperCase()}
      renderTriggerValue={({ selectedValues, placeholder }) =>
        selectedValues.length > 0 ? (
          <ExpandableHitLevels
            hitLevelString={selectedValues}
            maxIconsToShow={maxPreview}
          />
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )
      }
      renderOption={(opt, checked) => {
        const token = opt.value.replace(/:/g, "").toUpperCase();
        return (
          <>
            <Check
              className={cn("h-4 w-4", checked ? "opacity-100" : "opacity-0")}
            />
            <HitLevelIcon level={token} />
            <span className="text-xs font-medium">{opt.label || token}</span>
          </>
        );
      }}
    />
  );
};
