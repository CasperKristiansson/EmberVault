import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import { SvelteSet } from "svelte/reactivity";
import FolderTreeNode from "../FolderTreeNode.svelte";
import type { FolderTree } from "$lib/core/storage/types";

afterEach(() => {
  cleanup();
});

describe("FolderTreeNode", () => {
  it("renders a folder icon for non-editing rows", () => {
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
      },
    });

    expect(getByTestId("folder-icon")).toBeTruthy();
  });
});
