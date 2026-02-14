import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import NoteListRow from "../NoteListRow.svelte";
import type { NoteIndexEntry, Tag } from "../../../core/storage/types";

afterEach(() => {
  cleanup();
});

const createNote = (tagIds: string[]): NoteIndexEntry => ({
  id: "note-1",
  title: "Tagged note",
  preview: "Preview text",
  folderId: null,
  favorite: false,
  createdAt: 1,
  updatedAt: 2,
  deletedAt: null,
  isTemplate: false,
  tagIds,
});

describe("NoteListRow (tags)", () => {
  it("renders up to three tag pills when enabled", () => {
    const tagsById: Record<string, Tag> = {
      tagAlpha: { id: "tagAlpha", name: "alpha" },
      tagBeta: { id: "tagBeta", name: "beta" },
      tagCharlie: { id: "tagCharlie", name: "charlie" },
      tagDelta: { id: "tagDelta", name: "delta" },
    };

    const { queryByText } = render(NoteListRow, {
      props: {
        note: createNote(["tagAlpha", "tagBeta", "tagCharlie", "tagDelta"]),
        showTags: true,
        tagsById,
      },
    });

    expect(queryByText("alpha")).toBeTruthy();
    expect(queryByText("beta")).toBeTruthy();
    expect(queryByText("charlie")).toBeTruthy();
    expect(queryByText("delta")).toBeNull();
  });

  it("hides tag pills when disabled", () => {
    const tagsById: Record<string, Tag> = {
      tagAlpha: { id: "tagAlpha", name: "alpha" },
    };

    const { queryByText } = render(NoteListRow, {
      props: {
        note: createNote(["tagAlpha"]),
        showTags: false,
        tagsById,
      },
    });

    expect(queryByText("alpha")).toBeNull();
  });
});
