/* eslint-disable sonarjs/no-implicit-dependencies */
import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import CommandPaletteModal from "$lib/components/modals/CommandPaletteModal.svelte";
import type { NoteIndexEntry, Project } from "$lib/core/storage/types";

const createProject = (id: string, name: string): Project => {
  const timestamp = Date.now();
  return {
    id,
    name,
    createdAt: timestamp,
    updatedAt: timestamp,
    folders: {},
    tags: {},
    notesIndex: {},
    templatesIndex: {},
    settings: {},
  };
};

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
  it("navigates results with arrow keys and selects with enter", async () => {
    const project = createProject("project-1", "Personal");
    const projects = [project, createProject("project-2", "Work")];
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
        project,
        projects,
        onOpenNote,
        onClose,
        notes: [noteA, noteB],
        onCreateNote: vi.fn(),
        onOpenGlobalSearch: vi.fn(),
        onProjectChange: vi.fn(),
        onToggleSplitView: vi.fn(),
        onOpenGraph: vi.fn(),
        onOpenTemplates: vi.fn(),
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
