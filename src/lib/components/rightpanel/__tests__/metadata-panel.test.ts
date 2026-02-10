/* eslint-disable sonarjs/no-implicit-dependencies */
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import MetadataPanel from "$lib/components/rightpanel/MetadataPanel.svelte";
import type { NoteDocumentFile, Vault } from "$lib/core/storage/types";

const createNote = (
  overrides?: Partial<NoteDocumentFile>
): NoteDocumentFile => {
  const timestamp = 1_700_000_000_000;
  return {
    id: "note-1",
    title: "",
    createdAt: timestamp,
    updatedAt: timestamp,
    folderId: null,
    tagIds: [],
    favorite: false,
    deletedAt: null,
    customFields: {},
    pmDoc: { type: "doc", content: [] },
    derived: {
      plainText: "",
      outgoingLinks: [],
    },
    ...overrides,
  };
};

const createVault = (): Vault => {
  const timestamp = 1_700_000_000_000;
  return {
    id: "vault-1",
    name: "Vault",
    createdAt: timestamp,
    updatedAt: timestamp,
    folders: {},
    tags: {},
    notesIndex: {},
    templatesIndex: {},
    settings: {},
  };
};

describe("MetadataPanel", () => {
  afterEach(cleanup);

  it("renders empty state when no note is selected", () => {
    const { getByText } = render(MetadataPanel, {
      props: {
        note: null,
        vault: null,
      },
    });

    expect(getByText("Select a note to view metadata.")).toBeTruthy();
  });

  it("adds a new custom field", async () => {
    const note = createNote();
    const vault = createVault();
    const onUpdateCustomFields = vi.fn();

    const { getByTestId } = render(MetadataPanel, {
      props: {
        note,
        vault,
        onUpdateCustomFields,
      },
    });

    await fireEvent.click(getByTestId("metadata-add-field"));

    expect(onUpdateCustomFields).toHaveBeenCalledWith(note.id, {
      Field: "",
    });
  });

  it("updates a custom field value", async () => {
    const note = createNote({ customFields: { Mood: "Calm" } });
    const vault = createVault();
    const onUpdateCustomFields = vi.fn();

    const { getByTestId } = render(MetadataPanel, {
      props: {
        note,
        vault,
        onUpdateCustomFields,
      },
    });

    const valueInput = getByTestId("custom-field-value-0");
    if (!(valueInput instanceof HTMLInputElement)) {
      throw new TypeError("Expected an input element.");
    }
    await fireEvent.input(valueInput, { target: { value: "Focused" } });

    expect(onUpdateCustomFields).toHaveBeenCalledWith(note.id, {
      Mood: "Focused",
    });
  });
});
