/* eslint-disable sonarjs/no-implicit-dependencies */
import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import CommandPaletteModal from "$lib/components/modals/CommandPaletteModal.svelte";
import type { NoteIndexEntry } from "$lib/core/storage/types";

const createNote = (input: {
  id: string;
  title: string;
  updatedAt: number;
}): NoteIndexEntry => ({
  id: input.id,
  title: input.title,
  folderId: null,
  tagIds: [],
  favorite: false,
  createdAt: input.updatedAt - 5000,
  updatedAt: input.updatedAt,
  deletedAt: null,
  isTemplate: false,
});

describe("CommandPaletteModal", () => {
  afterEach(() => {
    cleanup();
  });

  it("focuses the command input on mount", async () => {
    const { getByLabelText } = render(CommandPaletteModal, {
      props: {
        notes: [],
      },
    });

    const input = getByLabelText("Command palette");
    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });
  });

  it("navigates results with arrow keys and selects with enter", async () => {
    const noteA = createNote({
      id: "note-a",
      title: "Alpha",
      updatedAt: 2000,
    });
    const noteB = createNote({
      id: "note-b",
      title: "Beta",
      updatedAt: 1000,
    });

    const onOpenNote = vi.fn();
    const onClose = vi.fn();

    const { getByLabelText, getByTestId } = render(CommandPaletteModal, {
      props: {
        onOpenNote,
        onClose,
        notes: [noteA, noteB],
        onCreateNote: vi.fn(),
        onOpenGlobalSearch: vi.fn(),
        onGoToTrash: vi.fn(),
        onToggleRightPanel: vi.fn(),
        onOpenSettings: vi.fn(),
      },
    });

    const input = getByLabelText("Command palette");
    const firstItem = getByTestId("palette-item-note-note-a");

    expect(firstItem.getAttribute("data-selected")).toBe("true");

    await fireEvent.keyDown(input, { key: "ArrowDown" });

    const secondItem = getByTestId("palette-item-note-note-b");
    expect(secondItem.getAttribute("data-selected")).toBe("true");

    await fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(onOpenNote).toHaveBeenCalledWith("note-b");
      expect(onClose).toHaveBeenCalled();
    });
  });
});
