/* eslint-disable sonarjs/no-implicit-dependencies */
import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import TemplatePickerModal from "$lib/components/modals/TemplatePickerModal.svelte";
import type { TemplateIndexEntry } from "$lib/core/storage/types";

const createTemplate = (input: {
  id: string;
  title: string;
}): TemplateIndexEntry => ({
  id: input.id,
  title: input.title,
  folderId: null,
  tagIds: [],
  favorite: false,
  createdAt: 1,
  updatedAt: 2,
  deletedAt: null,
  isTemplate: true,
});

describe("TemplatePickerModal", () => {
  afterEach(() => {
    cleanup();
  });

  it("focuses the first available action on mount", async () => {
    const onCreateBlank = vi.fn();
    const { getByTestId } = render(TemplatePickerModal, {
      props: {
        onCreateBlank,
        templates: [],
      },
    });

    const blankButton = getByTestId("template-picker-item-blank");
    await waitFor(() => {
      expect(document.activeElement).toBe(blankButton);
    });
  });

  it("creates blank note or template-based note", async () => {
    const lastUsedId = "template-b";
    const templates = [
      createTemplate({ id: "template-a", title: "Daily" }),
      createTemplate({ id: lastUsedId, title: "Weekly" }),
    ];

    const onCreateBlank = vi.fn();
    const onCreateFromTemplate = vi.fn();
    const onClose = vi.fn();

    const { getByTestId } = render(TemplatePickerModal, {
      props: {
        lastUsedTemplateId: lastUsedId,
        onCreateBlank,
        onCreateFromTemplate,
        onClose,
        templates,
      },
    });

    const blankButton = getByTestId("template-picker-item-blank");
    await fireEvent.click(blankButton);

    expect(onClose).toHaveBeenCalled();
    expect(onCreateBlank).toHaveBeenCalled();

    const templateButton = getByTestId("template-picker-item-last-template-b");
    await fireEvent.click(templateButton);

    expect(onCreateFromTemplate).toHaveBeenCalledWith(lastUsedId);
  });
});
