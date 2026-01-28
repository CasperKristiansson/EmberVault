import { describe, expect, it } from "vitest";
import {
  addFolder,
  getChildFolderIds,
  getRootFolderIds,
  isFolderEmpty,
  removeFolder,
  renameFolder,
} from "../folder-tree";

describe("folder tree helpers", () => {
  it("adds root and child folders", () => {
    const rootId = "root";
    const childId = "child";

    const rootFolders = addFolder(
      {},
      {
        id: rootId,
        name: "Root",
        parentId: null,
      }
    );

    const nestedFolders = addFolder(rootFolders, {
      id: childId,
      name: "Child",
      parentId: rootId,
    });

    expect(getRootFolderIds(nestedFolders)).toEqual([rootId]);
    expect(getChildFolderIds(rootId, nestedFolders)).toEqual([childId]);
  });

  it("renames a folder when a new name is provided", () => {
    const folders = addFolder(
      {},
      {
        id: "root",
        name: "Root",
        parentId: null,
      }
    );

    const renamed = renameFolder(folders, "root", "Updated");

    expect(renamed.root.name).toBe("Updated");
  });

  it("removes a folder and updates the parent", () => {
    const rootId = "root";
    const childId = "child";

    const withRoot = addFolder(
      {},
      {
        id: rootId,
        name: "Root",
        parentId: null,
      }
    );
    const withChild = addFolder(withRoot, {
      id: childId,
      name: "Child",
      parentId: rootId,
    });

    const removed = removeFolder(withChild, childId);

    expect(removed[childId]).toBeUndefined();
    expect(getChildFolderIds(rootId, removed)).toEqual([]);
  });

  it("checks if a folder is empty using notes and children", () => {
    const folders = addFolder(
      {},
      {
        id: "root",
        name: "Root",
        parentId: null,
      }
    );

    const emptyNotesIndex = {};
    expect(isFolderEmpty("root", folders, emptyNotesIndex)).toBe(true);

    const withChild = addFolder(folders, {
      id: "child",
      name: "Child",
      parentId: "root",
    });

    expect(isFolderEmpty("root", withChild, emptyNotesIndex)).toBe(false);

    const notesIndex = {
      note: {
        id: "note",
        title: "Note",
        folderId: "root",
        tagIds: [],
        favorite: false,
        createdAt: 0,
        updatedAt: 0,
        deletedAt: null,
        isTemplate: false,
      },
    };

    expect(isFolderEmpty("root", folders, notesIndex)).toBe(false);
  });
});
