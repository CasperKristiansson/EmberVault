import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SvelteSet } from "svelte/reactivity";
import FolderTreeNode from "../FolderTreeNode.svelte";
import ProjectSwitcher from "../ProjectSwitcher.svelte";
import type { FolderTree, Project } from "$lib/core/storage/types";

const buildProject = (
  id: string,
  name: string,
  updatedAt: number
): Project => ({
  id,
  name,
  updatedAt,
  createdAt: updatedAt,
  folders: {},
  tags: {},
  notesIndex: {},
  templatesIndex: {},
  settings: {},
});

afterEach(() => {
  cleanup();
});

describe("ProjectSwitcher", () => {
  it("notifies when a different project is selected", async () => {
    const projects = [
      buildProject("alpha", "Alpha", 1),
      buildProject("beta", "Beta", 2),
    ];
    const onSelect = vi.fn();

    const { getByRole } = render(ProjectSwitcher, {
      props: {
        projects,
        onSelect,
        activeProjectId: "alpha",
      },
    });

    const select = getByRole("combobox", { name: "Project switcher" });
    await fireEvent.change(select, { target: { value: "beta" } });

    expect(onSelect).toHaveBeenCalledWith("beta");
  });
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
