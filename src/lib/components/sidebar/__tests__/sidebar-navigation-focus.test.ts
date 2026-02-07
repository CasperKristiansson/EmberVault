import { cleanup, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, describe, expect, it } from "vitest";
import { SvelteSet } from "svelte/reactivity";
import FolderTreeNode from "../FolderTreeNode.svelte";
import type { FolderTree } from "$lib/core/storage/types";

afterEach(() => {
  cleanup();
});

describe("FolderTreeNode", () => {
  it("focuses the rename input when editing starts", async () => {
    const folders: FolderTree = {
      root: {
        id: "root",
        name: "Projects",
        parentId: null,
        childFolderIds: [],
      },
    };

    const { getByTestId } = render(FolderTreeNode, {
      props: {
        folders,
        folderId: "root",
        expandedIds: new SvelteSet<string>(),
        editingFolderId: "root",
        draftName: "Projects",
      },
    });

    await tick();

    const input = getByTestId("folder-rename-input");
    expect(document.activeElement).toBe(input);
  });
});
