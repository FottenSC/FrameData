export type FieldType = "text" | "number" | "enum";

// A filter operator describes how a condition behaves and what UI it needs
export interface FilterOperator {
  id: string; // e.g., 'equals', 'contains', 'between', 'hasTag'
  label: string;
  input: "none" | "single" | "range" | "multi"; // what inputs the UI should render
  appliesTo: FieldType[]; // which field types this operator supports
  // Evaluation predicate. Receives the fieldType for smarter parsing.
  test: (
    args: {
      fieldType: FieldType;
      fieldString: string | null; // string representation of the field
      fieldNumber: number | null; // numeric representation when applicable, else null
      value?: string; // user value
      value2?: string; // optional 2nd value for ranges
    }
  ) => boolean;
}

export interface FieldConfig {
  id: string; // e.g., 'impact', 'command'
  label: string; // UI label
  type: FieldType;
  // restrict conditions for this field; if omitted, all operators valid for the type are allowed
  allowedOperators?: string[];
  // For enum fields, provide options for UI
  options?: Array<{ value: string; label?: string }>;
}

export interface GameFilterConfig {
  fields: FieldConfig[];
  // optional extra operators in addition to defaults, keyed by id
  customOperators?: FilterOperator[];
}
