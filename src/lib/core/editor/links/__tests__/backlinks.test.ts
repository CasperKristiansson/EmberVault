import { describe, expect, it } from "vitest";
import { buildBacklinkSnippet, resolveLinkedMentions } from "../backlinks";
import type { NoteIndexEntry } from "$lib/core/storage/types";

const createNote = (input: {
  id: string;
  title: string;
  linkOutgoing?: string[];
  deletedAt?: number | null;
}): NoteIndexEntry => ({
  id: input.id,
  title: input.title,
  folderId: null,
  tagIds: [],
  favorite: false,
  createdAt: 0,
  updatedAt: 0,
  deletedAt: input.deletedAt ?? null,
  isTemplate: false,
  linkOutgoing: input.linkOutgoing,
});

describe("resolveLinkedMentions", () => {
  it("returns notes linking to the target by id or title", () => {
    const targetId = "note-a";
    const targetTitle = "Alpha";
    const notes = [
      createNote({ id: targetId, title: targetTitle }),
      createNote({ id: "note-b", title: "Beta", linkOutgoing: [targetId] }),
      createNote({
        id: "note-c",
        title: "Gamma",
        linkOutgoing: [targetTitle],
      }),
      createNote({ id: "note-d", title: "Delta", linkOutgoing: ["note-z"] }),
      createNote({
        id: "note-e",
        title: "Epsilon",
        linkOutgoing: [targetId],
        deletedAt: 123,
      }),
    ];

    const results = resolveLinkedMentions(notes, targetId, targetTitle);
    expect(results.map((note: NoteIndexEntry) => note.id)).toEqual([
      "note-b",
      "note-c",
    ]);
  });
});

describe("buildBacklinkSnippet", () => {
  it("returns snippet parts around the first match", () => {
    const text = "This links to [[Alpha]] inside the note.";
    const snippet = buildBacklinkSnippet(text, ["Alpha"], 80);

    expect(snippet).toEqual({
      before: "This links to ",
      match: "[[Alpha]]",
      after: " inside the note.",
    });
  });
});
