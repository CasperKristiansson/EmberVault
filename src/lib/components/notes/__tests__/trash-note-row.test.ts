/* eslint-disable sonarjs/no-implicit-dependencies */
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import TrashNoteRow from "$lib/components/notes/TrashNoteRow.svelte";
import type { NoteIndexEntry } from "$lib/core/storage/types";

const createNote = (): NoteIndexEntry => ({
  id: "note-1",
  title: "Trashed",
  folderId: null,
  tagIds: [],
  favorite: false,
  createdAt: 1,
  updatedAt: 2,
  deletedAt: 3,
  isTemplate: false,
});

describe("TrashNoteRow", () => {
  afterEach(cleanup);

  it("calls select, restore, and delete handlers", async () => {
    const onSelect = vi.fn();
    const onRestore = vi.fn();
    const onDeletePermanent = vi.fn();

    const { getByTestId } = render(TrashNoteRow, {
      props: {
        note: createNote(),
        onSelect,
        onRestore,
        onDeletePermanent,
      },
    });

    await fireEvent.click(getByTestId("trash-row"));
    await fireEvent.click(getByTestId("trash-restore"));
    await fireEvent.click(getByTestId("trash-delete"));

    expect(onSelect).toHaveBeenCalledWith("note-1");
    expect(onRestore).toHaveBeenCalledWith("note-1");
    expect(onDeletePermanent).toHaveBeenCalledWith("note-1");
  });
});
