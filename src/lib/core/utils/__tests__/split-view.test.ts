import { describe, expect, it } from "vitest";
import { resolveSecondaryNoteId } from "../split-view";

describe("resolveSecondaryNoteId", () => {
  it("returns preferred when it is valid and distinct", () => {
    const resolved = resolveSecondaryNoteId({
      availableIds: ["a", "b", "c"],
      primaryId: "a",
      preferredId: "b",
    });
    expect(resolved).toBe("b");
  });

  it("falls back when preferred matches the primary", () => {
    const resolved = resolveSecondaryNoteId({
      availableIds: ["a", "b", "c"],
      primaryId: "a",
      preferredId: "a",
      fallbackIds: ["c", "b"],
    });
    expect(resolved).toBe("c");
  });

  it("chooses the first available fallback when preferred is missing", () => {
    const resolved = resolveSecondaryNoteId({
      availableIds: ["a", "b", "c"],
      primaryId: "b",
      preferredId: null,
      fallbackIds: ["b", "c"],
    });
    expect(resolved).toBe("c");
  });

  it("returns null when only the primary is available", () => {
    const resolved = resolveSecondaryNoteId({
      availableIds: ["a"],
      primaryId: "a",
      preferredId: "a",
    });
    expect(resolved).toBeNull();
  });
});
