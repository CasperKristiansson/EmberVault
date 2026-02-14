import { describe, expect, it } from "vitest";

import { resolveNoteListTitle } from "$lib/core/utils/note-list-title";

describe("resolveNoteListTitle", () => {
  it("returns All notes when no folder is selected", () => {
    expect(resolveNoteListTitle(null)).toBe("All notes");
  });

  it("returns folder name when a folder is selected", () => {
    expect(resolveNoteListTitle("Klimra")).toBe("Klimra");
  });
});
