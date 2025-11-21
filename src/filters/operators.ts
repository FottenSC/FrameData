import { FieldType, FilterOperator } from "./types";

// Built-in, reusable operators
export const builtinOperators: FilterOperator[] = [
  {
    id: "equals",
    label: "Equals",
    input: "single",
    appliesTo: ["text", "number", "enum"],
    test: ({ fieldString, fieldNumber, value, fieldType }) => {
      if (fieldType === "number") {
        const n = value != null ? Number(value) : NaN;
        return fieldNumber != null && !isNaN(n) && fieldNumber === n;
      }
      const v = (value ?? "").toLowerCase();
      return (fieldString ?? "").toLowerCase() === v;
    },
  },
  {
    id: "notEquals",
    label: "Not Equals",
    input: "single",
    appliesTo: ["text", "number", "enum"],
    test: ({ fieldString, fieldNumber, value, fieldType }) => {
      if (fieldType === "number") {
        const n = value != null ? Number(value) : NaN;
        return !(fieldNumber != null && !isNaN(n) && fieldNumber === n);
      }
      const v = (value ?? "").toLowerCase();
      return (fieldString ?? "").toLowerCase() !== v;
    },
  },
  {
    id: "contains",
    label: "Contains",
    input: "single",
    appliesTo: ["text"],
    test: ({ fieldString, value }) => {
      return (fieldString ?? "")
        .toLowerCase()
        .includes((value ?? "").toLowerCase());
    },
  },
  {
    id: "startsWith",
    label: "Starts With",
    input: "single",
    appliesTo: ["text"],
    test: ({ fieldString, value }) => {
      return (fieldString ?? "")
        .toLowerCase()
        .startsWith((value ?? "").toLowerCase());
    },
  },
  {
    id: "greaterThan",
    label: "Greater Than",
    input: "single",
    appliesTo: ["number"],
    test: ({ fieldNumber, value }) => {
      const n = value != null ? Number(value) : NaN;
      return fieldNumber != null && !isNaN(n) && fieldNumber > n;
    },
  },
  {
    id: "lessThan",
    label: "Less Than",
    input: "single",
    appliesTo: ["number"],
    test: ({ fieldNumber, value }) => {
      const n = value != null ? Number(value) : NaN;
      return fieldNumber != null && !isNaN(n) && fieldNumber < n;
    },
  },
  {
    id: "between",
    label: "Between",
    input: "range",
    appliesTo: ["number"],
    test: ({ fieldNumber, value, value2 }) => {
      const n1 = value != null ? Number(value) : NaN;
      const n2 = value2 != null ? Number(value2) : NaN;
      if (fieldNumber == null || isNaN(n1) || isNaN(n2)) return false;
      const min = Math.min(n1, n2);
      const max = Math.max(n1, n2);
      return fieldNumber >= min && fieldNumber <= max;
    },
  },
  {
    id: "notBetween",
    label: "Not Between",
    input: "range",
    appliesTo: ["number"],
    test: ({ fieldNumber, value, value2 }) => {
      const n1 = value != null ? Number(value) : NaN;
      const n2 = value2 != null ? Number(value2) : NaN;
      if (fieldNumber == null || isNaN(n1) || isNaN(n2)) return false;
      const min = Math.min(n1, n2);
      const max = Math.max(n1, n2);
      return fieldNumber < min || fieldNumber > max;
    },
  },
];

export const operatorById = (allOps: FilterOperator[]) => {
  const map = new Map<string, FilterOperator>();
  for (const op of allOps) map.set(op.id, op);
  return map;
};
