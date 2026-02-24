import { describe, expect, it } from "vitest";
import { noteListViews, resolveNoteListView } from "../note-list-view";

describe("resolveNoteListView", () => {
  it("returns projects when projects is open", () => {
    expect(resolveNoteListView(true)).toBe(noteListViews.projects);
  });

  it("returns notes when projects is closed", () => {
    expect(resolveNoteListView(false)).toBe(noteListViews.notes);
  });
});
