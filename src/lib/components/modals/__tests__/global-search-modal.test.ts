/* eslint-disable sonarjs/no-implicit-dependencies */
import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import GlobalSearchModal from "$lib/components/modals/GlobalSearchModal.svelte";
import { buildSearchIndex } from "$lib/core/search/minisearch";
import type { NoteDocumentFile, Vault } from "$lib/core/storage/types";

const folderAId = "folder-a";
const folderBId = "folder-b";
const planningTagId = "tag-1";

const createNote = (input: {
  id: string;
  title: string;
  content: string;
  folderId: string | null;
  tagIds?: string[];
  favorite?: boolean;
}): NoteDocumentFile => {
  const timestamp = Date.now();
  return {
    id: input.id,
    title: input.title,
    createdAt: timestamp,
    updatedAt: timestamp,
    folderId: input.folderId,
    tagIds: input.tagIds ?? [],
    favorite: input.favorite ?? false,
    deletedAt: null,
    customFields: {},
    pmDoc: {},
    derived: {
      plainText: input.content,
      outgoingLinks: [],
    },
  };
};

const createVault = (): Vault => {
  const timestamp = Date.now();
  return {
    id: "vault-1",
    name: "Personal",
    createdAt: timestamp,
    updatedAt: timestamp,
    folders: {
      [folderAId]: {
        id: folderAId,
        name: "Work",
        parentId: null,
        childFolderIds: [],
      },
      [folderBId]: {
        id: folderBId,
        name: "Home",
        parentId: null,
        childFolderIds: [],
      },
    },
    tags: {
      [planningTagId]: { id: planningTagId, name: "Planning" },
    },
    notesIndex: {},
    templatesIndex: {},
    settings: {},
  };
};

describe("GlobalSearchModal", () => {
  afterEach(() => {
    cleanup();
  });

  it("focuses the search input on mount", async () => {
    const vault = createVault();
    const { getByLabelText } = render(GlobalSearchModal, {
      props: {
        vault,
      },
    });

    const input = getByLabelText("Search notes");
    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });
  });

  it("filters results by folder", async () => {
    vi.useFakeTimers();

    const planTitle = "Project Plan";
    const meetingTitle = "Project Meeting";
    const searchTerm = "project";
    const folderA = folderAId;
    const resultsTestId = "search-results";

    const noteA = createNote({
      id: "note-a",
      title: planTitle,
      content: "Draft the project plan for Q1.",
      folderId: folderA,
      tagIds: [planningTagId],
    });
    const noteB = createNote({
      id: "note-b",
      title: meetingTitle,
      content: "Meeting notes with action items.",
      folderId: folderBId,
    });

    const searchState = {
      index: buildSearchIndex([noteA, noteB]),
    };
    const vault = createVault();

    const { getByLabelText, getByTestId } = render(GlobalSearchModal, {
      props: {
        vault,
        searchState,
      },
    });

    const input = getByLabelText("Search notes");
    await fireEvent.input(input, { target: { value: searchTerm } });

    await vi.advanceTimersByTimeAsync(60);

    await waitFor(() => {
      const results = getByTestId(resultsTestId);
      const content = results.textContent;
      expect(content).toContain(planTitle);
      expect(content).toContain(meetingTitle);
    });

    const folderSelect = getByLabelText("Filter by folder");
    await fireEvent.change(folderSelect, { target: { value: folderA } });

    await vi.advanceTimersByTimeAsync(60);

    await waitFor(() => {
      const results = getByTestId(resultsTestId);
      const content = results.textContent;
      expect(content).toContain(planTitle);
      expect(content).not.toContain(meetingTitle);
    });

    vi.useRealTimers();
  });
});
