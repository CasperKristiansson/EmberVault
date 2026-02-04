import { describe, expect, it } from "vitest";
import {
  createCustomFieldKey,
  defaultCustomFieldValue,
  formatCustomFieldValue,
  getCustomFieldType,
  parseCustomFieldInput,
  parseDateInputValue,
  toDateInputValue,
} from "../custom-fields";

describe("custom field utilities", () => {
  it("infers custom field types", () => {
    expect(getCustomFieldType("text")).toBe("string");
    expect(getCustomFieldType(42)).toBe("number");
    expect(getCustomFieldType(true)).toBe("boolean");
    expect(getCustomFieldType({ type: "date", value: 123 })).toBe("date");
  });

  it("formats custom field values", () => {
    expect(formatCustomFieldValue("Hello")).toBe("Hello");
    expect(formatCustomFieldValue(7)).toBe("7");
    expect(formatCustomFieldValue(false)).toBe("False");

    const timestamp = new Date(2024, 0, 1).getTime();
    expect(formatCustomFieldValue({ type: "date", value: timestamp })).toBe(
      new Date(timestamp).toLocaleDateString()
    );
  });

  it("parses custom field inputs", () => {
    expect(parseCustomFieldInput("string", "Alpha")).toBe("Alpha");
    expect(parseCustomFieldInput("number", "12")).toBe(12);
    expect(parseCustomFieldInput("number", "oops")).toBeNull();
    expect(parseCustomFieldInput("boolean", true)).toBe(true);

    const parsed = parseCustomFieldInput("date", "2024-02-01");
    expect(parsed).toEqual({
      type: "date",
      value: new Date(2024, 1, 1).getTime(),
    });
  });

  it("creates unique field keys", () => {
    expect(createCustomFieldKey([])).toBe("Field");
    expect(createCustomFieldKey(["Field"])).toBe("Field 2");
    expect(createCustomFieldKey(["Field", "Field 2"])).toBe("Field 3");
  });

  it("round-trips date inputs", () => {
    const timestamp = new Date(2025, 5, 9).getTime();
    const value = toDateInputValue(timestamp);
    expect(parseDateInputValue(value)).toBe(timestamp);
  });

  it("provides defaults for field types", () => {
    expect(defaultCustomFieldValue("string")).toBe("");
    expect(defaultCustomFieldValue("number")).toBe(0);
    expect(defaultCustomFieldValue("boolean")).toBe(false);
    expect(defaultCustomFieldValue("date")).toHaveProperty("type", "date");
  });
});
