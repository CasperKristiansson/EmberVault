import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import FolderTree from "../FolderTree.svelte";

afterEach(() => {
  cleanup();
});

describe("FolderTree", () => {
  it("shows an add folder button and creates a root folder when clicked", async () => {
    // eslint-disable-next-line @typescript-eslint/require-await
    const onCreate = vi.fn(async () => null);
    const onOpenTrash = vi.fn();

    const { getByTestId } = render(FolderTree, {
      props: {
        folders: {},
        notesIndex: {},
        onCreate,
        onOpenTrash,
      },
    });

    expect(getByTestId("folder-add")).toBeTruthy();
    expect(getByTestId("open-trash")).toBeTruthy();
    expect(getByTestId("folder-empty").textContent).toContain(
      "No folders yet."
    );

    await fireEvent.click(getByTestId("folder-add"));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith(null);

    await fireEvent.click(getByTestId("open-trash"));

    expect(onOpenTrash).toHaveBeenCalledTimes(1);
  });
});
