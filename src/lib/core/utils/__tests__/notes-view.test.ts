import { describe, expect, it } from "vitest";
import { openAllNotesView } from "../notes-view";

describe("openAllNotesView", () => {
  it("clears folder and note list filters", () => {
    expect(
      openAllNotesView({
        activeFolderId: "folder-1",
        favoritesOnly: true,
      })
    ).toEqual({
      activeFolderId: null,
      favoritesOnly: false,
    });
  });
});
