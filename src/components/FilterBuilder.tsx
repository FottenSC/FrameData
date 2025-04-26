import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

// Define base filter fields without min/max values
export const filterFields = [
  { value: 'Impact', label: 'Impact', type: 'number' },
  { value: 'Damage', label: 'Damage', type: 'number' },
  { value: 'Block', label: 'Block', type: 'number' },
  { value: 'Hit', label: 'Hit', type: 'number' },
  { value: 'CounterHit', label: 'Counter Hit', type: 'number' },
  { value: 'GuardBurst', label: 'Guard Burst', type: 'number' },
  { value: 'HitLevel', label: 'Hit Level', type: 'text' },
  { value: 'Command', label: 'Command', type: 'text' },
  { value: 'Stance', label: 'Stance', type: 'text' },
];

// Define condition options
export const conditionOptions = [
  { value: 'equals', label: 'Equals', appliesTo: ['text', 'number'] },
  { value: 'notEquals', label: 'Not Equals', appliesTo: ['text', 'number'] },
  { value: 'greaterThan', label: 'Greater Than', appliesTo: ['number'] },
  { value: 'lessThan', label: 'Less Than', appliesTo: ['number'] },
  { value: 'between', label: 'Between', appliesTo: ['number'] },
  { value: 'notBetween', label: 'Not Between', appliesTo: ['number'] },
  { value: 'contains', label: 'Contains', appliesTo: ['text'] },
  { value: 'startsWith', label: 'Starts With', appliesTo: ['text'] },
];

// Define the filter condition type
export interface FilterCondition {
  id: string;
  field: string;
  condition: string;
  value: string;
  value2?: string; // For range conditions
}

// Create a separate badge component for active filters
export const ActiveFiltersBadge: React.FC<{ count: number; className?: string }> = ({ 
  count, 
  className 
}) => {
  return (
    <Badge 
      variant="outline" 
      className={cn("ml-2 text-xs font-normal", className)}
    >
      {count} {count === 1 ? 'filter' : 'filters'}
    </Badge>
  );
};

// Interface for Move data to match FrameDataTable
interface Move {
  ID: number;
  Command: string;
  Stance: string | null;
  HitLevel: string | null;
  Impact: number;
  Damage: string | null;
  DamageDec: number | null;
  Block: number | null;
  HitString: string | null;
  Hit: number | null;
  CounterHitString: string | null;
  CounterHit: number | null;
  GuardBurst: number | null;
  Notes: string | null;
}

interface FilterBuilderProps {
  onFiltersChange: (filters: FilterCondition[]) => void;
  className?: string;
  moves?: Move[];
}

// Use React.memo to prevent re-renders if props haven't changed
export const FilterBuilder = React.memo<FilterBuilderProps>(({ 
  onFiltersChange,
  className,
  moves = [] 
}) => {
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const defaultFilterAdded = useRef(false);
  const [fieldRanges, setFieldRanges] = useState<Record<string, { min: number, max: number }>>({});
  const previousActiveFiltersRef = useRef<string | null>(null); // Ref to store last sent filters

  // Calculate field range values based on actual move data
  useEffect(() => {
    if (moves.length > 0) {
      const ranges: Record<string, { min: number, max: number }> = {};
      
      // Initialize with default fallback ranges
      const defaultRanges: Record<string, { min: number, max: number }> = {
        'Impact': { min: 0, max: 50 },
        'Damage': { min: 0, max: 100 },
        'Block': { min: -30, max: 30 },
        'Hit': { min: -30, max: 30 },
        'CounterHit': { min: -30, max: 30 },
        'GuardBurst': { min: 0, max: 100 }
      };
      
      // Start with default ranges
      Object.assign(ranges, defaultRanges);
      
      // Helper function to get field value from a move
      const getFieldValue = (move: Move, field: string): number | null => {
        switch (field) {
          case 'Impact': return move.Impact;
          case 'Damage': return move.DamageDec;
          case 'Block': return move.Block;
          case 'Hit': return move.Hit;
          case 'CounterHit': return move.CounterHit;
          case 'GuardBurst': return move.GuardBurst;
          default: return null;
        }
      };
      
      // Iterate through numeric fields to find min/max values
      filterFields.forEach(field => {
        if (field.type === 'number') {
          let min = Number.MAX_SAFE_INTEGER;
          let max = Number.MIN_SAFE_INTEGER;
          let hasValidValues = false;
          
          // Check each move for this field
          moves.forEach(move => {
            const value = getFieldValue(move, field.value);
            if (value !== null && value !== undefined && !isNaN(value)) {
              min = Math.min(min, value);
              max = Math.max(max, value);
              hasValidValues = true;
            }
          });
          
          // Only update if we found valid values
          if (hasValidValues) {
            // Add some padding to the ranges
            const padding = Math.max(1, Math.round((max - min) * 0.1)); // 10% padding
            ranges[field.value] = {
              min: Math.floor(min - padding),
              max: Math.ceil(max + padding)
            };
          }
        }
      });
      
      setFieldRanges(ranges);
    }
  }, [moves]);

  // --- Helper functions (memoized if necessary, but these are simple lookups) ---
  const getFieldType = useCallback((fieldName: string): string => {
    const field = filterFields.find(f => f.value === fieldName);
    return field ? field.type : 'text';
  }, []); // No dependencies needed if filterFields is constant

  const isRangeCondition = useCallback((condition: string): boolean => {
    return condition === 'between' || condition === 'notBetween';
  }, []);

  const getAvailableConditions = (fieldName: string) => {
    const fieldType = getFieldType(fieldName);
    return conditionOptions.filter(condition => 
      condition.appliesTo.includes(fieldType)
    );
  };
  // --- End Helper functions ---

  // Memoize the active filter calculation based on the filters state
  const currentActiveFilters = useMemo(() => {
    return filters.filter(filter => {
      const isRange = filter.condition === 'between' || filter.condition === 'notBetween';
      if (isRange) {
        return filter.value.trim() !== '' && filter.value2 != null && filter.value2.trim() !== '';
      }
      return filter.value.trim() !== '';
    });
  }, [filters]);

  // Notify parent ONLY when the active filters have meaningfully changed
  useEffect(() => {
    const currentActiveFiltersString = JSON.stringify(currentActiveFilters);

    // Only call onChange if the stringified filters are different from the last ones sent
    if (currentActiveFiltersString !== previousActiveFiltersRef.current) {
      onFiltersChange(currentActiveFilters);
      // Update the ref to store the filters we just sent
      previousActiveFiltersRef.current = currentActiveFiltersString;
    }
    // Dependency on onFiltersChange is still technically needed because it's a prop,
    // but the internal check prevents the infinite loop even if parent doesn't memoize.
    // However, parent memoization is still strongly recommended for performance.
  }, [currentActiveFilters, onFiltersChange]); // Depend on the memoized value & the prop

  // Create a default filter exactly once if none exists
  useEffect(() => {
    if (filters.length === 0 && !defaultFilterAdded.current) {
      addFilter();
      defaultFilterAdded.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.length]); // Dependency on addFilter removed as it's memoized now

  // Add a new empty filter (memoized)
  const addFilter = useCallback(() => {
    const newFilter: FilterCondition = {
      id: `filter-${Date.now()}`,
      field: 'Impact', 
      condition: 'equals',
      value: '',
      value2: '',
    };
    setFilters(prevFilters => [...prevFilters, newFilter]);
  }, []); // No dependencies

  // Remove a filter (memoized)
  const removeFilter = useCallback((id: string) => {
    setFilters(currentFilters => {
        if (currentFilters.length === 1) {
            return [
                { id: `filter-${Date.now()}`, field: 'Impact', condition: 'equals', value: '', value2: '' }
            ];
        } else {
            return currentFilters.filter(f => f.id !== id);
        }
    });
  }, []); // No dependencies

  // Update a filter property (memoized)
  const updateFilter = useCallback((id: string, property: keyof FilterCondition, value: string) => {
    setFilters(prevFilters => 
      prevFilters.map(filter => {
        if (filter.id === id) {
          const updatedFilter = { ...filter, [property]: value };
          
          if (property === 'field') {
            const availableConditions = getAvailableConditions(value);
            if (!availableConditions.some(c => c.value === filter.condition)) {
              updatedFilter.condition = availableConditions[0]?.value || 'equals';
            }
            updatedFilter.value = '';
            updatedFilter.value2 = '';
          }
          
          if (property === 'condition' && !isRangeCondition(value) && isRangeCondition(filter.condition)) {
             updatedFilter.value2 = '';
          }

          return updatedFilter;
        }
        return filter;
      })
    );
  }, [getAvailableConditions, isRangeCondition]); // Dependencies added

  // Memoize the active filter count based on the *memoized* active filters array
  const activeFilterCount = useMemo(() => {
    return currentActiveFilters.length;
  }, [currentActiveFilters]);

  // Inject CSS styles
  useEffect(() => {
    // Create a style element
    const styleEl = document.createElement('style');
    
    // Add CSS rules for our filter builder components
    styleEl.innerHTML = `
      .custom-filter-builder .custom-select-trigger,
      .custom-filter-builder .custom-input {
        background-color: #1e1e1e !important;
        color: white !important;
        border: 1px solid #2d2d2d !important;
      }
      
      /* Target selectContent via its React portal container */
      div[data-radix-popper-content-wrapper] {
        --select-content-bg: #1e1e1e !important;
      }
      
      div[data-radix-popper-content-wrapper] [role="listbox"] {
        background-color: #1e1e1e !important;
        color: white !important;
        border: 1px solid #2d2d2d !important;
      }
      
      /* Force the input to have proper styling */
      .custom-filter-builder input.custom-input {
        background-color: #1e1e1e !important;
        color: white !important;
        border-color: #2d2d2d !important;
      }
      
      /* Inactive filter row styling */
      .filter-row.inactive {
        opacity: 0.7;
      }
    `;
    
    // Add to head
    document.head.appendChild(styleEl);
    
    // Cleanup on unmount
    return () => {
      if (styleEl && document.head.contains(styleEl)) {
        document.head.removeChild(styleEl);
      }
    };
  }, []);

  return (
    <div className={cn("mb-4 custom-filter-builder", className)}>
      <div className="p-4 border rounded-md bg-card space-y-4">
        {/* Filter rows */}
        <div className="space-y-2">
          {filters.map((filter) => {
            const fieldType = getFieldType(filter.field);
            const availableConditions = getAvailableConditions(filter.field);
            const showRange = isRangeCondition(filter.condition);
            const isActive = showRange 
              ? filter.value.trim() !== '' && filter.value2 != null && filter.value2.trim() !== ''
              : filter.value.trim() !== '';
            
            return (
              <FilterRow 
                key={filter.id} 
                filter={filter}
                isActive={isActive}
                fieldType={fieldType}
                availableConditions={availableConditions}
                showRange={showRange}
                updateFilter={updateFilter} // Pass memoized updateFilter
                removeFilter={removeFilter} // Pass memoized removeFilter
              />
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="flex justify-start items-center">
           <Button 
             variant="outline" 
             size="sm"
             className="flex items-center gap-1"
             onClick={addFilter} // Use memoized callback
           >
             <Plus className="h-3.5 w-3.5" />
             <span>Add Filter</span>
           </Button>

           {/* Use the memoized count */}
           {activeFilterCount > 0 && (
             <div className="flex items-center ml-auto">
               <span className="text-sm text-muted-foreground mr-2">
                 {activeFilterCount} active filter{activeFilterCount === 1 ? '' : 's'}
               </span>
               <Button 
                 variant="outline" 
                 size="sm" 
                 onClick={() => {
                   setFilters([]); 
                   defaultFilterAdded.current = false; 
                 }}
                 className="ml-2"
               >
                 Clear Filters
               </Button>
             </div>
           )}
        </div> 
      </div>
    </div>
  );
}); // Close React.memo

// Explicitly set displayName for React DevTools
FilterBuilder.displayName = 'FilterBuilder'; 

// --- New Memoized FilterRow Component --- 
interface FilterRowProps {
  filter: FilterCondition;
  isActive: boolean;
  fieldType: string;
  availableConditions: typeof conditionOptions;
  showRange: boolean;
  updateFilter: (id: string, property: keyof FilterCondition, value: string) => void;
  removeFilter: (id: string) => void;
}

const FilterRow = React.memo<FilterRowProps>(({ 
  filter, isActive, fieldType, availableConditions, showRange, updateFilter, removeFilter
}) => {
  return (
    <div 
      className={`flex items-center gap-2 filter-row ${isActive ? 'active' : 'inactive'}`}
    >
       <Select 
         value={filter.field} 
         onValueChange={(value) => updateFilter(filter.id, 'field', value)}
       >
         <SelectTrigger className="w-[120px] custom-select-trigger">
           <SelectValue placeholder="Field" />
         </SelectTrigger>
         <SelectContent>
           {filterFields.map((field) => (
             <SelectItem key={field.value} value={field.value}>
               {field.label}
             </SelectItem>
           ))}
         </SelectContent>
       </Select>
       <Select 
         value={filter.condition} 
         onValueChange={(value) => updateFilter(filter.id, 'condition', value)}
       >
         <SelectTrigger className="w-[140px] custom-select-trigger">
           <SelectValue placeholder="Condition" />
         </SelectTrigger>
         <SelectContent>
           {availableConditions.map((condition) => (
             <SelectItem key={condition.value} value={condition.value}>
               {condition.label}
             </SelectItem>
           ))}
         </SelectContent>
       </Select>
       {showRange ? (
         <div className="flex items-center gap-2">
           <Input
             type="number" 
             value={filter.value}
             onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
             placeholder="Min"
             className="w-[80px] custom-input text-sm h-8"
           />
           <span className="text-muted-foreground">-</span>
           <Input
             type="number"
             value={filter.value2 || ''} 
             onChange={(e) => updateFilter(filter.id, 'value2', e.target.value)}
             placeholder="Max"
             className="w-[80px] custom-input text-sm h-8"
           />
         </div>
       ) : (
         <Input
           type={fieldType === 'number' ? 'number' : 'text'}
           value={filter.value}
           onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
           placeholder="Value"
           className="w-[180px] custom-input"
         />
       )}
       <Button 
         variant="ghost" 
         size="icon"
         className="h-8 w-8 p-0 hover:bg-destructive/20"
         onClick={() => removeFilter(filter.id)} 
       >
         <X className="h-4 w-4" />
       </Button>
    </div>
  );
});
FilterRow.displayName = 'FilterRow';
// --- End FilterRow Component --- 