import type { CustomFieldValue } from "$lib/core/storage/types";

export type CustomFieldType = "string" | "number" | "date" | "boolean";

export const customFieldTypes: CustomFieldType[] = [
  "string",
  "number",
  "date",
  "boolean",
];

const padDatePart = (value: number): string => String(value).padStart(2, "0");

export const toDateInputValue = (timestamp: number): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  return `${year}-${month}-${day}`;
};

export const parseDateInputValue = (value: string): number | null => {
  if (!value) {
    return null;
  }
  const [year, month, day] = value.split("-").map(Number);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  const timestamp = date.getTime();
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return timestamp;
};

const isDateValue = (
  value: CustomFieldValue
): value is { type: "date"; value: number } => typeof value === "object";

export const getCustomFieldType = (
  value: CustomFieldValue
): CustomFieldType => {
  if (typeof value === "string") {
    return "string";
  }
  if (typeof value === "number") {
    return "number";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  if (isDateValue(value)) {
    return "date";
  }
  return "string";
};

const defaultValueByType: Record<CustomFieldType, () => CustomFieldValue> = {
  string: () => "",
  number: () => 0,
  boolean: () => false,
  date: () => ({ type: "date", value: Date.now() }),
};

export const defaultCustomFieldValue = (
  fieldType: CustomFieldType
): CustomFieldValue => defaultValueByType[fieldType]();

export const formatCustomFieldValue = (value: CustomFieldValue): string => {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return value.toString();
  }
  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }
  return new Date(value.value).toLocaleDateString();
};

const inputValueString = (value: CustomFieldValue): string =>
  typeof value === "string" ? value : "";

const inputValueNumber = (value: CustomFieldValue): string =>
  typeof value === "number" ? value.toString() : "";

const inputValueDate = (value: CustomFieldValue): string =>
  isDateValue(value) ? toDateInputValue(value.value) : "";

const inputValueByType: Record<
  CustomFieldType,
  (value: CustomFieldValue) => string
> = {
  string: inputValueString,
  number: inputValueNumber,
  date: inputValueDate,
  boolean: () => "",
};

export const toCustomFieldInputValue = (
  value: CustomFieldValue,
  fieldType: CustomFieldType
): string => inputValueByType[fieldType](value);

const parseStringInput: (input: string | boolean) => CustomFieldValue = String;

// eslint-disable-next-line sonarjs/function-return-type
const parseNumberInput = (input: string | boolean): CustomFieldValue | null => {
  const value = typeof input === "number" ? input : Number(input);
  const parsed: CustomFieldValue | null = Number.isFinite(value) ? value : null;
  return parsed;
};

const parseBooleanInput: (input: string | boolean) => CustomFieldValue =
  Boolean;

// eslint-disable-next-line sonarjs/function-return-type
const parseDateInput = (input: string | boolean): CustomFieldValue | null => {
  let parsed: CustomFieldValue | null = null;
  if (typeof input === "string") {
    const timestamp = parseDateInputValue(input);
    if (timestamp !== null) {
      parsed = { type: "date", value: timestamp };
    }
  }
  return parsed;
};

const parseByType: Record<
  CustomFieldType,
  (input: string | boolean) => CustomFieldValue | null
> = {
  string: parseStringInput,
  number: parseNumberInput,
  boolean: parseBooleanInput,
  date: parseDateInput,
};

export const parseCustomFieldInput = (
  fieldType: CustomFieldType,
  input: string | boolean
): CustomFieldValue | null => parseByType[fieldType](input);

const normalizeKey = (key: string): string => key.trim();

export const createCustomFieldKey = (existingKeys: string[]): string => {
  const normalized = new Set(existingKeys.map(normalizeKey));
  const base = "Field";
  if (!normalized.has(base)) {
    return base;
  }
  let index = 2;
  while (normalized.has(`${base} ${index}`)) {
    index += 1;
  }
  return `${base} ${index}`;
};
