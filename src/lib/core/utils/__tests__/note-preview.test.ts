import { describe, expect, it } from "vitest";

import { resolveNotePreview } from "$lib/core/utils/note-preview";

describe("resolveNotePreview", () => {
  it("returns null for missing or empty text", () => {
    expect(resolveNotePreview()).toBeNull();
    expect(resolveNotePreview("")).toBeNull();
    expect(resolveNotePreview("   \n  ")).toBeNull();
  });

  it("collapses whitespace to a single line", () => {
    expect(resolveNotePreview("Hello\nworld\t\tthere")).toBe(
      "Hello world there"
    );
  });

  it("truncates long previews", () => {
    const input = "a".repeat(500);
    const result = resolveNotePreview(input);
    expect(result).not.toBeNull();
    expect(result?.endsWith("…")).toBe(true);
  });
});
